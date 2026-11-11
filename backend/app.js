const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
// Express app: API routes plus the static frontend. Started by server.js (local, Render) and
// exported to Vercel as a serverless function by api/index.js.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('./db');
const { generateVenueExcel, findVenueDocx, findVenueExcel, findVenuePdf } = require('./venue-export');
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
    team_name: team.team_name,
    leader_name: team.leader_name,
    college_name: team.college_name,
    project_title: team.project_title,
    members: team.members,
    mentor_name: team.mentor_name,
    theme: team.category,
    venue: team.venue || null,
    is_present: Boolean(team.is_present),
    check_in_time: team.check_in_time
  };
}

// venue = the sitting place for the team's theme (theme_venues table)
const TEAM_PASS_COLUMNS = 'id, team_name, leader_name, college_name, project_title, members, mentor_name, category, '
  + '(SELECT venue FROM theme_venues v WHERE v.theme = teams.category) AS venue, is_present, check_in_time';

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
// JWT Middleware
// ─────────────────────────────────────────────
function requireRole(role) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Please log in again.' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== role) return res.status(403).json({ error: 'Access denied' });
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
  };
}
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
    const token = jwt.sign(
      { id: admin.id, username: admin.username, name: admin.name, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, name: admin.name, username: admin.username });
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
      `SELECT ${TEAM_PASS_COLUMNS} FROM teams WHERE team_code = ? AND mobile_no = ?`,
      [teamCode, phone]
    );
    if (matches.length === 0) {
      loginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Team ID and phone number do not match. Please check both.' });
    }

    loginLimiter.clear(req.ip);
    const team = matches[0];
    const token = jwt.sign({ id: team.id, role: 'team' }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, team: teamPassView(team) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
    if (search) {
      where += ' AND (team_code LIKE ? OR team_name LIKE ? OR leader_name LIKE ? OR mentor_name LIKE ? OR college_name LIKE ? OR project_title LIKE ? OR mobile_no LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }
    if (present === 'true') where += ' AND is_present = TRUE';
    else if (present === 'false') where += ' AND (is_present = FALSE OR is_present IS NULL)';

    const [rows] = await pool.execute(
      'SELECT id, team_code, team_name, leader_name, mobile_no, college_name, project_title, members, mentor_name, is_present, check_in_time, marked_by FROM teams' +
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

// Teams grouped by theme, with each theme's sitting place
app.get('/api/admin/themes', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.id, t.team_code, t.team_name, t.leader_name, t.mobile_no, t.college_name, t.project_title, t.members, t.mentor_name, t.category, t.is_present, t.check_in_time, t.marked_by, v.venue
       FROM teams t LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.category, t.team_code`
    );
    const themes = new Map();
    for (const r of rows) {
      const name = r.category || 'No theme';
      if (!themes.has(name)) themes.set(name, { theme: name, venue: r.venue || null, total: 0, scanned: 0, teams: [] });
      const group = themes.get(name);
      group.total++;
      if (r.is_present) group.scanned++;
      group.teams.push({
        id: r.id,
        team_code: r.team_code,
        team_name: r.team_name,
        leader_name: r.leader_name,
        mobile_no: r.mobile_no,
        college_name: r.college_name,
        project_title: r.project_title,
        members: r.members,
        mentor_name: r.mentor_name,
        is_present: Boolean(r.is_present),
        check_in_time: r.check_in_time,
        marked_by: r.marked_by
      });
    }
    res.json({ themes: [...themes.values()] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
      `SELECT t.team_code, t.team_name, t.project_title, t.leader_name, t.members, t.mentor_name, t.mobile_no, t.email, t.college_name, t.category, t.is_present, t.check_in_time, t.marked_by, v.venue
       FROM teams t LEFT JOIN theme_venues v ON v.theme = t.category
       ORDER BY t.is_present DESC, t.check_in_time ASC, t.team_code ASC, t.id ASC`
    );

    const { buildPresenceExcel } = require('./excel-formatter');
    const wb = await buildPresenceExcel(rows);

    res.setHeader('Content-Disposition', 'attachment; filename="RMK_Jr_Hackathon_2026_Presence_Roster.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});


// Download / generate venue-wise segregated Excel (.xlsx)
app.get('/api/admin/export/venue-excel', authAdmin, async (req, res) => {
  try {
    let filePath = findVenueExcel();
    if (!filePath) {
      const target = path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx');
      await generateVenueExcel(pool, target);
      filePath = target;
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.download(filePath, 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx', (err) => {
      if (err && !res.headersSent) {
        console.error('[ERROR] venue-excel download failed:', err);
        res.status(500).json({ error: 'Failed to download venue Excel' });
      }
    });
  } catch (err) {
    console.error('[ERROR] /api/admin/export/venue-excel error:', err);
    res.status(500).json({ error: 'Failed to generate venue Excel' });
  }
});

// Download / generate venue-wise segregated Word document (.docx)
app.get('/api/admin/export/venue-doc', authAdmin, async (req, res) => {
  try {
    let filePath = findVenueDocx();
    if (!filePath) {
      const genScript = path.join(__dirname, '..', 'scratch', 'generate_venue_docs.py');
      if (fs.existsSync(genScript)) {
        const { spawnSync } = require('child_process');
        spawnSync('python', [genScript], { stdio: 'ignore' });
        filePath = findVenueDocx();
      }
    }
    if (!filePath) {
      return res.status(404).json({ error: 'Venue document is currently being prepared. Please retry shortly.' });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.download(filePath, 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx', (err) => {
      if (err && !res.headersSent) {
        console.error('[ERROR] venue-doc download failed:', err);
        res.status(500).json({ error: 'Failed to download venue Word document' });
      }
    });
  } catch (err) {
    console.error('[ERROR] /api/admin/export/venue-doc error:', err);
    res.status(500).json({ error: 'Failed to generate venue Word document' });
  }
});


// Download venue-wise segregated PDF document (.pdf)
app.get('/api/admin/export/venue-pdf', authAdmin, async (req, res) => {
  try {
    const filePath = findVenuePdf();
    if (!filePath) {
      return res.status(404).json({ error: 'Venue PDF document is currently being prepared. Please retry shortly.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.download(filePath, 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf', (err) => {
      if (err && !res.headersSent) {
        console.error('[ERROR] venue-pdf download failed:', err);
        res.status(500).json({ error: 'Failed to download venue PDF document' });
      }
    });
  } catch (err) {
    console.error('[ERROR] /api/admin/export/venue-pdf error:', err);
    res.status(500).json({ error: 'Failed to generate venue PDF document' });
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

// Uptime check (no DB) for keep-awake pings; also shows which commit Render is running
app.get('/api/health', (req, res) => res.json({ ok: true, commit: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7) }));

// Unknown API routes return JSON, everything else gets the app
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

module.exports = app;
