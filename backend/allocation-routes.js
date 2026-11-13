const express = require('express');
const router = express.Router();
const allocService = require('./allocation-service');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// Admin authentication middleware (matching existing requireRole('admin'))
function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Please log in again.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied: Admin only' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// 1. Get current allocation summary (Active published revision + Draft if in progress)
router.get('/allocations/summary', authAdmin, async (req, res) => {
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

// 2. Get all panels with physical venues
router.get('/allocations/panels', authAdmin, async (req, res) => {
  try {
    const panels = await allocService.getAllPanels();
    res.json({ panels });
  } catch (err) {
    console.error('[ERROR] GET /allocations/panels:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 3. Get revision history
router.get('/allocations/revisions', authAdmin, async (req, res) => {
  try {
    const revisions = await allocService.getRevisionHistory();
    res.json({ revisions });
  } catch (err) {
    console.error('[ERROR] GET /allocations/revisions:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 4. Get full revision details (panels, assigned teams, unassigned teams)
router.get('/allocations/revisions/:id', authAdmin, async (req, res) => {
  try {
    const revId = parseInt(req.params.id, 10);
    const details = await allocService.getRevisionDetails(revId);
    if (!details) return res.status(404).json({ error: 'Revision not found' });
    res.json(details);
  } catch (err) {
    console.error('[ERROR] GET /allocations/revisions/:id:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// 5. Create a new DRAFT revision branched from the active published revision
router.post('/allocations/draft', authAdmin, async (req, res) => {
  try {
    const { notes } = req.body || {};
    const draft = await allocService.createDraftFromPublished(req.user.username || 'admin', notes);
    res.json({ ok: true, draft });
  } catch (err) {
    console.error('[ERROR] POST /allocations/draft:', err);
    res.status(400).json({ error: err.message || 'Failed to create draft' });
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

// 7. Remove a team assignment from a DRAFT (moves team to unassigned pool)
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

// 8. Validate a DRAFT revision before publishing
router.get('/allocations/draft/:id/validate', authAdmin, async (req, res) => {
  try {
    const draftId = parseInt(req.params.id, 10);
    const validation = await allocService.validateRevision(draftId);
    res.json(validation);
  } catch (err) {
    console.error('[ERROR] GET /allocations/draft/:id/validate:', err);
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
    const { draft_id } = req.body || {};
    if (!draft_id) return res.status(400).json({ error: 'draft_id is required' });

    const result = await allocService.discardDraft(
      parseInt(draft_id, 10),
      req.user.username || 'admin'
    );
    res.json(result);
  } catch (err) {
    console.error('[ERROR] POST /allocations/draft/discard:', err);
    res.status(400).json({ error: err.message || 'Failed to discard draft' });
  }
});

module.exports = router;

