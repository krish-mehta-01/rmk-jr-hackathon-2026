const { pool } = require('./db');

/**
 * Service for Allocation Revisions and Panel Project Assignments.
 * Guarantees:
 * - Only 1 active PUBLISHED revision at any time.
 * - Published revisions are immutable.
 * - Draft changes never leak to judges or student passes until published.
 * - Legacy `teams.panel_no` and `teams.venue` are kept in sync on publication.
 */

/**
 * Retrieves the currently active published allocation revision.
 */
async function getActivePublishedRevision() {
  const [rows] = await pool.execute(`
    SELECT id, revision_number, status, is_active, created_by, created_at, published_at, notes
    FROM allocation_revisions
    WHERE status = 'PUBLISHED' AND is_active = TRUE
    LIMIT 1
  `);
  return rows[0] || null;
}

/**
 * Retrieves a revision by its ID.
 */
async function getRevisionById(revisionId) {
  const [rows] = await pool.execute(`
    SELECT id, revision_number, status, is_active, created_by, created_at, published_at, notes
    FROM allocation_revisions
    WHERE id = ?
  `, [revisionId]);
  return rows[0] || null;
}

/**
 * Retrieves the currently active DRAFT revision if any exists.
 */
async function getDraftRevision() {
  const [rows] = await pool.execute(`
    SELECT id, revision_number, status, is_active, created_by, created_at, notes
    FROM allocation_revisions
    WHERE status = 'DRAFT'
    LIMIT 1
  `);
  return rows[0] || null;
}

/**
 * Retrieves all 15 panels with their physical venues.
 */
async function getAllPanels() {
  const [rows] = await pool.execute(`
    SELECT id, panel_code, panel_name, venue, is_active
    FROM jury_panels
    ORDER BY id ASC
  `);
  return rows;
}

/**
 * Retrieves all assignments for a given revision, plus unassigned teams.
 */
async function getRevisionDetails(revisionId) {
  const revision = await getRevisionById(revisionId);
  if (!revision) return null;

  // 1. Fetch assigned teams for this revision
  const [assigned] = await pool.execute(`
    SELECT 
      a.id AS assignment_id, a.revision_id, a.panel_id, a.team_id, a.assigned_at,
      p.panel_code, p.panel_name, p.venue AS panel_venue,
      t.team_code, t.team_name, t.leader_name, t.category AS theme, t.college_name, t.project_title, t.is_present
    FROM panel_project_assignments a
    JOIN jury_panels p ON p.id = a.panel_id
    JOIN teams t ON t.id = a.team_id
    WHERE a.revision_id = ?
    ORDER BY p.id ASC, t.team_code ASC
  `, [revisionId]);

  // 2. Fetch unassigned teams (teams that have no assignment in this revision)
  const [unassigned] = await pool.execute(`
    SELECT 
      t.id AS team_id, t.team_code, t.team_name, t.leader_name, t.category AS theme, t.college_name, t.project_title, t.is_present
    FROM teams t
    WHERE t.id NOT IN (
      SELECT team_id FROM panel_project_assignments WHERE revision_id = ?
    )
    ORDER BY t.team_code ASC
  `, [revisionId]);

  // 3. Panel counts summary
  const panels = await getAllPanels();
  const panelCounts = {};
  for (const p of panels) {
    panelCounts[p.id] = {
      panel_id: p.id,
      panel_code: p.panel_code,
      panel_name: p.panel_name,
      venue: p.venue,
      count: 0
    };
  }
  for (const a of assigned) {
    if (panelCounts[a.panel_id]) {
      panelCounts[a.panel_id].count++;
    }
  }

  const panelsWithTeams = panels.map(p => ({
    ...p,
    count: panelCounts[p.id]?.count || 0,
    teams: assigned.filter(a => a.panel_id === p.id)
  }));

  return {
    revision,
    panels: panelsWithTeams,
    assigned,
    unassigned,
    stats: {
      total_teams: assigned.length + unassigned.length,
      assigned_count: assigned.length,
      unassigned_count: unassigned.length,
      panel_counts: Object.values(panelCounts)
    }
  };
}

/**
 * Creates a new DRAFT revision by cloning all assignments from the active PUBLISHED revision.
 */
