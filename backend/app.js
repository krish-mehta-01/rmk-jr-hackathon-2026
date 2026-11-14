// Build: v20261113_r19_themewise_filter_and_exports - Themewise filtering in Venue menu and Themewise PDF, Word, Excel exports
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
// Express app: API routes plus the static frontend. (Build: v20261111_r10_clean_url_no_https)
// exported to Vercel as a serverless function by api/index.js.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('./db');
const { signAdminToken, signTeamToken, requireRole } = require('./auth-helper');
const { generateVenueExcel, findVenueDocx, findVenueExcel, findVenuePdf } = require('./venue-export');
const { generateThemeExcel, findThemeDocx, findThemeExcel, findThemePdf } = require('./theme-export');
const {
  buildMasterAttendanceDocx,
  buildVenueAttendanceDocx,
  buildThemeAttendanceDocx
} = require('./attendance-doc-service');
const {
  buildMasterAttendancePdf,
  buildVenueAttendancePdf,
  buildThemeAttendancePdf
} = require('./attendance-pdf-service');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

// 64-digit code encoded in the venue QR. Kept only in .env so it never ships with the source.
const PRESENCE_QR_CODE_64 = (process.env.QR_PRESENCE_CODE_64 || '').trim();

if (!JWT_SECRET) {
  console.error('[ERROR] JWT_SECRET is not set in backend/.env');
  process.exit(1);
}
if (!/^\d{64}$/.test(PRESENCE_QR_CODE_64)) {
  console.error('[ERROR] QR_PRESENCE_CODE_64 in backend/.env must be exactly 64 digits');
  process.exit(1);
}

// Public address encoded in the venue QR
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://rmkjuniorhackathon2026.onrender.com').replace(/\/+$/, '');

// Clean mobile number to standard 10 digits
function cleanMobile(raw) {
  if (!raw) return '';
  let str = String(raw).trim().replace(/[^0-9]/g, '');
  if (str.startsWith('91') && str.length === 12) {
    str = str.slice(2);
  } else if (str.startsWith('0') && str.length === 11) {
    str = str.slice(1);
  } else if (str.length > 10) {
    str = str.slice(-10);
  }
  return str;
}

// Timing-safe comparison against the venue QR code
function verifyPresenceCode(input) {
  if (!input || typeof input !== 'string') return false;
  const clean = input.trim();
  if (!/^\d{64}$/.test(clean)) return false;
  return crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(PRESENCE_QR_CODE_64));
}

// Failed-attempt limiter: `max` failures per key within `windowMs`
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

// Login is keyed by IP; generous because every phone on the venue Wi-Fi shares one public IP
const loginLimiter = createLimiter(100, 5 * 60 * 1000);
// Scans are keyed by team, so one team's bad scans never block other teams
const scanLimiter = createLimiter(5, 60 * 1000);

// Fields a team leader is allowed to see about their own team
function teamPassView(team) {
  return {
    id: team.id,
    team_code: team.team_code,
    team_name: team.team_name,
    leader_name: team.leader_name,
    college_name: team.college_name,
    project_title: team.project_title,
    members: team.members,
    mentor_name: team.mentor_name,
    theme: team.category,
    panel_no: team.panel_no || null,
    venue: team.venue || null,
    is_present: Boolean(team.is_present),
    check_in_time: team.check_in_time
  };
}

// venue = the sitting place for the team's theme (theme_venues table)
const TEAM_PASS_COLUMNS = 'id, team_code, team_name, leader_name, college_name, project_title, members, mentor_name, category, panel_no, '
  + 'COALESCE(venue, (SELECT venue FROM theme_venues v WHERE v.theme = teams.category)) AS venue, is_present, check_in_time';

// On Render/Vercel the app sits behind a proxy; use the client IP it forwards
if (process.env.RENDER || process.env.VERCEL) app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());
// Phones reopen the page often: images and the scanner library are cached for a day, the app
// code for 5 minutes (so a fix still reaches phones quickly), and the page itself is always rechecked
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  setHeaders(res, filePath) {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=86400');
    else if (/\.(js|css)$/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=300');
    else res.setHeader('Cache-Control', 'no-cache');
  }
}));

