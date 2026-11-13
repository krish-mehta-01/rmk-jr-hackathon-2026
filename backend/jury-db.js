const bcrypt = require('bcryptjs');
const { pool } = require('./db');

/**
 * Sets up database tables for the Jury Portal module.
 */
async function setupJurySchema() {
  // 1. Jury Admin accounts
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS jury_admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. 15 Judging Panels (P1 - P15)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS jury_panels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      panel_code VARCHAR(10) UNIQUE NOT NULL,
      panel_name VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. 30 Judge accounts (2 per panel: P1-IN, P1-EX ... P15-IN, P15-EX)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS jury_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      panel_id INT NOT NULL,
      username VARCHAR(20) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      judge_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      must_change_password BOOLEAN DEFAULT TRUE,
      is_registered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_panel (panel_id),
      INDEX idx_type (judge_type),
      INDEX idx_registered (is_registered)
    )
  `);

  // 4. Judge Profiles (registered after initial login)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS jury_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNIQUE NOT NULL,
      full_name VARCHAR(200) NOT NULL,
      phone_no VARCHAR(20) NOT NULL,
      email VARCHAR(200) NOT NULL,
      designation VARCHAR(150) NOT NULL,
      institution_name VARCHAR(250) NULL,
      company_name VARCHAR(250) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_profile_user (user_id)
    )
  `);

  // 5. Panel Project Assignments (ready for future allocation module)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS panel_project_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      panel_id INT NOT NULL,
      team_id INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT NULL,
      UNIQUE INDEX uq_panel_team (panel_id, team_id),
      INDEX idx_assign_team (team_id)
    )
  `);

  // 6. Extensible Evaluation Criteria
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS jury_evaluation_criteria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      criterion_code VARCHAR(20) UNIQUE NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT NULL,
      max_score DECIMAL(5,2) NOT NULL DEFAULT 20.00,
      display_order INT NOT NULL DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Project Evaluations (Independent rows for Internal and External evaluations)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS project_evaluations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_id INT NOT NULL,
      panel_id INT NOT NULL,
      judge_id INT NOT NULL,
      judge_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL,
      status ENUM('DRAFT', 'SUBMITTED') DEFAULT 'DRAFT',
      total_score DECIMAL(6,2) DEFAULT 0.00,
      remarks TEXT NULL,
      submitted_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_team_panel_judge (team_id, panel_id, judge_type),
      INDEX idx_eval_team (team_id),
      INDEX idx_eval_judge (judge_id),
      INDEX idx_eval_status (status)
    )
  `);

  // 8. Individual Criteria Scores
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS evaluation_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      evaluation_id INT NOT NULL,
      criterion_id INT NOT NULL,
      score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      comments TEXT NULL,
      UNIQUE INDEX uq_eval_criterion (evaluation_id, criterion_id),
      INDEX idx_score_eval (evaluation_id)
    )
  `);

  // 9. Audit Logs for Admin actions and evaluation adjustments
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS evaluation_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      evaluation_id INT NULL,
      action_by_type ENUM('JURY_ADMIN', 'JUDGE') NOT NULL,
      action_by_id INT NOT NULL,
      action VARCHAR(100) NOT NULL,
      old_data JSON NULL,
      new_data JSON NULL,
      ip_address VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_eval (evaluation_id)
    )
  `);
}

/**
 * Synchronizes Jury Administrator credentials configured in environment variables.
 */
async function syncJuryAdmin() {
  const username = process.env.JURY_ADMIN_USERNAME || 'juryadmin-rmk2026';
  const password = process.env.JURY_ADMIN_PASSWORD || 'RMK-JuryAdmin2026!';
  const [rows] = await pool.execute('SELECT id, password_hash FROM jury_admins WHERE username = ?', [username]);

  if (rows.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO jury_admins (username, password_hash, name) VALUES (?, ?, ?)',
      [username, hash, 'RMK Hackathon Jury Administrator']
    );
    console.log(`[OK] Jury Admin "${username}" created`);
  } else if (!(await bcrypt.compare(password, rows[0].password_hash))) {
    const hash = await bcrypt.hash(password, 10);
    await pool.execute('UPDATE jury_admins SET password_hash = ? WHERE id = ?', [hash, rows[0].id]);
    console.log(`[OK] Jury Admin "${username}" password updated from .env`);
  }
}

