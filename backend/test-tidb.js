/**
 * TiDB Connection & Schema Setup Script
 * Run with: node test-tidb.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

function getTiDBConfig() {
  const url = process.env.TIDB_URL || process.env.DATABASE_URL;
  if (url && (url.startsWith('mysql://') || url.startsWith('mysql2://'))) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 4000,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'rmk_hackathon'
      };
    } catch (e) {
      console.warn('[WARN] Could not parse connection URL:', e.message);
    }
  }

  const host = process.env.DB_HOST || '';
  if (!host || host.includes('your-tidb-host') || (host === 'localhost' && !process.env.DB_USER)) {
    return null;
  }

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'rmk_hackathon'
  };
}

async function run() {
  console.log('====================================================');
  console.log('  RMK JR. HACKATHON 2024 — TiDB CONNECTION VERIFIER');
  console.log('====================================================\n');

  const config = getTiDBConfig();
  if (!config) {
    console.log('[STATUS] No real TiDB credentials found in .env');
    console.log('[GUIDE] Please open .env and set your TiDB Cloud credentials:');
    console.log('        DB_HOST=<your-cluster-host>.tidbcloud.com');
    console.log('        DB_PORT=4000');
    console.log('        DB_USER=<your_cluster_prefix>.root');
    console.log('        DB_PASSWORD=<your_password>');
    console.log('        DB_NAME=rmk_hackathon');
    console.log('\n        Or provide a single connection string:');
    console.log('        TIDB_URL=mysql://user:pass@host:4000/rmk_hackathon\n');
    process.exit(1);
  }

  console.log(`[INFO] Connecting to host: ${config.host}:${config.port}`);
  console.log(`[INFO] Database: ${config.database}`);
  console.log(`[INFO] User: ${config.user}`);

  let serverConn;
  try {
    // 1. Connect without specific DB to create database if not exists
    console.log('\n[STEP 1] Verifying server connectivity & database...');
    serverConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });
    console.log('[OK] Connected to TiDB server via secure TLS 1.2.');

    await serverConn.execute(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    console.log(`[OK] Database \`${config.database}\` is ready.`);
    await serverConn.end();
  } catch (err) {
    console.error(`[ERROR] Failed to connect to TiDB server: ${err.message}`);
    process.exit(1);
  }

  let pool;
  try {
    // 2. Connect to the specific database
    console.log('\n[STEP 2] Creating tables and indexes in TiDB...');
    pool = mysql.createPool({
      ...config,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      },
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });

    // Create teams table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id VARCHAR(50) UNIQUE NOT NULL,
        team_name VARCHAR(200) NOT NULL,
        leader_name VARCHAR(200) NOT NULL,
        mobile_no VARCHAR(15) NOT NULL,
        email VARCHAR(200),
        college_name VARCHAR(300),
        project_title VARCHAR(300),
        category VARCHAR(100),
        members TEXT,
        is_present BOOLEAN DEFAULT FALSE,
        check_in_time DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_team_id (team_id),
        INDEX idx_mobile (mobile_no),
        INDEX idx_present (is_present)
      )
    `);
    console.log('[OK] Table `teams` verified.');

    // Create admins table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[OK] Table `admins` verified.');

    // Create attendance_log table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS attendance_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id VARCHAR(50) NOT NULL,
        team_name VARCHAR(200),
        leader_name VARCHAR(200),
        check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        qr_code_value VARCHAR(500),
        ip_address VARCHAR(50),
        INDEX idx_team_id (team_id),
        INDEX idx_check_in (check_in_time)
      )
    `);
    console.log('[OK] Table `attendance_log` verified.');

    // Seed default admin
    const DEFAULT_ADMIN_HASH = '$2a$10$In/8hIHiQlb6tKXJJlqE5.4TCh.NOuI1P9OpdpwSuq5A02ynNMs4C';
    const [adminRows] = await pool.execute('SELECT id FROM admins WHERE username = ?', ['rmkjrhackathon']);
    if (adminRows.length === 0) {
      await pool.execute(
        'INSERT INTO admins (username, password_hash, name) VALUES (?, ?, ?)',
        ['rmkjrhackathon', DEFAULT_ADMIN_HASH, 'RMK Admin Coordinator']
      );
      console.log('[OK] Seeded admin user: `rmkjrhackathon`');
    } else {
      console.log('[OK] Admin user `rmkjrhackathon` already exists.');
    }

    // 3. Stats summary
    console.log('\n[STEP 3] TiDB Status & Row Counts:');
    const [teamCount] = await pool.execute('SELECT COUNT(*) AS count FROM teams');
    const [presentCount] = await pool.execute('SELECT COUNT(*) AS count FROM teams WHERE is_present = TRUE');
    const [adminCount] = await pool.execute('SELECT COUNT(*) AS count FROM admins');

    console.log(`  - Total Teams Registered: ${teamCount[0].count}`);
    console.log(`  - Teams Marked Present:  ${presentCount[0].count}`);
    console.log(`  - Admin Accounts:        ${adminCount[0].count}`);

    console.log('\n[SUCCESS] TiDB is completely set up and ready!');
    console.log('You can now run:');
    console.log('  node import-excel.js <path-to-excel-file.xlsx>');
    console.log('to import teams from your Excel sheet directly into TiDB.\n');

    await pool.end();
  } catch (err) {
    console.error(`[ERROR] Schema verification failed: ${err.message}`);
    process.exit(1);
  }
}

run();
