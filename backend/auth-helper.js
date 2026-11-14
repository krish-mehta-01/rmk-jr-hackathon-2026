const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[ERROR] JWT_SECRET is not set in backend/.env');
}

/**
 * Computes a deterministic 16-character SHA-256 fingerprint of the current password hash (or phone for teams).
 * When password_hash changes (judge sets private password, or admin resets password, or admin changes password),
 * this signature changes immediately, instantly invalidating any previously issued tokens across all devices.
 */
function getPasswordSig(hashOrValue) {
  if (!hashOrValue) return '';
  return crypto.createHash('sha256').update(String(hashOrValue)).digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────────────────────
// PERMANENT TOKEN SIGNING (100 YEARS / LIFETIME SESSION)
// Devices stay logged in forever across reboots and browser closures
// UNLESS the password changes.
// ─────────────────────────────────────────────────────────────

const PERMANENT_EXPIRES_IN = '36500d'; // 100 years: practically forever

function signAdminToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: 'admin',
      pwd_sig: getPasswordSig(admin.password_hash)
    },
    JWT_SECRET,
    { expiresIn: PERMANENT_EXPIRES_IN }
  );
}

function signJuryAdminToken(juryAdmin) {
  return jwt.sign(
    {
      id: juryAdmin.id,
      username: juryAdmin.username,
      name: juryAdmin.name,
      role: 'jury-admin',
      pwd_sig: getPasswordSig(juryAdmin.password_hash)
    },
    JWT_SECRET,
    { expiresIn: PERMANENT_EXPIRES_IN }
  );
}

function signJudgeToken(judge) {
  return jwt.sign(
    {
      id: judge.id,
      panel_id: judge.panel_id,
      panel_code: judge.panel_code,
      username: judge.username,
      judge_type: judge.judge_type,
      role: 'judge',
      pwd_sig: getPasswordSig(judge.password_hash)
    },
    JWT_SECRET,
    { expiresIn: PERMANENT_EXPIRES_IN }
  );
}

function signTeamToken(team) {
  return jwt.sign(
    {
      id: team.id,
      role: 'team',
      team_code: team.team_code,
      phone_sig: getPasswordSig(team.mobile_no)
    },
    JWT_SECRET,
    { expiresIn: PERMANENT_EXPIRES_IN }
  );
}

// ─────────────────────────────────────────────────────────────
// LIVE SESSION & PASSWORD INITIATION VALIDATION
// Checks that the token's pwd_sig matches the current DB password_hash.
// If password changed or account deactivated, returns null.
// ─────────────────────────────────────────────────────────────

async function validateSession(decoded) {
  if (!decoded || !decoded.role || !decoded.id) return null;

  try {
    if (decoded.role === 'admin') {
      const [rows] = await pool.execute('SELECT id, username, name, password_hash FROM admins WHERE id = ?', [decoded.id]);
      if (rows.length === 0) return null;
      const admin = rows[0];
      // If token has pwd_sig, verify it matches current password_hash
      if (decoded.pwd_sig && decoded.pwd_sig !== getPasswordSig(admin.password_hash)) {
        return null; // Password changed!
      }
      return { ...decoded, name: admin.name, username: admin.username };
    }

    if (decoded.role === 'jury-admin') {
      const [rows] = await pool.execute('SELECT id, username, name, password_hash FROM jury_admins WHERE id = ?', [decoded.id]);
      if (rows.length === 0) return null;
      const juryAdmin = rows[0];
      if (decoded.pwd_sig && decoded.pwd_sig !== getPasswordSig(juryAdmin.password_hash)) {
        return null; // Password changed!
      }
      return { ...decoded, name: juryAdmin.name, username: juryAdmin.username };
    }

    if (decoded.role === 'judge') {
      const [rows] = await pool.execute('SELECT id, panel_id, username, judge_type, is_active, password_hash FROM jury_users WHERE id = ?', [decoded.id]);
      if (rows.length === 0) return null;
      const judge = rows[0];
      if (!judge.is_active) return null;
      if (decoded.pwd_sig && decoded.pwd_sig !== getPasswordSig(judge.password_hash)) {
        return null; // Password changed or reset!
      }
      return { ...decoded, username: judge.username, panel_id: judge.panel_id, judge_type: judge.judge_type };
    }

    if (decoded.role === 'team') {
      const [rows] = await pool.execute('SELECT id, team_code, mobile_no FROM teams WHERE id = ?', [decoded.id]);
      if (rows.length === 0) return null;
      const team = rows[0];
      if (decoded.phone_sig && decoded.phone_sig !== getPasswordSig(team.mobile_no)) {
        return null; // Phone number changed!
      }
      return { ...decoded, team_code: team.team_code };
    }

    return null;
  } catch (err) {
    console.error('[ERROR] validateSession query failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// EXPRESS AUTH MIDDLEWARES
// ─────────────────────────────────────────────────────────────

function requireRole(expectedRole) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Please log in again.' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== expectedRole) {
        return res.status(403).json({ error: 'Access denied: insufficient privileges.' });
      }

      const validatedUser = await validateSession(decoded);
      if (!validatedUser) {
        return res.status(401).json({ error: 'Your password has changed or session is invalid. Please log in again.' });
      }

      req.user = validatedUser;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
  };
}

module.exports = {
  JWT_SECRET,
  getPasswordSig,
  signAdminToken,
  signJuryAdminToken,
  signJudgeToken,
  signTeamToken,
  validateSession,
  requireRole
};

