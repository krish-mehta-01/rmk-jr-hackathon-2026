const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function getTiDBConfig() {
  const url = process.env.TIDB_URL || process.env.DATABASE_URL;
  if (url && (url.startsWith('mysql://') || url.startsWith('mysql2://'))) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 4000,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'rmk_hackathon'
    };
  }

  if (!process.env.DB_HOST || !process.env.DB_USER) return null;

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'rmk_hackathon'
  };
}

const config = getTiDBConfig();
if (!config) {
  console.error('[ERROR] TiDB credentials missing. Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in backend/.env');
  process.exit(1);
}

const ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };

// TiDB Cloud closes idle connections, so drop ours first and keep live ones warm
const rawPool = mysql.createPool({
  ...config,
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  maxIdle: 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Store times in UTC so the cloud server (UTC) and this laptop (IST) agree
  timezone: 'Z'
});

const TRANSIENT_ERRORS = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'EPIPE', 'ETIMEDOUT']);

// Retries a query on a fresh connection if the one handed out had been dropped.
// All queries in this app are safe to repeat (idempotent updates, upserts, reads).
const pool = {
  async execute(sql, params) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await rawPool.execute(sql, params);
      } catch (err) {
        if (!TRANSIENT_ERRORS.has(err.code) || attempt >= 3) throw err;
        console.warn(`[WARN] DB connection dropped (${err.code}), retrying`);
      }
    }
  },
  getConnection: () => rawPool.getConnection(),
  end: () => rawPool.end()
};

async function ensureDatabaseExists() {
  const conn = await mysql.createConnection({ ...config, database: undefined, ssl });
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
  await conn.end();
}

async function setupSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_uuid VARCHAR(36) NULL,
      team_code VARCHAR(20) NULL,
      team_name VARCHAR(200) NOT NULL,
      leader_name VARCHAR(200) NOT NULL,
      mobile_no VARCHAR(15) NOT NULL,
      email VARCHAR(200),
      college_name VARCHAR(300),
      project_title VARCHAR(300),
      category VARCHAR(100),
      members TEXT,
      mentor_name VARCHAR(200) NULL,
      mentor_contact VARCHAR(50) NULL,
      mentor_email VARCHAR(200) NULL,
      is_present BOOLEAN DEFAULT FALSE,
      check_in_time DATETIME NULL,
      qr_verification_token VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_team_code (team_code),
      INDEX idx_mobile (mobile_no),
      INDEX idx_present (is_present)
    )
  `);
  await pool.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS mentor_name VARCHAR(200) NULL');
  await pool.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS mentor_contact VARCHAR(50) NULL');
  await pool.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS mentor_email VARCHAR(200) NULL');

  // Teams are identified by their official TEAM ID (e.g. RMKJH261049). Phone numbers are not
  // unique: some schools registered several teams under one teacher's number.
  await pool.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_code VARCHAR(20) NULL');
  await pool.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_team_code ON teams (team_code)');
  const [indexes] = await pool.execute('SHOW INDEX FROM teams');
  const uniqueOnMobile = new Set(
    indexes
      .filter(i => i.Key_name !== 'PRIMARY' && !i.Non_unique)
      .filter(i => indexes.filter(j => j.Key_name === i.Key_name).every(j => j.Column_name === 'mobile_no'))
      .map(i => i.Key_name)
  );
  for (const name of uniqueOnMobile) {
    await pool.execute(`ALTER TABLE teams DROP INDEX \`${name}\``);
    console.log(`[OK] Dropped unique index ${name} on teams.mobile_no`);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS attendance_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_id_fk INT NULL,
      team_name VARCHAR(200),
      leader_name VARCHAR(200),
      check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      qr_code_value VARCHAR(500),
      qr_verification_token VARCHAR(64) NULL,
      ip_address VARCHAR(50),
      INDEX idx_check_in (check_in_time)
    )
  `);
  // Older deployments created attendance_log without team_id_fk, which made every log insert fail
  await pool.execute('ALTER TABLE attendance_log ADD COLUMN IF NOT EXISTS team_id_fk INT NULL');
}

// The admin password lives in backend/.env (ADMIN_PASSWORD); the DB hash follows it
async function syncAdmin() {
  const username = process.env.ADMIN_USERNAME || 'rmkjrhackathon';
  const password = process.env.ADMIN_PASSWORD;
  const [rows] = await pool.execute('SELECT id, password_hash FROM admins WHERE username = ?', [username]);

  if (!password) {
    if (rows.length === 0) console.error(`[ERROR] No admin account. Set ADMIN_PASSWORD in backend/.env to create "${username}".`);
    return;
  }

  if (rows.length === 0) {
    await pool.execute(
      'INSERT INTO admins (username, password_hash, name) VALUES (?, ?, ?)',
      [username, await bcrypt.hash(password, 10), 'RMK Admin Coordinator']
    );
    console.log(`[OK] Admin "${username}" created`);
  } else if (!(await bcrypt.compare(password, rows[0].password_hash))) {
    await pool.execute('UPDATE admins SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), rows[0].id]);
    console.log(`[OK] Admin "${username}" password updated from .env`);
  }
}

async function testConnection() {
  try {
    await ensureDatabaseExists().catch(err => console.warn(`[WARN] Could not verify database exists: ${err.message}`));
    const conn = await pool.getConnection();
    conn.release();
    console.log('[OK] Connected to TiDB Cloud');
    await setupSchema();
    await syncAdmin();
    console.log('[OK] TiDB schema verified and ready');
    return true;
  } catch (err) {
    console.error(`[ERROR] TiDB Cloud connection/setup failed: ${err.message}`);
    return false;
  }
}

module.exports = { pool, testConnection };
