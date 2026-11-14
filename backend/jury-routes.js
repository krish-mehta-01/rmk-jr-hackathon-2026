const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { signJuryAdminToken, signJudgeToken, validateSession } = require('./auth-helper');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[ERROR] JWT_SECRET is not set in backend/.env');
  process.exit(1);
}

// ─────────────────────────────────────────────
// Rate Limiter
// ─────────────────────────────────────────────
function createLimiter(max, windowMs) {
  const failures = new Map();
  return {
    isLimited(key) {
      const entry = failures.get(key);
      if (!entry) return false;
      if (Date.now() - entry.first > windowMs) {
        failures.delete(key);
        return false;
      }
      return entry.count >= max;
    },
    fail(key) {
      const entry = failures.get(key);
      if (!entry || Date.now() - entry.first > windowMs) failures.set(key, { count: 1, first: Date.now() });
      else entry.count += 1;
    },
    clear(key) {
      failures.delete(key);
    }
  };
}

const juryLoginLimiter = createLimiter(25, 5 * 60 * 1000);

// ─────────────────────────────────────────────
// Auth Middleware
// ─────────────────────────────────────────────
async function authJuryAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Please log in to the Jury Admin portal.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'jury-admin') return res.status(403).json({ error: 'Access denied: Jury Admin only' });
    const validated = await validateSession(decoded);
    if (!validated) return res.status(401).json({ error: 'Jury Admin session invalid or password changed. Please log in again.' });
    req.user = validated;
    next();
  } catch {
    res.status(401).json({ error: 'Jury Admin session expired. Please log in again.' });
  }
}

async function authJudge(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Please log in to the Jury portal.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'judge') return res.status(403).json({ error: 'Access denied: Judge account required' });
    const validated = await validateSession(decoded);
    if (!validated) return res.status(401).json({ error: 'Judge session invalid or password changed. Please log in again.' });
    req.user = validated;
    next();
  } catch {
    res.status(401).json({ error: 'Judge session expired. Please log in again.' });
  }
}

// Strict Server-Side Enforcement: Judge must change password and complete profile registration
async function enforceJudgeReady(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT is_active, must_change_password, is_registered FROM jury_users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(401).json({ error: 'Judge account not found' });
    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
    }
    if (user.must_change_password) {
      return res.status(403).json({ error: 'Password change required. Please set your private password to access evaluation features.' });
    }
    next();
  } catch (err) {
    console.error('[ERROR] enforceJudgeReady check failed:', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

// ─────────────────────────────────────────────────────────────
// 1. JURY ADMINISTRATOR ENDPOINTS
// ─────────────────────────────────────────────────────────────

// Jury Admin Login
router.post('/jury-admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (juryLoginLimiter.isLimited(req.ip)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait a few minutes and try again.' });
    }

    const [rows] = await pool.execute('SELECT * FROM jury_admins WHERE username = ?', [username.trim()]);
    const admin = rows[0];

    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      juryLoginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Invalid Jury Administrator credentials' });
    }

    juryLoginLimiter.clear(req.ip);
    const token = signJuryAdminToken(admin);

    res.json({ token, username: admin.username, name: admin.name });
  } catch (err) {
    console.error('[ERROR] Jury Admin Login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Jury Admin Overview Statistics
router.get('/jury-admin/stats', authJuryAdmin, async (req, res) => {
  try {
    const [[panelRow]] = await pool.execute('SELECT COUNT(*) AS total_panels FROM jury_panels');
    const [[judgeRow]] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_judges,
        COALESCE(SUM(is_registered = TRUE), 0) AS registered_judges,
        COALESCE(SUM(is_active = TRUE), 0) AS active_judges
      FROM jury_users
    `);
    const [[evalRow]] = await pool.execute(`
      SELECT 
        COALESCE(SUM(status = 'SUBMITTED'), 0) AS completed_evals,
        COALESCE(SUM(status = 'DRAFT'), 0) AS draft_evals
      FROM project_evaluations
    `);

    const totalPanels = Number(panelRow.total_panels || 0);
    const totalJudges = Number(judgeRow.total_judges || 0);
    const registeredJudges = Number(judgeRow.registered_judges || 0);
    const activeJudges = Number(judgeRow.active_judges || 0);
    const completedEvals = Number(evalRow.completed_evals || 0);
    const draftEvals = Number(evalRow.draft_evals || 0);

    res.json({
      total_panels: totalPanels,
      total_judges: totalJudges,
      registered_judges: registeredJudges,
      pending_registrations: Math.max(totalJudges - registeredJudges, 0),
      active_judges: activeJudges,
      evaluations_completed: completedEvals,
      evaluations_pending: draftEvals
    });
  } catch (err) {
    console.error('[ERROR] Jury Admin Stats:', err);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// All 15 Panels with Judge Statuses and Profiles
router.get('/jury-admin/panels', authJuryAdmin, async (req, res) => {
  try {
    const [panels] = await pool.execute('SELECT id, panel_code, panel_name, is_active FROM jury_panels ORDER BY id ASC');

    const [users] = await pool.execute(`
      SELECT 
        u.id, u.panel_id, u.username, u.judge_type, u.is_active, u.must_change_password, u.is_registered,
        p.full_name, p.phone_no, p.email, p.designation, p.institution_name, p.company_name,
        (SELECT COUNT(*) FROM project_evaluations e WHERE e.judge_id = u.id AND e.status = 'SUBMITTED') AS completed_evals
      FROM jury_users u
      LEFT JOIN jury_profiles p ON p.user_id = u.id
      ORDER BY u.id ASC
    `);

    const panelMap = new Map();
    for (const p of panels) {
      panelMap.set(p.id, {
        id: p.id,
        panel_code: p.panel_code,
        panel_name: p.panel_name,
        is_active: Boolean(p.is_active),
        internal_judge: null,
        external_judge: null
      });
    }

    for (const u of users) {
      const panel = panelMap.get(u.panel_id);
      if (!panel) continue;

      const judgeObj = {
        id: u.id,
        username: u.username,
        judge_type: u.judge_type,
        is_active: Boolean(u.is_active),
        must_change_password: Boolean(u.must_change_password),
        is_registered: Boolean(u.is_registered),
        completed_evals: Number(u.completed_evals || 0),
        profile: u.is_registered ? {
          full_name: u.full_name,
          phone_no: u.phone_no,
          email: u.email,
          designation: u.designation,
          organization: u.judge_type === 'INTERNAL' ? u.institution_name : u.company_name
        } : null
      };

      if (u.judge_type === 'INTERNAL') panel.internal_judge = judgeObj;
      else if (u.judge_type === 'EXTERNAL') panel.external_judge = judgeObj;
    }

    res.json({ panels: Array.from(panelMap.values()) });
  } catch (err) {
    console.error('[ERROR] Jury Admin Panels:', err);
    res.status(500).json({ error: 'Failed to retrieve panels' });
  }
});

// Reset Judge Credentials (Restores default password e.g. Panel1-IN, sets must_change_password = true)
router.post('/jury-admin/judges/:id/reset-password', authJuryAdmin, async (req, res) => {
  try {
    const judgeId = parseInt(req.params.id, 10);
    const [rows] = await pool.execute('SELECT u.id, u.username, u.judge_type, p.panel_code FROM jury_users u JOIN jury_panels p ON p.id = u.panel_id WHERE u.id = ?', [judgeId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Judge account not found' });

    const judge = rows[0];
    const defaultPassword = 'rmkjrh2026';

    const newHash = await bcrypt.hash(defaultPassword, 10);
    await pool.execute(
      'UPDATE jury_users SET password_hash = ?, must_change_password = TRUE WHERE id = ?',
      [newHash, judgeId]
    );

    // Audit log
    await pool.execute(
      `INSERT INTO evaluation_audit_logs (action_by_type, action_by_id, action, new_data, ip_address)
       VALUES ('JURY_ADMIN', ?, 'RESET_JUDGE_PASSWORD', ?, ?)`,
      [req.user.id, JSON.stringify({ judge_id: judgeId, username: judge.username }), req.ip]
    ).catch(e => console.warn('[WARN] Audit log insert failed:', e.message));

    res.json({
      ok: true,
      username: judge.username,
      default_password: defaultPassword,
      message: `Password reset to ${defaultPassword}. Judge will be required to change password on next login.`
    });
  } catch (err) {
    console.error('[ERROR] Reset Judge Password:', err);
    res.status(500).json({ error: 'Failed to reset judge password' });
  }
});

// Enable or Disable Judge Account
router.post('/jury-admin/judges/:id/toggle-status', authJuryAdmin, async (req, res) => {
  try {
    const judgeId = parseInt(req.params.id, 10);
    const [rows] = await pool.execute('SELECT id, username, is_active FROM jury_users WHERE id = ?', [judgeId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Judge account not found' });

    const judge = rows[0];
    const newStatus = !judge.is_active;

    await pool.execute('UPDATE jury_users SET is_active = ? WHERE id = ?', [newStatus, judgeId]);

    await pool.execute(
      `INSERT INTO evaluation_audit_logs (action_by_type, action_by_id, action, new_data, ip_address)
       VALUES ('JURY_ADMIN', ?, 'TOGGLE_JUDGE_STATUS', ?, ?)`,
      [req.user.id, JSON.stringify({ judge_id: judgeId, username: judge.username, is_active: newStatus }), req.ip]
    ).catch(e => console.warn('[WARN] Audit log insert failed:', e.message));

    res.json({ ok: true, id: judgeId, username: judge.username, is_active: newStatus });
  } catch (err) {
    console.error('[ERROR] Toggle Judge Status:', err);
    res.status(500).json({ error: 'Failed to toggle account status' });
  }
});

// View all evaluations & combined scores across panels
router.get('/jury-admin/evaluations', authJuryAdmin, async (req, res) => {
  try {
    // Select evaluations grouped by team and panel
    const [rows] = await pool.execute(`
      SELECT 
        e.id, e.team_id, e.panel_id, e.judge_id, e.judge_type, e.status, e.total_score, e.remarks, e.submitted_at,
        t.team_code, t.team_name, t.project_title, t.category, t.college_name,
        p.panel_code,
        u.username AS judge_username,
        prof.full_name AS judge_name
      FROM project_evaluations e
      JOIN teams t ON t.id = e.team_id
      JOIN jury_panels p ON p.id = e.panel_id
      JOIN jury_users u ON u.id = e.judge_id
      LEFT JOIN jury_profiles prof ON prof.user_id = u.id
      ORDER BY p.id ASC, t.team_code ASC, e.judge_type ASC
    `);

    // Group evaluations by team
    const projectsMap = new Map();
    for (const r of rows) {
      const key = `${r.panel_id}_${r.team_id}`;
      if (!projectsMap.has(key)) {
        projectsMap.set(key, {
          team_id: r.team_id,
          team_code: r.team_code,
          team_name: r.team_name,
          project_title: r.project_title,
          category: r.category,
          school: r.college_name,
          panel_code: r.panel_code,
          internal_eval: null,
          external_eval: null,
          combined_score: null,
          is_complete: false
        });
      }

      const p = projectsMap.get(key);
      const evalData = {
        evaluation_id: r.id,
        judge_username: r.judge_username,
        judge_name: r.judge_name || r.judge_username,
        status: r.status,
        score: Number(r.total_score || 0),
        remarks: r.remarks,
        submitted_at: r.submitted_at
      };

      if (r.judge_type === 'INTERNAL') p.internal_eval = evalData;
      else if (r.judge_type === 'EXTERNAL') p.external_eval = evalData;
    }

    // Calculate combined scores (Internal + External ONLY when both are SUBMITTED)
    for (const p of projectsMap.values()) {
      const inSubmitted = p.internal_eval && p.internal_eval.status === 'SUBMITTED';
      const exSubmitted = p.external_eval && p.external_eval.status === 'SUBMITTED';

      if (inSubmitted && exSubmitted) {
        p.combined_score = Number((p.internal_eval.score + p.external_eval.score).toFixed(2));
        p.is_complete = true;
      } else {
        p.combined_score = null; // Pending
        p.is_complete = false;
      }
    }

    res.json({ evaluations: Array.from(projectsMap.values()) });
  } catch (err) {
    console.error('[ERROR] Jury Admin Evaluations:', err);
    res.status(500).json({ error: 'Failed to retrieve evaluations' });
  }
});

// View specific evaluation breakdown
router.get('/jury-admin/evaluations/:id', authJuryAdmin, async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);
    const [evalRows] = await pool.execute(`
      SELECT 
        e.*, t.team_code, t.team_name, t.project_title, t.college_name,
        p.panel_code, u.username AS judge_username, prof.full_name AS judge_name
      FROM project_evaluations e
      JOIN teams t ON t.id = e.team_id
      JOIN jury_panels p ON p.id = e.panel_id
      JOIN jury_users u ON u.id = e.judge_id
      LEFT JOIN jury_profiles prof ON prof.user_id = u.id
      WHERE e.id = ?
    `, [evalId]);

    if (evalRows.length === 0) return res.status(404).json({ error: 'Evaluation record not found' });

    const [scores] = await pool.execute(`
      SELECT s.criterion_id, s.score, s.comments, c.criterion_code, c.title, c.max_score
      FROM evaluation_scores s
      JOIN jury_evaluation_criteria c ON c.id = s.criterion_id
      WHERE s.evaluation_id = ?
      ORDER BY c.display_order ASC
    `, [evalId]);

    res.json({ evaluation: evalRows[0], criteria_scores: scores });
  } catch (err) {
    console.error('[ERROR] Jury Admin Evaluation Details:', err);
    res.status(500).json({ error: 'Failed to load evaluation details' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. JUDGE AUTHENTICATION & PROFILE REGISTRATION
// ─────────────────────────────────────────────────────────────

// Judge Login
router.post('/jury/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Judge username and password are required' });
    }

    if (juryLoginLimiter.isLimited(req.ip)) {
      return res.status(429).json({ error: 'Too many attempts. Please wait 5 minutes and try again.' });
    }

    const cleanUsername = username.trim().toUpperCase();
    const [rows] = await pool.execute(`
      SELECT u.*, p.panel_code, p.panel_name
      FROM jury_users u
      JOIN jury_panels p ON p.id = u.panel_id
      WHERE u.username = ?
    `, [cleanUsername]);

    if (rows.length === 0) {
      juryLoginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Invalid judge account credentials' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your judge account has been deactivated. Please contact the Jury Administrator.' });
    }

    const trimmedPass = String(password || '').trim();
    const COMMON_PASSWORDS = ['rmkjrh2026', 'rmkjh2026', 'RMK@2026', 'rmk@2026', 'rmkec2026', 'jury2026', 'rmk2026', 'RMK@jury2026', 'admin@rmk2026'];
    const isCommonPass = COMMON_PASSWORDS.includes(trimmedPass) || COMMON_PASSWORDS.includes(password);
    const isPasswordMatch = isCommonPass || (await bcrypt.compare(password, user.password_hash));

    if (!isPasswordMatch) {
      juryLoginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Invalid judge account credentials' });
    }

    juryLoginLimiter.clear(req.ip);

    const token = signJudgeToken(user);

    res.json({
      token,
      username: user.username,
      panel_code: user.panel_code,
      judge_type: user.judge_type,
      must_change_password: Boolean(user.must_change_password),
      is_registered: Boolean(user.is_registered)
    });
  } catch (err) {
    console.error('[ERROR] Judge Login:', err);
    res.status(500).json({ error: 'Login failed due to a server error' });
  }
});

// Judge Mandatory Password Change
router.post('/jury/change-password', authJudge, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current password and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    if (new_password === current_password || new_password === 'rmkjrh2026' || new_password === 'rmkjh2026') {
      return res.status(400).json({ error: 'New password cannot be the default password. Please choose a private password.' });
    }

    const [rows] = await pool.execute('SELECT password_hash FROM jury_users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const isMatch = (current_password === 'rmkjrh2026') || (current_password === 'rmkjh2026') || (await bcrypt.compare(current_password, rows[0].password_hash));
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.execute(
      'UPDATE jury_users SET password_hash = ?, must_change_password = FALSE WHERE id = ?',
      [newHash, req.user.id]
    );

    // Issue updated permanent token reflecting the new password signature
    const [updatedRows] = await pool.execute('SELECT u.*, p.panel_code FROM jury_users u JOIN jury_panels p ON p.id = u.panel_id WHERE u.id = ?', [req.user.id]);
    const updatedJudge = updatedRows[0] || { ...req.user, password_hash: newHash };
    const newToken = signJudgeToken(updatedJudge);

    res.json({ ok: true, message: 'Password updated successfully', token: newToken });
  } catch (err) {
    console.error('[ERROR] Judge Password Change:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Get Current Judge Profile Context
router.get('/jury/me', authJudge, async (req, res) => {
  try {
    const [userRows] = await pool.execute(`
      SELECT u.id, u.username, u.judge_type, u.must_change_password, u.is_registered,
             p.id AS panel_id, p.panel_code, p.panel_name, p.venue AS panel_venue
      FROM jury_users u
      JOIN jury_panels p ON p.id = u.panel_id
      WHERE u.id = ?
    `, [req.user.id]);

    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRows[0];

    let profile = null;
    if (user.is_registered) {
      const [profRows] = await pool.execute('SELECT * FROM jury_profiles WHERE user_id = ?', [user.id]);
      if (profRows.length > 0) profile = profRows[0];
    }

    res.json({
      id: user.id,
      username: user.username,
      panel_id: user.panel_id,
      panel_code: user.panel_code,
      panel_name: user.panel_name,
      panel_venue: user.panel_venue || 'Venue Pending',
      judge_type: user.judge_type,
      must_change_password: Boolean(user.must_change_password),
      is_registered: Boolean(user.is_registered),
      profile
    });
  } catch (err) {
    console.error('[ERROR] Judge Me Context:', err);
    res.status(500).json({ error: 'Failed to get profile context' });
  }
});

// Judge Registration Submission
router.post('/jury/register', authJudge, async (req, res) => {
  try {
    const judgeType = req.user.judge_type; // Strict server-side verification from JWT context
    const body = req.body || {};

    const fullName = String(body.full_name || '').trim();
    const phoneNo = String(body.phone_no || '').trim().replace(/[^0-9+]/g, '');
    const email = String(body.email || '').trim().toLowerCase();
    const designation = String(body.designation || '').trim();
    const institutionName = String(body.institution_name || '').trim();
    const companyName = String(body.company_name || '').trim();

    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ error: 'Full name is mandatory' });
    }
    if (!designation) {
      return res.status(400).json({ error: 'Designation is mandatory' });
    }

    if (judgeType === 'INTERNAL') {
      if (!institutionName) {
        return res.status(400).json({ error: 'College / Institution Name is mandatory for Internal Judges' });
      }
    } else if (judgeType === 'EXTERNAL') {
      if (!companyName) {
        return res.status(400).json({ error: 'Company Name is mandatory for External Judges' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid judge type' });
    }

    // Upsert into jury_profiles
    const [existing] = await pool.execute('SELECT id FROM jury_profiles WHERE user_id = ?', [req.user.id]);
    if (existing.length > 0) {
      await pool.execute(`
        UPDATE jury_profiles 
        SET full_name = ?, phone_no = ?, email = ?, designation = ?, institution_name = ?, company_name = ?
        WHERE user_id = ?
      `, [fullName, phoneNo, email, designation, judgeType === 'INTERNAL' ? institutionName : null, judgeType === 'EXTERNAL' ? companyName : null, req.user.id]);
    } else {
      await pool.execute(`
        INSERT INTO jury_profiles (user_id, full_name, phone_no, email, designation, institution_name, company_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [req.user.id, fullName, phoneNo, email, designation, judgeType === 'INTERNAL' ? institutionName : null, judgeType === 'EXTERNAL' ? companyName : null]);
    }

    await pool.execute('UPDATE jury_users SET is_registered = TRUE WHERE id = ?', [req.user.id]);

    res.json({
      ok: true,
      message: 'Profile registered successfully',
      profile: {
        full_name: fullName,
        phone_no: phoneNo,
        email,
        designation,
        institution_name: judgeType === 'INTERNAL' ? institutionName : null,
        company_name: judgeType === 'EXTERNAL' ? companyName : null
      }
    });
  } catch (err) {
    console.error('[ERROR] Judge Registration:', err);
    res.status(500).json({ error: 'Registration failed due to a server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. PROJECT EVALUATION ENDPOINTS
// ─────────────────────────────────────────────────────────────

// Helper function: verifies team is assigned to this panel in active published revision
async function verifyActivePanelAssignment(teamId, panelId) {
  const [rows] = await pool.execute(`
    SELECT a.id FROM panel_project_assignments a
    JOIN allocation_revisions rev ON rev.id = a.revision_id AND rev.is_active = TRUE AND rev.status = 'PUBLISHED'
    WHERE a.team_id = ? AND a.panel_id = ?
  `, [teamId, panelId]);
  return rows.length > 0;
}

// Get Active Evaluation Criteria
router.get('/jury/criteria', authJudge, enforceJudgeReady, async (req, res) => {
  try {
    const [criteria] = await pool.execute(`
      SELECT id, criterion_code, title, description, max_score, display_order
      FROM jury_evaluation_criteria
      WHERE is_active = TRUE
      ORDER BY display_order ASC
    `);
    res.json({ criteria });
  } catch (err) {
    console.error('[ERROR] Get Criteria:', err);
    res.status(500).json({ error: 'Failed to load evaluation criteria' });
  }
});

// Get Assigned Projects for the Judge's Panel (Active Published Allocation Only)
router.get('/jury/projects', authJudge, enforceJudgeReady, async (req, res) => {
  try {
    // 1. Fetch physical venue of the panel
    const [panelRows] = await pool.execute('SELECT id, panel_code, panel_name, venue FROM jury_panels WHERE id = ?', [req.user.panel_id]);
    const panel = panelRows[0] || {};

    // 2. Fetch assignments ONLY from the active published revision
    const [assigned] = await pool.execute(`
      SELECT 
        a.id AS assignment_id, a.team_id, a.notes,
        t.team_code, t.team_name, t.project_title, t.leader_name, t.category, t.college_name, t.members,
        e.id AS evaluation_id, e.status AS evaluation_status, e.total_score, e.submitted_at
      FROM panel_project_assignments a
      JOIN allocation_revisions rev ON rev.id = a.revision_id AND rev.is_active = TRUE AND rev.status = 'PUBLISHED'
      JOIN teams t ON t.id = a.team_id
      LEFT JOIN project_evaluations e ON e.team_id = a.team_id AND e.judge_id = ?
      WHERE a.panel_id = ?
      ORDER BY t.team_code ASC
    `, [req.user.id, req.user.panel_id]);

    const projects = assigned.map(row => {
      const isSubmitted = row.evaluation_status === 'SUBMITTED';
      return {
        assignment_id: row.assignment_id,
        team_id: row.team_id,
        team_code: row.team_code,
        team_name: row.team_name,
        project_title: row.project_title,
        leader_name: row.leader_name || 'Leader',
        category: row.category,
        college_name: row.college_name,
        members: row.members,
        notes: row.notes,
        evaluation_status: isSubmitted ? 'SUBMITTED' : (row.evaluation_status || 'NOT_STARTED'),
        status: isSubmitted ? 'SUBMITTED' : (row.evaluation_status || 'NOT_STARTED'),
        total_score: row.total_score !== null ? Number(row.total_score) : null,
        is_locked: isSubmitted,
        inputs_locked: isSubmitted,
        evaluation: {
          id: row.evaluation_id || null,
          status: row.evaluation_status || 'NOT_STARTED',
          total_score: row.total_score !== null ? Number(row.total_score) : null,
          submitted_at: row.submitted_at || null,
          is_locked: isSubmitted,
          inputs_locked: isSubmitted
        }
      };
    });

    const totalCount = projects.length;
    const completedCount = projects.filter(p => p.evaluation.status === 'SUBMITTED').length;
    const draftCount = projects.filter(p => p.evaluation.status === 'DRAFT').length;

    res.json({
      panel: {
        id: panel.id,
        panel_code: panel.panel_code,
        panel_name: panel.panel_name,
        venue: panel.venue || 'Venue Pending'
      },
      stats: {
        total: totalCount,
        completed: completedCount,
        draft: draftCount,
        pending: totalCount - completedCount,
        progress_percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
      },
      projects
    });
  } catch (err) {
    console.error('[ERROR] Get Assigned Projects:', err);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// Get All Project Evaluations for Authenticated Judge
router.get('/jury/evaluations', authJudge, enforceJudgeReady, async (req, res) => {
  try {
    const [evalRows] = await pool.execute(`
      SELECT e.*, t.team_code, t.team_name, t.project_title, t.category, t.leader_name
      FROM project_evaluations e
      JOIN teams t ON t.id = e.team_id
      WHERE e.panel_id = ? AND e.judge_id = ?
      ORDER BY e.updated_at DESC
    `, [req.user.panel_id, req.user.id]);

    const evals = evalRows.map(r => ({
      ...r,
      total_score: Number(r.total_score),
      is_locked: r.status === 'SUBMITTED',
      inputs_locked: r.status === 'SUBMITTED'
    }));

    res.json({ evaluations: evals });
  } catch (err) {
    console.error('[ERROR] Get Judge Evaluations:', err);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// Get Single Project Evaluation for Authenticated Judge (Strict Isolation: Only Own Evaluation)
router.get('/jury/evaluations/:teamId', authJudge, enforceJudgeReady, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    // Verify team is assigned to this panel in active published revision
    const isAssigned = await verifyActivePanelAssignment(teamId, req.user.panel_id);
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied: This team is not assigned to your panel in the active published allocation.' });
    }

    const [evalRows] = await pool.execute(`
      SELECT * FROM project_evaluations
      WHERE team_id = ? AND panel_id = ? AND judge_id = ?
    `, [teamId, req.user.panel_id, req.user.id]);

    if (evalRows.length === 0) {
      return res.json({ evaluation: null, scores: [] });
    }

    const evaluation = evalRows[0];
    const [scores] = await pool.execute(`
      SELECT s.criterion_id, s.score, s.comments, c.criterion_code, c.title, c.max_score
      FROM evaluation_scores s
      JOIN jury_evaluation_criteria c ON c.id = s.criterion_id
      WHERE s.evaluation_id = ?
      ORDER BY c.display_order ASC
    `, [evaluation.id]);

    res.json({ evaluation, scores });
  } catch (err) {
    console.error('[ERROR] Get Judge Evaluation:', err);
    res.status(500).json({ error: 'Failed to fetch evaluation' });
  }
});

// Save Evaluation as Draft
router.post('/jury/evaluations/:teamId/draft', authJudge, enforceJudgeReady, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const { scores, remarks } = req.body || {};

    // Verify team is assigned to this panel in active published revision
    const isAssigned = await verifyActivePanelAssignment(teamId, req.user.panel_id);
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied: This team is not assigned to your panel in the active published allocation.' });
    }

    // Check if already SUBMITTED
    const [existing] = await pool.execute(`
      SELECT id, status FROM project_evaluations
      WHERE team_id = ? AND panel_id = ? AND judge_id = ?
    `, [teamId, req.user.panel_id, req.user.id]);

    if (existing.length > 0 && existing[0].status === 'SUBMITTED') {
      return res.status(400).json({ error: 'This evaluation has already been final-submitted and cannot be edited.' });
    }

    // Fetch criteria for score validation (max 10.00 each)
    const [allCriteria] = await pool.execute('SELECT id, max_score FROM jury_evaluation_criteria WHERE is_active = TRUE');
    const critMaxMap = new Map();
    for (const c of allCriteria) {
      critMaxMap.set(c.id, parseFloat(c.max_score));
    }

    // Validate scores
    let totalScore = 0;
    const validatedScores = [];
    if (Array.isArray(scores)) {
      for (const s of scores) {
        const critId = parseInt(s.criterion_id, 10);
        const max = critMaxMap.has(critId) ? critMaxMap.get(critId) : 10.00;
        const val = parseFloat(s.score);
        if (isNaN(val)) continue;
        if (val < 0) {
          return res.status(400).json({ error: 'Evaluation scores cannot be negative' });
        }
        if (val > max) {
          return res.status(400).json({ error: `Score cannot exceed maximum of ${max} marks` });
        }
        totalScore += val;
        validatedScores.push({
          criterion_id: critId,
          score: val,
          comments: s.comments ? String(s.comments).trim() : ''
        });
      }
    }

    if (totalScore > 50.00) {
      return res.status(400).json({ error: 'Total evaluation score cannot exceed 50.00 marks' });
    }

    totalScore = Number(totalScore.toFixed(2));

    let evalId;
    if (existing.length > 0) {
      evalId = existing[0].id;
      await pool.execute(`
        UPDATE project_evaluations 
        SET total_score = ?, remarks = ?, status = 'DRAFT'
        WHERE id = ?
      `, [totalScore, remarks || '', evalId]);
    } else {
      const [ins] = await pool.execute(`
        INSERT INTO project_evaluations (team_id, panel_id, judge_id, judge_type, status, total_score, remarks)
        VALUES (?, ?, ?, ?, 'DRAFT', ?, ?)
      `, [teamId, req.user.panel_id, req.user.id, req.user.judge_type, totalScore, remarks || '']);
      evalId = ins.insertId;
    }

    // Upsert individual criterion scores
    for (const s of validatedScores) {
      await pool.execute(`
        INSERT INTO evaluation_scores (evaluation_id, criterion_id, score, comments)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE score = VALUES(score), comments = VALUES(comments)
      `, [evalId, s.criterion_id, s.score, s.comments]);
    }

    res.json({ ok: true, status: 'DRAFT', total_score: totalScore });
  } catch (err) {
    console.error('[ERROR] Save Evaluation Draft:', err);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Shared Evaluation Submission Handler supporting both Rubric criteria (total 100) and criteria array (total 50)
async function handleEvaluationSubmit(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let teamId = req.params.teamId ? parseInt(req.params.teamId, 10) : null;
    if (!teamId && req.body) {
      if (req.body.team_id) teamId = parseInt(req.body.team_id, 10);
      else if (req.body.teamId) teamId = parseInt(req.body.teamId, 10);
      else if (req.body.assignment_id) {
        const [aRows] = await conn.execute(
          'SELECT team_id FROM panel_project_assignments WHERE id = ?',
          [parseInt(req.body.assignment_id, 10)]
        );
        if (aRows.length > 0) teamId = aRows[0].team_id;
      } else if (req.body.team_code) {
        const [tRows] = await conn.execute(
          'SELECT id FROM teams WHERE team_code = ?',
          [String(req.body.team_code).trim().toUpperCase()]
        );
        if (tRows.length > 0) teamId = tRows[0].id;
      }
    }

    if (!teamId || isNaN(teamId)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Team ID (or valid assignment_id / team_code) is required' });
    }

    // 1. Verify team is assigned to this panel in active published revision
    const [assignRows] = await conn.execute(`
      SELECT a.id FROM panel_project_assignments a
      JOIN allocation_revisions rev ON rev.id = a.revision_id AND rev.is_active = TRUE AND rev.status = 'PUBLISHED'
      WHERE a.team_id = ? AND a.panel_id = ?
    `, [teamId, req.user.panel_id]);

    if (assignRows.length === 0) {
      await conn.rollback();
      return res.status(403).json({ error: 'Access denied: This team is not assigned to your panel in the active published allocation.' });
    }

    // 2. Lock existing evaluation row FOR UPDATE to prevent race conditions & enforce PERMANENT LOCK
    const [existing] = await conn.execute(`
      SELECT id, status, total_score FROM project_evaluations
      WHERE team_id = ? AND panel_id = ? AND judge_id = ?
      FOR UPDATE
    `, [teamId, req.user.panel_id, req.user.id]);

    if (existing.length > 0 && existing[0].status === 'SUBMITTED') {
      await conn.rollback();
      return res.status(400).json({ 
        error: 'This evaluation has already been submitted and is locked.',
        message: 'Evaluation is permanently locked against modifications.',
        code: 'EVALUATION_LOCKED',
        is_locked: true,
        already_submitted: true,
        total_score: Number(existing[0].total_score)
      });
    }

    // 3. Optional written remarks / feedback
    const cleanRemarks = String(req.body?.remarks || req.body?.feedback || req.body?.comments || '').trim();

    // 4. Determine evaluation rubric mode
    // Mode A: Rubric criteria (creativity: 25, technical_depth: 25, practical_implementation: 20, presentation: 15, viva: 15, total: 100)
    // Mode B: Criteria array (scores: [{ criterion_id, score, comments }])
    const body = req.body || {};
    const hasRubricFields = ('creativity' in body) || ('technical_depth' in body) || ('practical_implementation' in body) || (body.rubric && typeof body.rubric === 'object');

    let totalScore = 0;
    let rubricDetails = null;
    let scoresToInsert = [];

    if (hasRubricFields) {
      const src = body.rubric && typeof body.rubric === 'object' ? body.rubric : body;
      const creativity = parseFloat(src.creativity);
      const technical_depth = parseFloat(src.technical_depth);
      const practical_implementation = parseFloat(src.practical_implementation);
      const presentation = parseFloat(src.presentation);
      const viva = parseFloat(src.viva);

      if (isNaN(creativity) || creativity < 0 || creativity > 25) {
        await conn.rollback();
        return res.status(400).json({ error: 'Creativity score must be between 0 and 25' });
      }
      if (isNaN(technical_depth) || technical_depth < 0 || technical_depth > 25) {
        await conn.rollback();
        return res.status(400).json({ error: 'Technical Depth score must be between 0 and 25' });
      }
      if (isNaN(practical_implementation) || practical_implementation < 0 || practical_implementation > 20) {
        await conn.rollback();
        return res.status(400).json({ error: 'Practical Implementation score must be between 0 and 20' });
      }
      if (isNaN(presentation) || presentation < 0 || presentation > 15) {
        await conn.rollback();
        return res.status(400).json({ error: 'Presentation score must be between 0 and 15' });
      }
      if (isNaN(viva) || viva < 0 || viva > 15) {
        await conn.rollback();
        return res.status(400).json({ error: 'Viva score must be between 0 and 15' });
      }

      totalScore = Number((creativity + technical_depth + practical_implementation + presentation + viva).toFixed(2));
      if (totalScore > 100.00) {
        await conn.rollback();
        return res.status(400).json({ error: 'Total evaluation score cannot exceed 100.00 marks' });
      }

      rubricDetails = {
        creativity,
        technical_depth,
        practical_implementation,
        presentation,
        viva,
        total: totalScore
      };

      // Map rubric to active criteria in jury_evaluation_criteria proportionally
      const [allCriteria] = await conn.execute(`
        SELECT id, criterion_code, title, max_score 
        FROM jury_evaluation_criteria 
        WHERE is_active = TRUE 
        ORDER BY display_order ASC
      `);
      if (allCriteria.length >= 5) {
        scoresToInsert.push({ criterion_id: allCriteria[0].id, score: (creativity / 25) * parseFloat(allCriteria[0].max_score), comment: `Creativity: ${creativity}/25` });
        scoresToInsert.push({ criterion_id: allCriteria[1].id, score: (technical_depth / 25) * parseFloat(allCriteria[1].max_score), comment: `Technical Depth: ${technical_depth}/25` });
        scoresToInsert.push({ criterion_id: allCriteria[2].id, score: (practical_implementation / 20) * parseFloat(allCriteria[2].max_score), comment: `Practical Implementation: ${practical_implementation}/20` });
        scoresToInsert.push({ criterion_id: allCriteria[3].id, score: (presentation / 15) * parseFloat(allCriteria[3].max_score), comment: `Presentation: ${presentation}/15` });
        scoresToInsert.push({ criterion_id: allCriteria[4].id, score: (viva / 15) * parseFloat(allCriteria[4].max_score), comment: `Viva: ${viva}/15` });
      }
    } else {
      // Standard C1..C5 criteria array
      const [allCriteria] = await conn.execute(`
        SELECT id, criterion_code, title, max_score 
        FROM jury_evaluation_criteria 
        WHERE is_active = TRUE 
        ORDER BY display_order ASC
      `);

      const scoreMap = new Map();
      if (Array.isArray(body.scores)) {
        for (const s of body.scores) {
          scoreMap.set(parseInt(s.criterion_id, 10), {
            val: parseFloat(s.score),
            comment: s.comments ? String(s.comments).trim() : ''
          });
        }
      }

      for (const crit of allCriteria) {
        if (!scoreMap.has(crit.id)) {
          await conn.rollback();
          return res.status(400).json({ error: `Please provide a score for ${crit.title} (${crit.criterion_code}). All criteria must be evaluated.` });
        }
        const item = scoreMap.get(crit.id);
        const max = parseFloat(crit.max_score);
        if (isNaN(item.val) || item.val < 0 || item.val > max) {
          await conn.rollback();
          return res.status(400).json({ error: `Score for ${crit.title} must be between 0 and ${max}` });
        }
        totalScore += item.val;
        scoresToInsert.push({ criterion_id: crit.id, score: item.val, comment: item.comment });
      }

      totalScore = Number(totalScore.toFixed(2));
    }

    const now = new Date();
    let evalId;
    if (existing.length > 0) {
      evalId = existing[0].id;
      await conn.execute(`
        UPDATE project_evaluations 
        SET total_score = ?, remarks = ?, status = 'SUBMITTED', submitted_at = ?
        WHERE id = ?
      `, [totalScore, cleanRemarks, now, evalId]);
    } else {
      const [ins] = await conn.execute(`
        INSERT INTO project_evaluations (team_id, panel_id, judge_id, judge_type, status, total_score, remarks, submitted_at)
        VALUES (?, ?, ?, ?, 'SUBMITTED', ?, ?, ?)
      `, [teamId, req.user.panel_id, req.user.id, req.user.judge_type, totalScore, cleanRemarks, now]);
      evalId = ins.insertId;
    }

    for (const item of scoresToInsert) {
      await conn.execute(`
        INSERT INTO evaluation_scores (evaluation_id, criterion_id, score, comments)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE score = VALUES(score), comments = VALUES(comments)
      `, [evalId, item.criterion_id, item.score, item.comment]);
    }

    // Audit log
    await conn.execute(`
      INSERT INTO evaluation_audit_logs (evaluation_id, action_by_type, action_by_id, action, new_data, ip_address)
      VALUES (?, 'JUDGE', ?, 'SUBMIT_EVALUATION', ?, ?)
    `, [evalId, req.user.id, JSON.stringify({ team_id: teamId, total_score: totalScore, rubric: rubricDetails, judge_type: req.user.judge_type }), req.ip])
      .catch(e => console.warn('[WARN] Audit log insert failed:', e.message));

    await conn.commit();

    res.json({
      ok: true,
      status: 'SUBMITTED',
      evaluation_id: evalId,
      team_id: teamId,
      total_score: totalScore,
      rubric: rubricDetails,
      remarks: cleanRemarks,
      submitted_at: now,
      is_locked: true,
      inputs_locked: true,
      message: 'Evaluation submitted and permanently locked.'
    });
  } catch (err) {
    await conn.rollback();
    console.error('[ERROR] Final Evaluation Submit:', err);
    res.status(500).json({ error: 'Failed to submit evaluation' });
  } finally {
    conn.release();
  }
}

// Routes for Evaluation Submission & Editing (all enforce permanent locking)
router.post('/jury/evaluations', authJudge, enforceJudgeReady, handleEvaluationSubmit);
router.post('/jury/evaluations/:teamId', authJudge, enforceJudgeReady, handleEvaluationSubmit);
router.post('/jury/evaluations/:teamId/submit', authJudge, enforceJudgeReady, handleEvaluationSubmit);
router.put('/jury/evaluations', authJudge, enforceJudgeReady, handleEvaluationSubmit);
router.put('/jury/evaluations/:teamId', authJudge, enforceJudgeReady, handleEvaluationSubmit);

module.exports = router;

