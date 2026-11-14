const express = require('express');
const router = express.Router();
const allocService = require('./allocation-service');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, validateSession } = require('./auth-helper');

// Admin authentication middleware (strictly for mutations/draft actions)
async function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Please log in again.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied: Admin only' });
    const validated = await validateSession(decoded);
    if (!validated) return res.status(401).json({ error: 'Password changed or session invalid. Please log in again.' });
    req.user = validated;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Read-only allocation access middleware: Admin, Jury Admin, and Judge/Jury
async function authReadAllocations(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Please log in to view allocations.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const allowed = ['admin', 'jury-admin', 'judge', 'jury'];
    if (!allowed.includes(decoded.role)) {
      return res.status(403).json({ error: 'Access denied: Read allocations permission required.' });
    }
    const validated = await validateSession(decoded);
    if (!validated) return res.status(401).json({ error: 'Password changed or session invalid. Please log in again.' });
    req.user = validated;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// 1. Get current allocation summary (Active published revision + Draft if in progress)
router.get('/allocations/summary', authReadAllocations, async (req, res) => {
  try {
    const active = await allocService.getActivePublishedRevision();
    const draft = await allocService.getDraftRevision();
    const panels = await allocService.getAllPanels();

    let activeDetails = null;
    if (active) {
      activeDetails = await allocService.getRevisionDetails(active.id);
    }

    res.json({
      active_revision: active,
      active_stats: activeDetails ? activeDetails.stats : null,
      draft_revision: draft,
      panels
    });
  } catch (err) {
    console.error('[ERROR] GET /allocations/summary:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 1b. Get active published allocation revision details directly
router.get('/allocations/active', authReadAllocations, async (req, res) => {
  try {
    const active = await allocService.getActivePublishedRevision();
    if (!active) return res.status(404).json({ error: 'No active published revision found' });
    const details = await allocService.getRevisionDetails(active.id);
    res.json({
      ok: true,
      active_revision: active,
      revision: details.revision,
      panels: details.panels,
      assigned: details.assigned,
      unassigned: details.unassigned,
      total_panels: details.panels.length,
      total_teams: details.stats.total_teams,
      assigned_count: details.stats.assigned_count,
      unassigned_count: details.stats.unassigned_count,
      stats: details.stats
    });
  } catch (err) {
    console.error('[ERROR] GET /allocations/active:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 2. Get all panels with physical venues
router.get('/allocations/panels', authReadAllocations, async (req, res) => {
  try {
    const panels = await allocService.getAllPanels();
    res.json({ panels });
  } catch (err) {
    console.error('[ERROR] GET /allocations/panels:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 3. Get revision history
// If token is provided and valid as admin, returns full revision history (including drafts).
// If no token or invalid/expired token or non-admin, falls back to returning published revisions so the modal ALWAYS renders!
router.get('/allocations/revisions', async (req, res) => {
  let user = null;
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (['admin', 'jury-admin', 'judge', 'jury'].includes(decoded.role)) {
        user = decoded;
      }
    } catch {
      // Fall through to public published fallback
    }
  }

  try {
    const revisions = await allocService.getRevisionHistory();
    if (user && user.role === 'admin') {
      return res.json({ revisions });
    }
    const published = (revisions || []).filter(r => r.status === 'PUBLISHED');
    return res.json({ revisions: published.length > 0 ? published : revisions });
  } catch (err) {
    console.error('[ERROR] GET /allocations/revisions:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 4. Get full revision details (panels, assigned teams, unassigned teams)
router.get('/allocations/revisions/:id', authReadAllocations, async (req, res) => {
  try {
    const revId = parseInt(req.params.id, 10);
    const details = await allocService.getRevisionDetails(revId);
    if (!details) return res.status(404).json({ error: 'Revision not found' });
    res.json(details);
  } catch (err) {
    console.error(`[ERROR] GET /allocations/revisions/${req.params.id}:`, err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 5. Create a new DRAFT revision branched from the active published revision
router.post('/allocations/draft', authAdmin, async (req, res) => {
  try {
    const { notes, action } = req.body || {};
    if (action === 'discard') {
      let draftId = req.body?.draft_id;
      if (!draftId) {
        const draft = await allocService.getDraftRevision();
        if (!draft) return res.status(404).json({ error: 'No draft revision found to discard' });
        draftId = draft.id;
      }
      const result = await allocService.discardDraft(parseInt(draftId, 10), req.user.username || 'admin');
      return res.json(result);
    }

    const draft = await allocService.createDraftFromPublished(req.user.username || 'admin', notes);
    res.json({ ok: true, draft });
  } catch (err) {
    console.error('[ERROR] POST /allocations/draft:', err);
    res.status(400).json({ error: err.message || 'Failed to create draft' });
  }
});

// 5b. Discard draft revision via DELETE /allocations/draft
router.delete('/allocations/draft', authAdmin, async (req, res) => {
  try {
    let draftId = req.body?.draft_id || req.query?.draft_id;
    if (!draftId) {
      const draft = await allocService.getDraftRevision();
      if (!draft) return res.status(404).json({ error: 'No active draft revision found to discard' });
      draftId = draft.id;
    }
    const result = await allocService.discardDraft(parseInt(draftId, 10), req.user.username || 'admin');
    res.json(result);
  } catch (err) {
    console.error('[ERROR] DELETE /allocations/draft:', err);
    res.status(400).json({ error: err.message || 'Failed to discard draft' });
  }
});

// 6. Assign or move a team to a panel within a DRAFT
router.post('/allocations/draft/assign', authAdmin, async (req, res) => {
  try {
    const { draft_id, team_id, panel_id } = req.body || {};
    if (!draft_id || !team_id || !panel_id) {
      return res.status(400).json({ error: 'draft_id, team_id and panel_id are required' });
    }

    const result = await allocService.assignTeamInDraft(
      parseInt(draft_id, 10),
      parseInt(team_id, 10),
      parseInt(panel_id, 10),
      req.user.username || 'admin'
    );
    res.json(result);
  } catch (err) {
    console.error('[ERROR] POST /allocations/draft/assign:', err);
    res.status(400).json({ error: err.message || 'Failed to assign team' });
  }
});

// 7. Remove a team from a panel within a DRAFT (move to unassigned pool)
router.post('/allocations/draft/remove', authAdmin, async (req, res) => {
  try {
    const { draft_id, team_id } = req.body || {};
    if (!draft_id || !team_id) {
      return res.status(400).json({ error: 'draft_id and team_id are required' });
    }

    const result = await allocService.removeTeamFromDraft(
      parseInt(draft_id, 10),
      parseInt(team_id, 10),
      req.user.username || 'admin'
    );
    res.json(result);
  } catch (err) {
    console.error('[ERROR] POST /allocations/draft/remove:', err);
    res.status(400).json({ error: err.message || 'Failed to remove team' });
  }
});

// 8. Validate a DRAFT revision before publishing (GET with ID)
router.get('/allocations/draft/:id/validate', authAdmin, async (req, res) => {
  try {
    const draftId = parseInt(req.params.id, 10);
    const validation = await allocService.validateRevision(draftId);
    res.json(validation);
  } catch (err) {
    console.error(`[ERROR] GET /allocations/draft/${req.params.id}/validate:`, err);
    res.status(400).json({ error: err.message || 'Validation failed' });
  }
});

// 8b. Validate draft revision via POST /allocations/validate
router.post('/allocations/validate', authAdmin, async (req, res) => {
  try {
    let draftId = req.body?.draft_id || req.body?.revision_id;
    if (!draftId) {
      const draft = await allocService.getDraftRevision();
      if (draft) {
        draftId = draft.id;
      } else {
        const active = await allocService.getActivePublishedRevision();
        if (active) draftId = active.id;
      }
    }
    if (!draftId) {
      return res.status(404).json({ error: 'No draft or active revision found to validate' });
    }

    const validation = await allocService.validateRevision(parseInt(draftId, 10));
    res.json({
      ok: true,
      revision_id: parseInt(draftId, 10),
      ...validation
    });
  } catch (err) {
    console.error('[ERROR] POST /allocations/validate:', err);
    res.status(400).json({ error: err.message || 'Validation failed' });
  }
});

// 9. Publish a DRAFT revision (with explicit Admin confirmation)
router.post('/allocations/draft/publish', authAdmin, async (req, res) => {
  try {
    const { draft_id, confirmed } = req.body || {};
    if (!draft_id) return res.status(400).json({ error: 'draft_id is required' });
    if (!confirmed) {
      return res.status(400).json({ error: 'Explicit Admin confirmation is required to publish.' });
    }

    const published = await allocService.publishRevision(
      parseInt(draft_id, 10),
      req.user.username || 'admin'
    );
    res.json({ ok: true, published_revision: published });
  } catch (err) {
    console.error('[ERROR] POST /allocations/draft/publish:', err);
    res.status(400).json({ error: err.message || 'Failed to publish allocation' });
  }
});

// 10. Discard a DRAFT revision
router.post('/allocations/draft/discard', authAdmin, async (req, res) => {
  try {
    let draftId = req.body?.draft_id;
    if (!draftId) {
      const draft = await allocService.getDraftRevision();
      if (!draft) return res.status(404).json({ error: 'No active draft revision found to discard' });
      draftId = draft.id;
    }

    const result = await allocService.discardDraft(
      parseInt(draftId, 10),
      req.user.username || 'admin'
    );
    res.json(result);
  } catch (err) {
    console.error('[ERROR] POST /allocations/draft/discard:', err);
    res.status(400).json({ error: err.message || 'Failed to discard draft' });
  }
});

module.exports = router;
