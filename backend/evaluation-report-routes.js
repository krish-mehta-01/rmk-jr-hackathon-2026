const express = require('express');
const jwt = require('jsonwebtoken');
const {
  getEvaluationStatusReport,
  getThemeRankings,
  getOverallRankings,
  buildEvaluationStatusWorkbook,
  buildThemeRankingsWorkbook,
  buildOverallRankingsWorkbook
} = require('./evaluation-report-service');

const router = express.Router();
const { JWT_SECRET, validateSession } = require('./auth-helper');

/**
 * Authentication Middleware:
 * Strictly allows administrators (Main Admin with role 'admin' or Jury Admin with role 'jury-admin').
 * Strictly blocks ordinary judges (role 'judge') and unauthenticated requests.
 */
async function authAdminOrJuryAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Administrator authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'admin' || decoded.role === 'jury-admin') {
      const validated = await validateSession(decoded);
      if (!validated) return res.status(401).json({ error: 'Password changed or session invalid. Please log in again.' });
      req.user = validated;
      return next();
    }
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 1. EVALUATION STATUS ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports/evaluations/status
 * Query parameters: search, theme, panel, status
 */
router.get('/evaluations/status', authAdminOrJuryAdmin, async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      theme: req.query.theme,
      panel: req.query.panel,
      status: req.query.status
    };
    const report = await getEvaluationStatusReport(filters);
    res.json(report);
  } catch (err) {
    console.error('[ERROR] /reports/evaluations/status:', err);
    res.status(500).json({ error: 'Failed to retrieve evaluation status report' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. THEME-WISE RANKINGS ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports/rankings/theme
 * Query parameters: theme (e.g. 'Robotics' or 'ALL'), topN (e.g. '3', '5', '10', 'ALL')
 */
router.get('/rankings/theme', authAdminOrJuryAdmin, async (req, res) => {
  try {
    const selectedTheme = req.query.theme || 'ALL';
    const topN = req.query.topN || 'ALL';
    const rankings = await getThemeRankings(selectedTheme, { topN });
    res.json({ ...rankings, topN });
  } catch (err) {
    console.error('[ERROR] /reports/rankings/theme:', err);
    res.status(500).json({ error: 'Failed to retrieve theme rankings' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. OVERALL RANKINGS ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports/rankings/overall
 */
router.get('/rankings/overall', authAdminOrJuryAdmin, async (req, res) => {
  try {
    const overall = await getOverallRankings();
    res.json(overall);
  } catch (err) {
    console.error('[ERROR] /reports/rankings/overall:', err);
    res.status(500).json({ error: 'Failed to retrieve overall rankings' });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. EXCEL EXPORT ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports/export/status-excel
 * Downloads Complete Evaluation Status Report (Workbook A)
 */
router.get('/export/status-excel', authAdminOrJuryAdmin, async (req, res) => {
  try {
    const wb = await buildEvaluationStatusWorkbook();
    const filename = `RMK_Jr_Hackathon_2026_Evaluation_Status_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[ERROR] /export/status-excel:', err);
    res.status(500).json({ error: 'Failed to generate evaluation status Excel workbook' });
  }
});

/**
 * GET /api/admin/reports/export/theme-excel
 * Downloads Theme-wise Ranking Report (Workbook B)
 * Query parameters: topN (e.g. '1', '2', '3', '5', '10', 'ALL')
 */
router.get('/export/theme-excel', authAdminOrJuryAdmin, async (req, res) => {
  try {
    const topN = req.query.topN || 'ALL';
    const wb = await buildThemeRankingsWorkbook({ topN });
    const scopeTag = topN && String(topN).toUpperCase() !== 'ALL' ? `_Top_${topN}` : '';
    const filename = `RMK_Jr_Hackathon_2026_Theme_Rankings${scopeTag}_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[ERROR] /export/theme-excel:', err);
    res.status(500).json({ error: 'Failed to generate theme rankings Excel workbook' });
  }
});

/**
 * GET /api/admin/reports/export/overall-excel
 * Downloads Overall Grand Ranking Report (Workbook C)
 */
router.get('/export/overall-excel', authAdminOrJuryAdmin, async (req, res) => {
  try {
    const wb = await buildOverallRankingsWorkbook();
    const filename = `RMK_Jr_Hackathon_2026_Overall_Rankings_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[ERROR] /export/overall-excel:', err);
    res.status(500).json({ error: 'Failed to generate overall rankings Excel workbook' });
  }
});

module.exports = router;