async function createDraftFromPublished(adminUsername, notes = '') {
  // Check if a draft already exists
  const existingDraft = await getDraftRevision();
  if (existingDraft) {
    throw new Error(`A draft revision (Revision ${existingDraft.revision_number}) is already in progress. Please publish or discard it first.`);
  }

  const active = await getActivePublishedRevision();
  if (!active) {
    throw new Error('No active published allocation found to branch from.');
  }

  // Get next revision number
  const [[maxRow]] = await pool.execute('SELECT COALESCE(MAX(revision_number), 0) AS max_rev FROM allocation_revisions');
  const nextRevNumber = maxRow.max_rev + 1;

  // Insert new DRAFT
  const [res] = await pool.execute(`
    INSERT INTO allocation_revisions (revision_number, status, is_active, created_by, notes)
    VALUES (?, 'DRAFT', FALSE, ?, ?)
  `, [nextRevNumber, adminUsername || 'admin', notes || `Draft branched from Revision ${active.revision_number}`]);
  const newDraftId = res.insertId;

  // Clone assignments from active revision
  await pool.execute(`
    INSERT INTO panel_project_assignments (revision_id, panel_id, team_id, notes)
    SELECT ?, panel_id, team_id, notes
    FROM panel_project_assignments
    WHERE revision_id = ?
  `, [newDraftId, active.id]);

  // Log audit
  await pool.execute(`
    INSERT INTO allocation_audit_logs (revision_id, action, admin_username, details)
    VALUES (?, 'CREATE_DRAFT', ?, JSON_OBJECT('from_revision_id', ?, 'from_revision_number', ?))
  `, [newDraftId, adminUsername || 'admin', active.id, active.revision_number]);

  return getRevisionById(newDraftId);
}

/**
 * Assigns or moves a team to a panel within a DRAFT revision.
 */
async function assignTeamInDraft(draftId, teamId, panelId, adminUsername) {
  const rev = await getRevisionById(draftId);
  if (!rev || rev.status !== 'DRAFT') {
    throw new Error('Assignments can only be modified in a DRAFT revision.');
  }

  // Check panel validity
  const [panelRows] = await pool.execute('SELECT id, panel_code FROM jury_panels WHERE id = ?', [panelId]);
  if (panelRows.length === 0) {
    throw new Error('Invalid panel ID.');
  }

  // Check team validity
  const [teamRows] = await pool.execute('SELECT id, team_code, team_name FROM teams WHERE id = ?', [teamId]);
  if (teamRows.length === 0) {
    throw new Error('Invalid team ID.');
  }

  // Upsert assignment into panel_project_assignments
  await pool.execute(`
    INSERT INTO panel_project_assignments (revision_id, panel_id, team_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE panel_id = VALUES(panel_id), assigned_at = CURRENT_TIMESTAMP
  `, [draftId, panelId, teamId]);

  // Log audit
  await pool.execute(`
    INSERT INTO allocation_audit_logs (revision_id, action, admin_username, details)
    VALUES (?, 'ASSIGN_TEAM', ?, JSON_OBJECT('team_id', ?, 'team_code', ?, 'panel_id', ?, 'panel_code', ?))
  `, [draftId, adminUsername || 'admin', teamId, teamRows[0].team_code, panelId, panelRows[0].panel_code]);

  return { ok: true, team_id: teamId, panel_id: panelId };
}

/**
 * Removes a team assignment from a DRAFT revision (moves team to unassigned).
 */
async function removeTeamFromDraft(draftId, teamId, adminUsername) {
  const rev = await getRevisionById(draftId);
  if (!rev || rev.status !== 'DRAFT') {
    throw new Error('Assignments can only be removed in a DRAFT revision.');
  }

  const [delRes] = await pool.execute(`
    DELETE FROM panel_project_assignments
    WHERE revision_id = ? AND team_id = ?
  `, [draftId, teamId]);

  if (delRes.affectedRows > 0) {
    await pool.execute(`
      INSERT INTO allocation_audit_logs (revision_id, action, admin_username, details)
      VALUES (?, 'REMOVE_TEAM', ?, JSON_OBJECT('team_id', ?))
    `, [draftId, adminUsername || 'admin', teamId]);
  }

  return { ok: true, removed: delRes.affectedRows > 0 };
}

/**
 * Validates a revision before publishing.
 */
async function validateRevision(revisionId) {
  const rev = await getRevisionById(revisionId);
  if (!rev) throw new Error('Revision not found.');

  const errors = [];
  const warnings = [];

  // 1. Check for duplicate team assignments (database unique index enforces this, but check explicitly)
  const [dupRows] = await pool.execute(`
    SELECT team_id, COUNT(*) as c
    FROM panel_project_assignments
    WHERE revision_id = ?
    GROUP BY team_id
    HAVING c > 1
  `, [revisionId]);
  if (dupRows.length > 0) {
    errors.push(`${dupRows.length} team(s) are assigned to multiple panels.`);
  }

  // 2. Check for invalid panel references
  const [invalidPanels] = await pool.execute(`
    SELECT a.panel_id
    FROM panel_project_assignments a
    LEFT JOIN jury_panels p ON p.id = a.panel_id
    WHERE a.revision_id = ? AND p.id IS NULL
  `, [revisionId]);
  if (invalidPanels.length > 0) {
    errors.push(`${invalidPanels.length} assignment(s) reference non-existent panels.`);
  }

  // 3. Count assigned vs unassigned teams
  const [[totalTeamsRow]] = await pool.execute('SELECT COUNT(*) as total FROM teams');
  const [[assignedCountRow]] = await pool.execute('SELECT COUNT(*) as assigned FROM panel_project_assignments WHERE revision_id = ?', [revisionId]);
  const totalTeams = totalTeamsRow.total;
  const assignedCount = assignedCountRow.assigned;
  const unassignedCount = Math.max(0, totalTeams - assignedCount);

  if (unassignedCount > 0) {
    warnings.push(`${unassignedCount} registered team(s) are currently unassigned.`);
  }

  // 4. Panel distribution and balance checks (target 18-22 teams per panel)
  const [dist] = await pool.execute(`
    SELECT p.id, p.panel_code, p.panel_name, p.venue, COUNT(a.team_id) as team_count
    FROM jury_panels p
    LEFT JOIN panel_project_assignments a ON a.panel_id = p.id AND a.revision_id = ?
    GROUP BY p.id, p.panel_code, p.panel_name, p.venue
    ORDER BY p.id ASC
  `, [revisionId]);

  const panelBalance = [];
  let isBalanced = true;
  for (const p of dist) {
    const inRange = p.team_count >= 18 && p.team_count <= 22;
    if (!inRange) isBalanced = false;
    panelBalance.push({
      panel_id: p.id,
      panel_code: p.panel_code,
      team_count: p.team_count,
      in_range: inRange
    });
    if (p.team_count === 0) {
      warnings.push(`Panel ${p.panel_code} (${p.panel_name}) currently has 0 teams assigned.`);
    } else if (!inRange) {
      warnings.push(`Panel ${p.panel_code} has ${p.team_count} teams (target balance is 18-22 teams).`);
    }
  }

  // 5. Change summary compared to active published revision
  const active = await getActivePublishedRevision();
  const changeSummary = {
    moved_count: 0,
    added_count: 0,
    removed_count: 0,
    details: []
  };

  if (active && active.id !== revisionId) {
    const [activeRows] = await pool.execute(`
      SELECT a.team_id, a.panel_id, p.panel_code, t.team_code, t.team_name
      FROM panel_project_assignments a
      JOIN jury_panels p ON p.id = a.panel_id
      JOIN teams t ON t.id = a.team_id
      WHERE a.revision_id = ?
    `, [active.id]);

    const [draftRows] = await pool.execute(`
      SELECT a.team_id, a.panel_id, p.panel_code, t.team_code, t.team_name
      FROM panel_project_assignments a
      JOIN jury_panels p ON p.id = a.panel_id
      JOIN teams t ON t.id = a.team_id
      WHERE a.revision_id = ?
    `, [revisionId]);

    const activeMap = new Map();
    for (const r of activeRows) {
      activeMap.set(r.team_id, r);
    }
    const draftMap = new Map();
    for (const r of draftRows) {
      draftMap.set(r.team_id, r);
    }

    // Check moved & added
    for (const [teamId, dRow] of draftMap.entries()) {
      const aRow = activeMap.get(teamId);
      if (!aRow) {
        changeSummary.added_count++;
        changeSummary.details.push({
          type: 'added',
          team_id: teamId,
          team_code: dRow.team_code,
          team_name: dRow.team_name,
          to_panel: dRow.panel_code
        });
      } else if (aRow.panel_id !== dRow.panel_id) {
        changeSummary.moved_count++;
        changeSummary.details.push({
          type: 'moved',
          team_id: teamId,
          team_code: dRow.team_code,
          team_name: dRow.team_name,
          from_panel: aRow.panel_code,
          to_panel: dRow.panel_code
        });
      }
    }

    // Check removed (in active, but absent in draft)
    for (const [teamId, aRow] of activeMap.entries()) {
      if (!draftMap.has(teamId)) {
        changeSummary.removed_count++;
        changeSummary.details.push({
          type: 'removed',
          team_id: teamId,
          team_code: aRow.team_code,
          team_name: aRow.team_name,
          from_panel: aRow.panel_code
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    checks: {
      no_duplicates: dupRows.length === 0,
      zero_unassigned: unassignedCount === 0,
      panel_team_count_balance: isBalanced,
      balance_range: '18-22',
      panel_balance_details: panelBalance
    },
    errors,
    warnings,
    changes: changeSummary,
    stats: {
      total_teams: totalTeams,
      assigned_count: assignedCount,
      unassigned_count: unassignedCount,
      distribution: dist
    }
  };
}

/**
 * Publishes a DRAFT revision atomically:
 * 1. Validates the revision.
 * 2. Archives previous active published revision (`is_active = FALSE`, `status = 'ARCHIVED'`).
 * 3. Activates this revision (`is_active = TRUE`, `status = 'PUBLISHED'`, `published_at = NOW()`).
 * 4. Synchronizes legacy `teams.panel_no` and `teams.venue` for backwards compatibility.
 */
async function publishRevision(revisionId, adminUsername) {
  const rev = await getRevisionById(revisionId);
  if (!rev) throw new Error('Revision not found.');
  if (rev.status !== 'DRAFT') {
    throw new Error(`Only a DRAFT revision can be published. Current status is ${rev.status}.`);
  }

  const validation = await validateRevision(revisionId);
  if (!validation.isValid) {
    throw new Error(`Cannot publish revision: ${validation.errors.join(' ')}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Deactivate old published revisions
    await conn.execute(`
      UPDATE allocation_revisions
      SET is_active = FALSE, status = 'ARCHIVED'
      WHERE status = 'PUBLISHED' AND is_active = TRUE
    `);

    // 2. Activate this revision
    await conn.execute(`
      UPDATE allocation_revisions
      SET is_active = TRUE, status = 'PUBLISHED', published_at = NOW()
      WHERE id = ?
    `, [revisionId]);

    // 3. Synchronize legacy columns in `teams` table
    // For assigned teams:
    await conn.execute(`
      UPDATE teams t
      JOIN panel_project_assignments a ON a.team_id = t.id AND a.revision_id = ?
      JOIN jury_panels p ON p.id = a.panel_id
      SET t.panel_no = CAST(SUBSTRING(p.panel_code, 2) AS UNSIGNED),
          t.venue = p.venue
    `, [revisionId]);

    // For unassigned teams in this revision: set panel_no = NULL, venue = NULL
    await conn.execute(`
      UPDATE teams t
      LEFT JOIN panel_project_assignments a ON a.team_id = t.id AND a.revision_id = ?
      SET t.panel_no = NULL,
          t.venue = NULL
      WHERE a.id IS NULL
    `, [revisionId]);

    // 4. Audit log
    await conn.execute(`
      INSERT INTO allocation_audit_logs (revision_id, action, admin_username, details)
      VALUES (?, 'PUBLISH_REVISION', ?, JSON_OBJECT('assigned_teams', ?, 'unassigned_teams', ?))
    `, [revisionId, adminUsername || 'admin', validation.stats.assigned_count, validation.stats.unassigned_count]);

    await conn.commit();
    console.log(`[OK] Revision ${rev.revision_number} successfully published and activated.`);
    return getRevisionById(revisionId);
  } catch (err) {
    await conn.rollback();
    console.error('[ERROR] Failed to publish revision:', err);
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Discards a DRAFT revision and deletes its working assignments.
 */
async function discardDraft(revisionId, adminUsername) {
  const rev = await getRevisionById(revisionId);
  if (!rev) throw new Error('Revision not found.');
  if (rev.status !== 'DRAFT') {
    throw new Error('Only DRAFT revisions can be discarded. Published revisions are immutable.');
  }

  await pool.execute('DELETE FROM panel_project_assignments WHERE revision_id = ?', [revisionId]);
  await pool.execute('DELETE FROM allocation_revisions WHERE id = ?', [revisionId]);

  await pool.execute(`
    INSERT INTO allocation_audit_logs (revision_id, action, admin_username, details)
    VALUES (?, 'DISCARD_DRAFT', ?, JSON_OBJECT('revision_number', ?))
  `, [revisionId, adminUsername || 'admin', rev.revision_number]);

  return { ok: true, discarded_revision: rev.revision_number };
}

/**
 * Returns revision history.
 */
async function getRevisionHistory() {
  const [rows] = await pool.execute(`
    SELECT 
      r.id, r.revision_number, r.status, r.is_active, r.created_by, r.created_at, r.published_at, r.notes,
      (SELECT COUNT(*) FROM panel_project_assignments a WHERE a.revision_id = r.id) AS assigned_count
    FROM allocation_revisions r
    ORDER BY r.revision_number DESC
  `);
  return rows;
}

module.exports = {
  getActivePublishedRevision,
  getRevisionById,
  getDraftRevision,
  getAllPanels,
  getRevisionDetails,
  createDraftFromPublished,
  assignTeamInDraft,
  removeTeamFromDraft,
  validateRevision,
  publishRevision,
  discardDraft,
  getRevisionHistory
};