// ─────────────────────────────────────────────
// JWT Middleware & Auth
// ─────────────────────────────────────────────
const authAdmin = requireRole('admin');
const authTeam = requireRole('team');

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (loginLimiter.isLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });

    const [rows] = await pool.execute('SELECT * FROM admins WHERE username = ?', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      loginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    loginLimiter.clear(req.ip);
    const role = admin.role || (admin.username === 'RMK@123' || admin.username === 'instituteadmin' ? 'institute_admin' : 'admin');
    const token = signAdminToken(admin);
    res.json({ token, name: admin.name, username: admin.username, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Team Leader Login: official TEAM ID plus the team leader's registered phone number.
// The TEAM ID identifies the team (phone numbers can be shared by several teams); the phone confirms it.
app.post('/api/team/login', async (req, res) => {
  try {
    const teamCode = String(req.body.team_id || '').trim().toUpperCase().replace(/\s+/g, '');
    let phone = String(req.body.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (phone.length === 9) phone = '0' + phone;
    if (!teamCode || phone.length !== 10) {
      return res.status(400).json({ error: 'Enter your Team ID and the 10-digit team leader phone number.' });
    }
    if (loginLimiter.isLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });

    const [matches] = await pool.execute(
      `SELECT ${TEAM_PASS_COLUMNS}, mobile_no FROM teams WHERE team_code = ? AND mobile_no = ?`,
      [teamCode, phone]
    );
    if (matches.length === 0) {
      loginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Team ID and phone number do not match. Please check both.' });
    }

    loginLimiter.clear(req.ip);
    const team = matches[0];
    const token = signTeamToken(team);
    res.json({ token, team: teamPassView(team) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// On-Spot Registration (Public for Walk-in Teams scanning Registration QR Standee)
// Creates team in DB, auto-allocates optimal panel & venue for their theme,
// links them to the active published jury revision, marks presence (is_present = TRUE),
// and returns their live authentication token + team pass view immediately.
app.post('/api/public/on-spot-register', async (req, res) => {
  try {
    const {
      team_name,
      leader_name,
      mobile_no,
      email,
      college_name,
      project_title,
      category,
      members,
      mentor_name,
      mentor_contact,
      mentor_email
    } = req.body;

    const cleanPhone = cleanMobile(mobile_no);
    if (!team_name || !String(team_name).trim()) {
      return res.status(400).json({ error: 'Team Name is required.' });
    }
    if (!leader_name || !String(leader_name).trim()) {
      return res.status(400).json({ error: 'Team Leader Name is required.' });
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Valid 10-digit Leader Mobile Number is required.' });
    }
    if (!college_name || !String(college_name).trim()) {
      return res.status(400).json({ error: 'School / Institution Name is required.' });
    }
    if (!project_title || !String(project_title).trim()) {
      return res.status(400).json({ error: 'Project Title is required.' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ error: 'Hackathon Theme is required.' });
    }

    // 1. Duplicate check (phone and team name + school)
    const [existing] = await pool.query(
      'SELECT id, team_code, team_name, leader_name FROM teams WHERE mobile_no = ? OR (team_name = ? AND college_name = ?)',
      [cleanPhone, team_name.trim(), college_name.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        error: `A team with this mobile number or name is already registered (Team ID: ${existing[0].team_code}, Team: ${existing[0].team_name}). Please log in instead.`
      });
    }

    // 2. Fetch active published revision
    const [revRows] = await pool.query(
      "SELECT id, revision_number FROM allocation_revisions WHERE status = 'PUBLISHED' AND is_active = TRUE LIMIT 1"
    );
    const activeRevisionId = revRows[0]?.id || 120004;

    // 3. Auto-allocate optimal Panel & Venue based on Theme
    const [themeVenueRows] = await pool.query('SELECT venue FROM theme_venues WHERE theme = ? LIMIT 1', [category.trim()]);
    const defaultVenue = themeVenueRows[0]?.venue || 'Main Auditorium (RJ Block)';

    const [matchingPanels] = await pool.query(`
      SELECT p.id, p.venue, COUNT(a.id) as team_count
      FROM jury_panels p
      LEFT JOIN panel_project_assignments a ON a.panel_id = p.id AND a.revision_id = ?
      WHERE p.id IN (SELECT DISTINCT panel_no FROM teams WHERE category = ? AND panel_no IS NOT NULL)
      GROUP BY p.id, p.venue
      ORDER BY team_count ASC, p.id ASC
      LIMIT 1
    `, [activeRevisionId, category.trim()]);

    let assignedPanelNo = 15; // default fallback overflow panel
    let assignedVenue = defaultVenue;

    if (matchingPanels.length > 0) {
      assignedPanelNo = matchingPanels[0].id;
      assignedVenue = matchingPanels[0].venue || defaultVenue;
    } else {
      const [venuePanels] = await pool.query(`
        SELECT p.id, p.venue, COUNT(a.id) as team_count
        FROM jury_panels p
        LEFT JOIN panel_project_assignments a ON a.panel_id = p.id AND a.revision_id = ?
        WHERE p.venue = ?
        GROUP BY p.id, p.venue
        ORDER BY team_count ASC, p.id ASC
        LIMIT 1
      `, [activeRevisionId, defaultVenue]);
      if (venuePanels.length > 0) {
        assignedPanelNo = venuePanels[0].id;
        assignedVenue = venuePanels[0].venue;
      }
    }

    // 4. Auto-generate next sequential Team Code (RMKJH261XXX)
    const [maxCodeRows] = await pool.query(
      "SELECT team_code FROM teams WHERE team_code LIKE 'RMKJH261%' ORDER BY id DESC"
    );
    let maxNum = 295;
    for (const row of maxCodeRows) {
      const m = row.team_code && row.team_code.match(/RMKJH261(\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextTeamCode = `RMKJH261${String(maxNum + 1).padStart(3, '0')}`;
    const teamUuid = crypto.randomUUID();

    // Format members list (include leader at start if not already there)
    let membersText = String(members || '').trim();
    if (!membersText) {
      membersText = leader_name.trim();
    } else if (!membersText.toLowerCase().includes(leader_name.trim().toLowerCase())) {
      membersText = `${leader_name.trim()}, ${membersText}`;
    }

    // 5. Insert into teams table with is_present = TRUE and check_in_time = NOW()
    const [insRes] = await pool.execute(`
      INSERT INTO teams (
        team_uuid, team_code, team_name, leader_name, mobile_no, email,
        college_name, project_title, category, members, mentor_name,
        mentor_contact, mentor_email, is_present, check_in_time, marked_by, panel_no, venue
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), 'On-Spot Self Check-in', ?, ?)
    `, [
      teamUuid,
      nextTeamCode,
      team_name.trim(),
      leader_name.trim(),
      cleanPhone,
      email ? String(email).trim() : null,
      college_name.trim(),
      project_title.trim(),
      category.trim(),
      membersText,
      mentor_name ? String(mentor_name).trim() : null,
      mentor_contact ? cleanMobile(mentor_contact) : null,
      mentor_email ? String(mentor_email).trim() : null,
      assignedPanelNo,
      assignedVenue
    ]);
    const newTeamId = insRes.insertId;

    // 6. Automatically assign into active published jury revision
    try {
      await pool.execute(`
        INSERT INTO panel_project_assignments (
          revision_id, panel_id, team_id, assigned_at, notes
        ) VALUES (?, ?, ?, NOW(), 'On-Spot Registration at Helpdesk')
      `, [activeRevisionId, assignedPanelNo, newTeamId]);
    } catch (assignErr) {
      console.warn('[WARN] Could not link on-spot team to allocation revision:', assignErr.message);
    }

    // 7. Fetch newly inserted team with pass columns
    const [newTeamRows] = await pool.query(
      `SELECT ${TEAM_PASS_COLUMNS}, mobile_no FROM teams WHERE id = ?`,
      [newTeamId]
    );
    const newTeam = newTeamRows[0];
    const token = signTeamToken(newTeam);

    console.log(`[ON-SPOT REGISTRATION] Registered Team "${newTeam.team_name}" (${newTeam.team_code}) -> Panel ${assignedPanelNo}, Venue: "${assignedVenue}". Attendance marked PRESENT.`);

    return res.status(201).json({
      success: true,
      message: 'Registration and attendance marked successfully!',
      token,
      team: teamPassView(newTeam)
    });
  } catch (err) {
    console.error('[ERROR] On-spot registration failed:', err);
    return res.status(500).json({ error: 'Server error during on-spot registration: ' + err.message });
  }
});

// On-Spot Registration Standee QR code image (Public or Admin)
app.get('/api/public/on-spot-qr-code', async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const qrImage = await QRCode.toDataURL(`${PUBLIC_URL}/#on-spot`, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    res.json({ qr_code: qrImage, url: `${PUBLIC_URL}/#on-spot` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate on-spot registration QR code' });
  }
});

// ─────────────────────────────────────────────
// QR CODE ROUTES
// ─────────────────────────────────────────────

// Hackathon Day venue QR image (Admin only)
app.get('/api/admin/qr-code', authAdmin, async (req, res) => {
  try {
    // The QR holds a link to the site with the venue code after '#', so a phone's own camera app opens
    // the portal (which then marks presence) instead of showing a bare number
    const QRCode = require('qrcode');
    const qrImage = await QRCode.toDataURL(`${PUBLIC_URL}/#p=${PRESENCE_QR_CODE_64}`, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    res.json({ qr_code: qrImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate presence QR code' });
  }
});

// Mark presence by scanning the venue QR (Team Leader)
app.post('/api/team/mark-attendance', authTeam, async (req, res) => {
  try {
    const { qr_value } = req.body;
    const teamDbId = req.user.id;

    if (scanLimiter.isLimited(teamDbId)) {
      return res.status(429).json({ error: 'Too many invalid scans. Please wait 1 minute and try again.' });
    }

    if (!verifyPresenceCode(qr_value)) {
      scanLimiter.fail(teamDbId);
      return res.status(400).json({ error: 'This is not the hackathon QR code. Please scan the official venue QR.' });
    }
    scanLimiter.clear(teamDbId);

    const [existing] = await pool.execute(`SELECT ${TEAM_PASS_COLUMNS} FROM teams WHERE id = ?`, [teamDbId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Team record not found' });

    const team = existing[0];
    if (team.is_present) {
      return res.json({ success: true, already_marked: true, team: teamPassView(team) });
    }

    const checkInTime = new Date();
    const verificationToken = crypto.createHmac('sha256', PRESENCE_QR_CODE_64).update(String(team.id)).digest('hex');

    await pool.execute(
      'UPDATE teams SET is_present = TRUE, check_in_time = ?, qr_verification_token = ?, marked_by = ? WHERE id = ? AND (is_present = FALSE OR is_present IS NULL)',
      [checkInTime, verificationToken, "QR Scan", teamDbId]
    );

    const codeHash = crypto.createHash('sha256').update(qr_value.trim()).digest('hex');
    pool.execute(
      'INSERT INTO attendance_log (team_id_fk, team_name, leader_name, check_in_time, qr_code_value, qr_verification_token, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [team.id, team.team_name, team.leader_name, checkInTime, codeHash, verificationToken, req.ip]
    ).catch(err => console.error('[WARN] attendance_log insert failed:', err.message));

    res.json({
      success: true,
      already_marked: false,
      team: teamPassView({ ...team, is_present: true, check_in_time: checkInTime })
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while marking presence' });
  }
});

// Team's own status
app.get('/api/team/status', authTeam, async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT ${TEAM_PASS_COLUMNS} FROM teams WHERE id = ?`, [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json(teamPassView(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// Get all teams with presence status
app.get('/api/admin/teams', authAdmin, async (req, res) => {
  try {
    const { search, present } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);

    let where = ' WHERE 1=1';
    const params = [];
    if (search && search.trim()) {
      const cleanTokens = search
        .replace(/[.,\-_/\\#()]/g, ' ')
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (cleanTokens.length > 0) {
        for (const token of cleanTokens) {
          where += ` AND CONCAT_WS(' ', LOWER(team_code), LOWER(team_name), LOWER(leader_name), LOWER(IFNULL(members, '')), LOWER(IFNULL(mentor_name, '')), LOWER(IFNULL(college_name, '')), LOWER(IFNULL(project_title, '')), LOWER(IFNULL(category, '')), LOWER(IFNULL(mobile_no, '')), LOWER(IFNULL(panel_no, '')), LOWER(IFNULL(venue, ''))) LIKE ?`;
          params.push(`%${token}%`);
        }
      }
    }
    if (present === 'true') where += ' AND is_present = TRUE';
    else if (present === 'false') where += ' AND (is_present = FALSE OR is_present IS NULL)';

    const [rows] = await pool.execute(
      'SELECT id, team_code, team_name, leader_name, mobile_no, college_name, project_title, members, mentor_name, category, panel_no, venue, is_present, check_in_time, marked_by FROM teams' +
        where +
        ` ORDER BY is_present DESC, check_in_time DESC, team_code ASC, id ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    );
    const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM teams' + where, params);

    res.json({ teams: rows, total: countRows[0].total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Teams grouped venue-wise (15 Rooms) and theme-wise (12 Tracks)
async function getThemesAndVenuesData(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT t.id, t.team_code, t.team_name, t.leader_name, t.mobile_no, t.college_name, t.project_title, t.members, t.mentor_name, t.category, t.is_present, t.check_in_time, t.marked_by, t.panel_no, t.venue
       FROM teams t
       ORDER BY t.panel_no ASC, t.category ASC, t.team_code ASC`
    );

    // 1. Group by Venue (15 Panels / Rooms)
    const venuesMap = new Map();
    for (let p = 1; p <= 15; p++) {
      venuesMap.set(p, { panel_no: p, venue: '', themes: new Set(), total: 0, scanned: 0, teams: [] });
    }
    for (const r of rows) {
      const p = r.panel_no || 1;
      if (!venuesMap.has(p)) {
        venuesMap.set(p, { panel_no: p, venue: r.venue || 'TBD', themes: new Set(), total: 0, scanned: 0, teams: [] });
      }
      const vGroup = venuesMap.get(p);
      if (r.venue) vGroup.venue = r.venue;
      if (r.category) vGroup.themes.add(r.category);
      vGroup.total++;
      if (r.is_present) vGroup.scanned++;
      vGroup.teams.push({
        id: r.id,
        team_code: r.team_code,
        team_name: r.team_name,
        leader_name: r.leader_name,
        mobile_no: r.mobile_no,
        college_name: r.college_name,
        project_title: r.project_title,
        members: r.members,
        mentor_name: r.mentor_name,
        category: r.category,
        panel_no: r.panel_no,
        venue: r.venue,
        is_present: Boolean(r.is_present),
        check_in_time: r.check_in_time,
        marked_by: r.marked_by
      });
    }

    const venues = [...venuesMap.values()].map(v => ({
      ...v,
      themes: [...v.themes]
    }));

    // 2. Group by Theme Track (12 Tracks)
    const themesMap = new Map();
    for (const r of rows) {
      const name = r.category || 'No theme';
      if (!themesMap.has(name)) {
        themesMap.set(name, { theme: name, venue: r.venue || null, total: 0, scanned: 0, teams: [] });
      }
      const tGroup = themesMap.get(name);
      tGroup.total++;
      if (r.is_present) tGroup.scanned++;
      tGroup.teams.push({
        id: r.id,
        team_code: r.team_code,
        team_name: r.team_name,
        leader_name: r.leader_name,
        mobile_no: r.mobile_no,
        college_name: r.college_name,
        project_title: r.project_title,
        members: r.members,
        mentor_name: r.mentor_name,
        category: r.category,
        panel_no: r.panel_no,
        venue: r.venue,
        is_present: Boolean(r.is_present),
        check_in_time: r.check_in_time,
        marked_by: r.marked_by
      });
    }

    res.json({ venues, themes: [...themesMap.values()] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

app.get('/api/admin/themes', authAdmin, getThemesAndVenuesData);
app.get('/api/admin/venues', authAdmin, getThemesAndVenuesData);

// Update sitting place (venue) for a theme
app.post('/api/admin/themes/venue', authAdmin, async (req, res) => {
  const { theme, venue } = req.body || {};
  if (!theme || typeof theme !== 'string' || !theme.trim()) {
    return res.status(400).json({ error: 'Theme name is required' });
  }
  const cleanTheme = theme.trim();
  const cleanVenue = venue && typeof venue === 'string' && venue.trim() ? venue.trim() : null;

  try {
    await pool.execute(
      'INSERT INTO theme_venues (theme, venue) VALUES (?, ?) ON DUPLICATE KEY UPDATE venue = VALUES(venue)',
      [cleanTheme, cleanVenue]
    );
    res.json({ ok: true, theme: cleanTheme, venue: cleanVenue });
  } catch (err) {
    console.error('[ERROR] Failed to update theme venue:', err);
    res.status(500).json({ error: 'Failed to update theme sitting place' });
  }
});

// Dashboard stats
app.get('/api/admin/stats', authAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.execute('SELECT COUNT(*) AS total, COALESCE(SUM(is_present = TRUE), 0) AS present FROM teams');
    const total = Number(row.total);
    const present = Number(row.present);
    res.json({
      total,
      present,
      absent: total - present,
      attendance_rate: total > 0 ? ((present / total) * 100).toFixed(1) : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export presence as Excel
app.get('/api/admin/export', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.project_title, t.leader_name, t.members, t.mentor_name, t.mobile_no, t.email, t.college_name, t.category, t.is_present, t.check_in_time, t.marked_by, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.is_present DESC, t.check_in_time ASC, t.team_code ASC, t.id ASC`
    );

    const { buildPresenceExcel } = require('./excel-formatter');
    const wb = await buildPresenceExcel(rows);

    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Master_Attendance.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Download Master Attendance Word document (.docx) - Live Dynamic DB
app.get('/api/admin/export/master-doc', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.project_title, t.leader_name, t.members, t.mentor_name, t.mobile_no, t.email, t.college_name, t.category, t.is_present, t.check_in_time, t.marked_by, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.panel_no ASC, t.category ASC, t.team_code ASC, t.id ASC`
    );
    const buf = await buildMasterAttendanceDocx(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Master_Attendance.docx"');
    res.send(buf);
  } catch (err) {
    console.error('[ERROR] /api/admin/export/master-doc error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate Master Attendance Word document' });
  }
});

// Download Master Attendance PDF document (.pdf) - Live Dynamic DB
app.get('/api/admin/export/master-pdf', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.project_title, t.leader_name, t.members, t.mentor_name, t.mobile_no, t.email, t.college_name, t.category, t.is_present, t.check_in_time, t.marked_by, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.panel_no ASC, t.category ASC, t.team_code ASC, t.id ASC`
    );
    const buf = await buildMasterAttendancePdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Master_Attendance.pdf"');
    res.send(buf);
  } catch (err) {
    console.error('[ERROR] /api/admin/export/master-pdf error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate Master Attendance PDF' });
  }
});

// Download Duplicates Audit Sheet (.xlsx)
app.get('/api/admin/export/duplicates-audit', authAdmin, async (req, res) => {
  try {
    const target = path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Duplicates_Audit.xlsx');
    if (!fs.existsSync(target)) {
      return res.status(404).json({ error: 'Duplicate audit file not found' });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.download(target, 'RMK_Junior_Hackathon_2026_Duplicates_Audit.xlsx', (err) => {
      if (err && !res.headersSent) {
        console.error('[ERROR] duplicates-audit download failed:', err);
        res.status(500).json({ error: 'Failed to download audit file' });
      }
    });
  } catch (err) {
    console.error('[ERROR] /api/admin/export/duplicates-audit error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download audit file' });
  }
});


// Helper for safely executing document generation scripts with timeout
function runDocGenScript(scriptPath, timeoutMs = 25000) {
  if (!fs.existsSync(scriptPath)) return false;
  const { spawnSync } = require('child_process');
  const commands = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const cmd of commands) {
    try {
      const proc = spawnSync(cmd, [scriptPath], {
        timeout: timeoutMs,
        stdio: 'ignore',
        windowsHide: true
      });
      if (proc && !proc.error && proc.status === 0) return true;
    } catch {}
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// ATTENDANCE EXPORTS (Comprehensive with status, timestamps, etc.)
// ─────────────────────────────────────────────────────────────
const { generateVenueAttendanceExcel } = require('./venue-attendance-export');
const { generateThemeAttendanceExcel } = require('./theme-attendance-export');

function findVenueAttendanceDocx() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Attendance.docx'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Venue_Attendance.docx'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Venue_Attendance.docx')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

function findVenueAttendancePdf() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Attendance.pdf'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Venue_Attendance.pdf'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Venue_Attendance.pdf')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

function findThemeAttendanceDocx() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Attendance.docx'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Theme_Attendance.docx'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Theme_Attendance.docx')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

function findThemeAttendancePdf() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Attendance.pdf'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Theme_Attendance.pdf'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Theme_Attendance.pdf')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

// Master Attendance Excel alias - Live Dynamic DB
app.get('/api/admin/export/master-excel', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.project_title, t.leader_name, t.members, t.mentor_name, t.mobile_no, t.email, t.college_name, t.category, t.is_present, t.check_in_time, t.marked_by, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.panel_no ASC, t.category ASC, t.team_code ASC, t.id ASC`
    );
    const { buildPresenceExcel } = require('./excel-formatter');
    const wb = await buildPresenceExcel(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Master_Attendance.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[ERROR] /api/admin/export/master-excel error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export master attendance excel' });
  }
});

// Venue Attendance Excel (14 columns, multi-sheet by panel) - Live Dynamic DB
app.get(['/api/admin/export/venue-attendance-excel', '/api/admin/export/venue-excel', '/api/admin/export/venue-roster-excel'], authAdmin, async (req, res) => {
  try {
    const target = path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Attendance.xlsx');
    await generateVenueAttendanceExcel(pool, target);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Venue_Attendance.xlsx"');
    res.sendFile(target, (err) => {
      if (err && !res.headersSent) {
        console.error('[ERROR] venue-attendance-excel download failed:', err);
        res.status(500).json({ error: 'Failed to download venue attendance Excel' });
      }
    });
  } catch (err) {
    console.error('[ERROR] /api/admin/export/venue-attendance-excel error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate venue attendance Excel' });
  }
});

// Venue Attendance DOCX (14 columns, summary + page break per panel) - Live Dynamic DB
app.get(['/api/admin/export/venue-attendance-doc', '/api/admin/export/venue-doc', '/api/admin/export/venue-roster-doc'], authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.email, t.college_name, t.project_title, t.category, t.members, t.mentor_name, t.is_present, t.check_in_time, t.marked_by, t.qr_verification_token, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t
       LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.panel_no ASC, t.category ASC, t.team_code ASC`
    );
    const buf = await buildVenueAttendanceDocx(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Venue_Attendance.docx"');
    res.send(buf);
  } catch (err) {
    console.error('[ERROR] venue-attendance-doc error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate venue attendance Word document' });
  }
});

// Venue Attendance PDF (14 columns, summary + page break per panel) - Live Dynamic DB
app.get(['/api/admin/export/venue-attendance-pdf', '/api/admin/export/venue-pdf', '/api/admin/export/venue-roster-pdf'], authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.email, t.college_name, t.project_title, t.category, t.members, t.mentor_name, t.is_present, t.check_in_time, t.marked_by, t.qr_verification_token, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t
       LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.panel_no ASC, t.category ASC, t.team_code ASC`
    );
    const buf = await buildVenueAttendancePdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Venue_Attendance.pdf"');
    res.send(buf);
  } catch (err) {
    console.error('[ERROR] venue-attendance-pdf error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate venue attendance PDF document' });
  }
});

// Theme Attendance Excel (15 columns, multi-sheet by theme) - Live Dynamic DB
app.get(['/api/admin/export/theme-attendance-excel', '/api/admin/export/theme-excel', '/api/admin/export/theme-roster-excel'], authAdmin, async (req, res) => {
  try {
    const filterTheme = req.query.theme || null;
    const filename = filterTheme 
      ? `RMK_Junior_Hackathon_2026_${filterTheme.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance.xlsx`
      : 'RMK_Junior_Hackathon_2026_Theme_Attendance.xlsx';
    const target = path.join(__dirname, '..', 'public', 'exports', filename);
    await generateThemeAttendanceExcel(pool, target, filterTheme);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(target, (err) => {
      if (err && !res.headersSent) {
        console.error('[ERROR] theme-attendance-excel download failed:', err);
        res.status(500).json({ error: 'Failed to download theme attendance Excel' });
      }
    });
  } catch (err) {
    console.error('[ERROR] /api/admin/export/theme-attendance-excel error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate theme attendance Excel' });
  }
});

// Theme Attendance DOCX (15 columns, summary + page break per theme) - Live Dynamic DB
app.get(['/api/admin/export/theme-attendance-doc', '/api/admin/export/theme-doc', '/api/admin/export/theme-roster-doc'], authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.email, t.college_name, t.project_title, t.category, t.members, t.mentor_name, t.is_present, t.check_in_time, t.marked_by, t.qr_verification_token, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t
       LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.category ASC, t.panel_no ASC, t.team_code ASC`
    );
    const buf = await buildThemeAttendanceDocx(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Theme_Attendance.docx"');
    res.send(buf);
  } catch (err) {
    console.error('[ERROR] theme-attendance-doc error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate theme attendance Word document' });
  }
});

// Theme Attendance PDF (15 columns, summary + page break per theme) - Live Dynamic DB
app.get(['/api/admin/export/theme-attendance-pdf', '/api/admin/export/theme-pdf', '/api/admin/export/theme-roster-pdf'], authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.email, t.college_name, t.project_title, t.category, t.members, t.mentor_name, t.is_present, t.check_in_time, t.marked_by, t.qr_verification_token, t.panel_no, COALESCE(t.venue, v.venue) AS venue
       FROM teams t
       LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.category ASC, t.panel_no ASC, t.team_code ASC`
    );
    const buf = await buildThemeAttendancePdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Junior_Hackathon_2026_Theme_Attendance.pdf"');
    res.send(buf);
  } catch (err) {
    console.error('[ERROR] theme-attendance-pdf error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate theme attendance PDF document' });
  }
});

// Toggle presence for a team (admin override)
app.post('/api/admin/teams/:id/toggle-attendance', authAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [team] = await pool.execute('SELECT is_present FROM teams WHERE id = ?', [id]);
    if (team.length === 0) return res.status(404).json({ error: 'Team not found' });

    const newStatus = !team[0].is_present;
    await pool.execute(
      'UPDATE teams SET is_present = ?, check_in_time = ?, marked_by = ? WHERE id = ?',
      [newStatus, newStatus ? new Date() : null, newStatus ? "Admin" : null, id]
    );

    res.json({ success: true, id, is_present: newStatus, marked_by: newStatus ? "Admin" : null, status: newStatus ? 'Scanned' : 'Not Scanned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error toggling presence' });
  }
});

// Allocation Management Routes (Revisions, Drafts, Assignments)
const allocationRoutes = require('./allocation-routes');
app.use('/api/admin', allocationRoutes);
app.use('/api', allocationRoutes);

// Jury Management & Evaluation Routes
const juryRoutes = require('./jury-routes');
app.use('/api', juryRoutes);

// Evaluation Reports & Rankings Routes (Status, Themes, Overall, Excel Exports)
const evaluationReportRoutes = require('./evaluation-report-routes');
app.use('/api/admin/reports', evaluationReportRoutes);
app.use('/api/reports', evaluationReportRoutes);

// Uptime check (no DB) for keep-awake pings; also shows which commit Render is running
app.get('/api/health', (req, res) => res.json({ ok: true, commit: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7) }));

// Legacy random token URL redirect -> official jury login URL
app.get(['/j8k2m9q7w4', '/j8k2m9q7w4/*'], (req, res) => {
  res.redirect(301, '/rmkjrhackathon2026-jurylogin');
});

// Legacy jury-admin URL redirect -> official super admin URL
app.get(['/rmkjrhackathon2026-jury-admin', '/rmkjrhackathon2026-juryadmin'], (req, res) => {
  res.redirect(301, '/rmkjrhackathon2026-superadmindhaneshkrish');
});

// Unknown API routes return JSON, everything else gets the app
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Global error handling middleware (handles invalid JSON body, unhandled errors gracefully without crash)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  console.error('[UNHANDLED EXPRESS ERROR]:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Process-level safety against uncaught rejections/exceptions
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION IN APP]:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION IN APP]:', err);
});

module.exports = app;







// Deploy trigger: 2026-11-14T11:30:29.211Z