/**
 * Provisions exactly 15 panels and 30 judge accounts with standardized initial credentials.
 * Conventions:
 *   P1-IN  -> Panel1-IN
 *   P1-EX  -> Panel1-EX
 *   ...
 *   P15-IN -> Panel15-IN
 *   P15-EX -> Panel15-EX
 */
async function seedPanelsAndJudges() {
  for (let i = 1; i <= 15; i++) {
    const panelCode = `P${i}`;
    const panelName = `Panel ${i}`;

    // 1. Ensure Panel exists
    let [panels] = await pool.execute('SELECT id FROM jury_panels WHERE panel_code = ?', [panelCode]);
    let panelId;
    if (panels.length === 0) {
      const [res] = await pool.execute(
        'INSERT INTO jury_panels (panel_code, panel_name, is_active) VALUES (?, ?, TRUE)',
        [panelCode, panelName]
      );
      panelId = res.insertId;
    } else {
      panelId = panels[0].id;
    }

    // 2. Ensure Internal Judge account exists
    const inUsername = `P${i}-IN`;
    const inDefaultPass = `rmkjh2026`;
    const [inUser] = await pool.execute('SELECT id FROM jury_users WHERE username = ?', [inUsername]);
    if (inUser.length === 0) {
      const hash = await bcrypt.hash(inDefaultPass, 10);
      await pool.execute(
        `INSERT INTO jury_users (panel_id, username, password_hash, judge_type, is_active, must_change_password, is_registered)
         VALUES (?, ?, ?, 'INTERNAL', TRUE, FALSE, TRUE)`,
        [panelId, inUsername, hash]
      );
    }

    // 3. Ensure External Judge account exists
    const exUsername = `P${i}-EX`;
    const exDefaultPass = `rmkjh2026`;
    const [exUser] = await pool.execute('SELECT id FROM jury_users WHERE username = ?', [exUsername]);
    if (exUser.length === 0) {
      const hash = await bcrypt.hash(exDefaultPass, 10);
      await pool.execute(
        `INSERT INTO jury_users (panel_id, username, password_hash, judge_type, is_active, must_change_password, is_registered)
         VALUES (?, ?, ?, 'EXTERNAL', TRUE, FALSE, TRUE)`,
        [panelId, exUsername, hash]
      );
    }
  }
}

/**
 * Provisions standard evaluation criteria (configurable and extensible).
 */
async function seedEvaluationCriteria() {
  const defaultCriteria = [
    {
      code: 'C1',
      title: 'Problem Relevance & Scope',
      description: 'Understanding of the chosen domain, depth of research, and significance of the problem tackled.',
      max_score: 20.00,
      order: 1
    },
    {
      code: 'C2',
      title: 'Innovation & Creativity',
      description: 'Novelty of the approach, uniqueness of solution, and creativity over conventional methods.',
      max_score: 20.00,
      order: 2
    },
    {
      code: 'C3',
      title: 'Technical Feasibility & Architecture',
      description: 'Soundness of technical implementation, tool/technology stack choices, and architectural viability.',
      max_score: 20.00,
      order: 3
    },
    {
      code: 'C4',
      title: 'Impact & Practical Utility',
      description: 'Real-world applicability, scalability, target user benefit, and execution sustainability.',
      max_score: 20.00,
      order: 4
    },
    {
      code: 'C5',
      title: 'Demonstration & Presentation',
      description: 'Quality of working model/prototype demo, structured pitch, and clarity during Q&A interaction.',
      max_score: 20.00,
      order: 5
    }
  ];

  for (const c of defaultCriteria) {
    const [existing] = await pool.execute('SELECT id FROM jury_evaluation_criteria WHERE criterion_code = ?', [c.code]);
    if (existing.length === 0) {
      await pool.execute(
        `INSERT INTO jury_evaluation_criteria (criterion_code, title, description, max_score, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [c.code, c.title, c.description, c.max_score, c.order]
      );
    }
  }
}

/**
 * Master initializer for the Jury subsystem.
 */
async function initJurySystem() {
  try {
    await setupJurySchema();
    await syncJuryAdmin();
    await seedPanelsAndJudges();
    await seedEvaluationCriteria();
    console.log('[OK] Jury Portal database schema and seed accounts verified (15 panels, 30 judge accounts)');
    return true;
  } catch (err) {
    console.error('[ERROR] Jury Portal DB initialization failed:', err.message);
    throw err;
  }
}

module.exports = {
  initJurySystem
};

