/**
 * Migration 001: Allocation Revisions and Panel-Specific Physical Venues
 * 
 * 1. Adds `venue` column to `jury_panels` and populates the 15 verified physical venues.
 * 2. Creates `allocation_revisions` table with status workflow (DRAFT, PUBLISHED, ARCHIVED).
 * 3. Creates `allocation_audit_logs` table for tracking allocation administrative actions.
 * 4. Migrates `panel_project_assignments` to be revision-aware with unique team constraint per revision.
 * 5. Seeds Revision 1 (PUBLISHED, active) preserving all existing 282 team assignments.
 * 6. Retains legacy `teams.panel_no` and `teams.venue` intact.
 */

const PANEL_VENUES = {
  'P1': 'Idea Lab I (RJ Block)',
  'P2': 'Second Floor Seminar Hall-A (RJ Block)',
  'P3': 'Second Floor Seminar Hall-B (RJ Block)',
  'P4': 'Co-Work Space (RJ Block)',
  'P5': 'Ground Floor - A (VR Block)',
  'P6': 'Seminar Hall 3 (SV Block)',
  'P7': 'First Floor Seminar Hall-A (RJ Block)',
  'P8': 'First Floor Seminar Hall-B (RJ Block)',
  'P9': 'Idea Lab II (RJ Block)',
  'P10': 'Ground Floor - B (VR Block)',
  'P11': 'First Floor - A (VR Block)',
  'P12': 'First Floor - B (VR Block)',
  'P13': 'Seminar Hall 1 (SV Block)',
  'P14': 'Seminar Hall 2 (SV Block)',
  'P15': 'Second Floor (VR Block)'
};

async function up(pool) {
  console.log('[MIGRATION 001] Starting allocation revision schema migration...');

  // 1. Ensure `jury_panels` has `venue` column
  const [panelCols] = await pool.execute('DESCRIBE jury_panels');
  const hasVenueCol = panelCols.some(c => c.Field === 'venue');
  if (!hasVenueCol) {
    await pool.execute('ALTER TABLE jury_panels ADD COLUMN venue VARCHAR(255) NULL AFTER panel_name');
    console.log('   ✓ Added `venue` column to `jury_panels`');
  }

  // 2. Seed physical venues for all 15 panels
  for (const [code, venue] of Object.entries(PANEL_VENUES)) {
    await pool.execute('UPDATE jury_panels SET venue = ? WHERE panel_code = ?', [venue, code]);
  }
  console.log('   ✓ Populated physical venues for all 15 judging panels');

  // 3. Create `allocation_revisions` table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS allocation_revisions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      revision_number INT NOT NULL UNIQUE,
      status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_by VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME NULL,
      notes TEXT NULL,
      INDEX idx_status (status),
      INDEX idx_active (is_active)
    )
  `);
  console.log('   ✓ Verified `allocation_revisions` table');

  // 4. Create `allocation_audit_logs` table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS allocation_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      revision_id INT NULL,
      action VARCHAR(100) NOT NULL,
      admin_username VARCHAR(100) NULL,
      details JSON NULL,
      ip_address VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_rev (revision_id)
    )
  `);
  console.log('   ✓ Verified `allocation_audit_logs` table');

  // 5. Upgrade `panel_project_assignments` to be revision-aware
  const [assignCols] = await pool.execute('DESCRIBE panel_project_assignments');
  const hasRevCol = assignCols.some(c => c.Field === 'revision_id');

  if (!hasRevCol) {
    // Drop old unique constraint if present
    const [indexes] = await pool.execute('SHOW INDEX FROM panel_project_assignments');
    const uqPanelTeam = indexes.find(i => i.Key_name === 'uq_panel_team');
    if (uqPanelTeam) {
      await pool.execute('ALTER TABLE panel_project_assignments DROP INDEX uq_panel_team');
      console.log('   ✓ Dropped legacy index `uq_panel_team`');
    }

    // Truncate legacy non-revision assignments (we will seed Revision 1 cleanly)
    await pool.execute('DELETE FROM panel_project_assignments');

    // Add revision_id
    await pool.execute('ALTER TABLE panel_project_assignments ADD COLUMN revision_id INT NOT NULL AFTER id');
    await pool.execute('ALTER TABLE panel_project_assignments ADD UNIQUE KEY uq_rev_team (revision_id, team_id)');
    await pool.execute('ALTER TABLE panel_project_assignments ADD INDEX idx_rev_panel (revision_id, panel_id)');
    console.log('   ✓ Made `panel_project_assignments` revision-aware with (revision_id, team_id) unique constraint');
  }

  // 6. Seed Revision 1 (PUBLISHED, active) from existing 282 teams
  const [revisions] = await pool.execute('SELECT id, revision_number FROM allocation_revisions WHERE status = "PUBLISHED" AND is_active = TRUE');
  
  if (revisions.length === 0) {
    const [revResult] = await pool.execute(`
      INSERT INTO allocation_revisions (revision_number, status, is_active, created_by, published_at, notes)
      VALUES (1, 'PUBLISHED', TRUE, 'system', NOW(), 'Initial published allocation migrated from existing 282 team panel assignments')
    `);
    const rev1Id = revResult.insertId;

    // Migrate all 282 teams into panel_project_assignments under Revision 1
    const [migrated] = await pool.execute(`
      INSERT INTO panel_project_assignments (revision_id, panel_id, team_id)
      SELECT ?, p.id, t.id
      FROM teams t
      JOIN jury_panels p ON p.panel_code = CONCAT('P', t.panel_no)
      WHERE t.panel_no IS NOT NULL AND t.panel_no BETWEEN 1 AND 15
    `, [rev1Id]);

    await pool.execute(`
      INSERT INTO allocation_audit_logs (revision_id, action, admin_username, details, ip_address)
      VALUES (?, 'INITIAL_PUBLISH', 'system', JSON_OBJECT('migrated_teams', ?), '127.0.0.1')
    `, [rev1Id, migrated.affectedRows]);

    console.log(`   ✓ Seeded Revision 1 (PUBLISHED, active) with ${migrated.affectedRows} team assignments`);
  } else {
    console.log(`   ✓ Active published revision already exists (Revision ${revisions[0].revision_number})`);
  }

  console.log('[MIGRATION 001] Completed successfully.');
}

async function down(pool) {
  console.log('[ROLLBACK 001] Rolling back allocation revision schema...');
  // Note: Data is preserved in teams table (teams.panel_no and teams.venue).
  await pool.execute('DROP TABLE IF EXISTS allocation_audit_logs');
  await pool.execute('DROP TABLE IF EXISTS panel_project_assignments');
  await pool.execute('DROP TABLE IF EXISTS allocation_revisions');
  // Re-create simple panel_project_assignments
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS panel_project_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      panel_id INT NOT NULL,
      team_id INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT NULL,
      UNIQUE INDEX uq_panel_team (panel_id, team_id)
    )
  `);
  console.log('[ROLLBACK 001] Rollback completed.');
}

module.exports = { up, down, PANEL_VENUES };

