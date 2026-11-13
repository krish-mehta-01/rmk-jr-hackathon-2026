/**
 * Migration Runner for RMK Jr. Hackathon 2026
 * Tracks applied migrations in `schema_migrations` table.
 */
const { pool } = require('../db');

const MIGRATIONS = [
  { id: '001_allocation_revisions', mod: require('./001_allocation_revisions') },
  { id: '002_rubric_50_marks', mod: require('./002_rubric_50_marks') }
];

async function runMigrations() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [applied] = await pool.execute('SELECT version FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.version));

  for (const m of MIGRATIONS) {
    if (!appliedSet.has(m.id)) {
      console.log(`[MIGRATOR] Applying migration: ${m.id}...`);
      await m.mod.up(pool);
      await pool.execute('INSERT INTO schema_migrations (version) VALUES (?)', [m.id]);
      console.log(`[MIGRATOR] Recorded migration: ${m.id}`);
    } else {
      console.log(`[MIGRATOR] Migration already applied: ${m.id}`);
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[MIGRATOR] All migrations up to date.');
      process.exit(0);
    })
    .catch(err => {
      console.error('[FATAL MIGRATION ERROR]:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };

