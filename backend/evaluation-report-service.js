const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { pool } = require('./db');

const LOGO_LEFT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_group_logo.png');
const LOGO_RIGHT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_jr_hackathon_2026_logo.png');

const PALETTE = {
  headerBg: 'FFFFFF',
  headerTextDark: '000000',
  headerTextGreen: '14532D',
  ribbonBg: 'DCFCE7',
  ribbonText: '000000',
  tblHeaderBg: '166534',
  tblHeaderText: 'FFFFFF',
  rowEven: 'FFFFFF',
  rowOdd: 'F0FDF4',
  rowText: '000000',
  border: '000000',
  borderLight: 'D1D5DB',
  goldBg: 'FEF3C7',
  goldText: '92400E',
  silverBg: 'F1F5F9',
  silverText: '334155',
  bronzeBg: 'FFEDD5',
  bronzeText: '9A3412',
  pillGreenBg: 'DCFCE7',
  pillGreenText: '166534',
  pillAmberBg: 'FEF3C7',
  pillAmberText: 'B45309',
  pillGrayBg: 'F1F5F9',
  pillGrayText: '475569'
};

const BORDER_THIN = {
  top: { style: 'thin', color: { argb: PALETTE.border } },
  left: { style: 'thin', color: { argb: PALETTE.border } },
  bottom: { style: 'thin', color: { argb: PALETTE.border } },
  right: { style: 'thin', color: { argb: PALETTE.border } }
};

/**
 * Standard Competition Ranking (1, 2, 2, 4)
 * Teams must be sorted descending by combined_score, then team_code ASC for display stability.
 */
function assignCompetitionRanks(teams) {
  let rank = 1;
  for (let i = 0; i < teams.length; i++) {
    if (i > 0 && teams[i].combined_score === teams[i - 1].combined_score) {
      teams[i].rank = teams[i - 1].rank;
    } else {
      teams[i].rank = i + 1;
    }
  }
  return teams;
}

/**
 * Filter ranked teams to Top N including all ties at the cutoff rank
 * Note: Ranks must already be calculated across all eligible teams prior to calling this function.
 */
function filterTopNWithTies(rankedTeams, topN) {
  if (!topN || topN === 'ALL' || topN === 'all' || Number(topN) === 0) {
    return rankedTeams;
  }
  const n = parseInt(topN, 10);
  if (isNaN(n) || n <= 0) return rankedTeams;
  return (rankedTeams || []).filter(t => t.rank <= n);
}

/**
 * Sanitize Excel sheet name (max 31 chars, no forbidden chars: \ / ? * [ ] :)
 */
function sanitizeSheetName(name, existingNames = new Set()) {
  let clean = String(name || 'Sheet')
    .replace(/[\\/?*[\]:]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length > 31) {
    clean = clean.substring(0, 31).trim();
  }

  let finalName = clean;
  let counter = 1;
  while (existingNames.has(finalName.toLowerCase())) {
    const suffix = ` (${counter})`;
    const maxLen = 31 - suffix.length;
    finalName = clean.substring(0, maxLen) + suffix;
    counter++;
  }

  existingNames.add(finalName.toLowerCase());
  return finalName;
}

/**
 * Core Database Query:
 * Retrieves all registered teams with panel allocation from active published revision
 * and submitted/draft evaluations for internal and external judges.
 */
async function fetchAllEvaluationData() {
  const [rows] = await pool.execute(`
    SELECT 
      t.id AS team_id,
      t.team_code,
      t.team_name,
      t.project_title,
      t.category AS theme,
      t.leader_name,
      t.college_name AS school,
      t.members,
      t.mentor_name,
      t.mentor_contact,
      t.mobile_no,
      t.is_present,
      
      COALESCE(p.panel_code, CONCAT('P', t.panel_no), 'Unassigned') AS panel_code,
      COALESCE(p.panel_name, CONCAT('Panel ', t.panel_no), 'Unassigned') AS panel_name,
      COALESCE(p.venue, t.venue, 'Venue Pending') AS panel_venue,
      
      -- Internal evaluation
      e_in.id AS in_eval_id,
      e_in.status AS in_status,
      e_in.total_score AS in_score,
      e_in.remarks AS in_remarks,
      e_in.submitted_at AS in_submitted_at,
      u_in.username AS in_judge_username,
      prof_in.full_name AS in_judge_name,

      -- External evaluation
      e_ex.id AS ex_eval_id,
      e_ex.status AS ex_status,
      e_ex.total_score AS ex_score,
      e_ex.remarks AS ex_remarks,
      e_ex.submitted_at AS ex_submitted_at,
      u_ex.username AS ex_judge_username,
      prof_ex.full_name AS ex_judge_name

    FROM teams t
    LEFT JOIN panel_project_assignments a ON a.team_id = t.id 
      AND a.revision_id = (SELECT id FROM allocation_revisions WHERE is_active = TRUE AND status = 'PUBLISHED' LIMIT 1)
    LEFT JOIN jury_panels p ON p.id = a.panel_id
    
    LEFT JOIN project_evaluations e_in ON e_in.team_id = t.id 
      AND (e_in.panel_id = a.panel_id OR a.panel_id IS NULL) 
      AND e_in.judge_type = 'INTERNAL'
    LEFT JOIN jury_users u_in ON u_in.id = e_in.judge_id
    LEFT JOIN jury_profiles prof_in ON prof_in.user_id = u_in.id
    
    LEFT JOIN project_evaluations e_ex ON e_ex.team_id = t.id 
      AND (e_ex.panel_id = a.panel_id OR a.panel_id IS NULL) 
      AND e_ex.judge_type = 'EXTERNAL'
    LEFT JOIN jury_users u_ex ON u_ex.id = e_ex.judge_id
    LEFT JOIN jury_profiles prof_ex ON prof_ex.user_id = u_ex.id

    ORDER BY t.category ASC, t.team_code ASC
  `);

  return rows.map(r => {
    const inSubmitted = r.in_status === 'SUBMITTED';
    const exSubmitted = r.ex_status === 'SUBMITTED';

    let overallStatus = 'NOT_EVALUATED';
    let statusLabel = 'Not Evaluated';

    if (inSubmitted && exSubmitted) {
      overallStatus = 'FULLY_EVALUATED';
      statusLabel = 'Fully Evaluated';
    } else if (inSubmitted && !exSubmitted) {
      overallStatus = 'INTERNAL_EVALUATED';
      statusLabel = 'Internal Evaluated';
    } else if (!inSubmitted && exSubmitted) {
      overallStatus = 'EXTERNAL_EVALUATED';
      statusLabel = 'External Evaluated';
    }

    const inScore = inSubmitted ? Number(parseFloat(r.in_score || 0).toFixed(2)) : null;
    const exScore = exSubmitted ? Number(parseFloat(r.ex_score || 0).toFixed(2)) : null;
    const combinedScore = (inSubmitted && exSubmitted) ? Number((inScore + exScore).toFixed(2)) : null;

    return {
      team_id: r.team_id,
      team_code: r.team_code,
      team_name: r.team_name,
      project_title: r.project_title || '—',
      theme: r.theme || 'General',
      panel_code: r.panel_code,
      panel_venue: r.panel_venue,
      school: r.school || '—',
      leader_name: r.leader_name || '—',
      leader_phone: r.mobile_no || '—',
      members: r.members || '',
      mentor_name: r.mentor_name || '—',
      mentor_contact: r.mentor_contact || '—',
      is_present: Boolean(r.is_present),

      internal_status: inSubmitted ? 'SUBMITTED' : (r.in_status === 'DRAFT' ? 'DRAFT' : 'PENDING'),
      internal_status_label: inSubmitted ? 'Submitted' : (r.in_status === 'DRAFT' ? 'Draft' : 'Pending'),
      internal_marks: inScore,
      internal_judge: inSubmitted ? (r.in_judge_name || r.in_judge_username) : null,
      internal_submitted_at: inSubmitted ? r.in_submitted_at : null,
      internal_remarks: inSubmitted ? r.in_remarks : null,

      external_status: exSubmitted ? 'SUBMITTED' : (r.ex_status === 'DRAFT' ? 'DRAFT' : 'PENDING'),
      external_status_label: exSubmitted ? 'Submitted' : (r.ex_status === 'DRAFT' ? 'Draft' : 'Pending'),
      external_marks: exScore,
      external_judge: exSubmitted ? (r.ex_judge_name || r.ex_judge_username) : null,
      external_submitted_at: exSubmitted ? r.ex_submitted_at : null,
      external_remarks: exSubmitted ? r.ex_remarks : null,

      combined_score: combinedScore,
      overall_status: overallStatus,
      overall_status_label: statusLabel,
      is_fully_evaluated: inSubmitted && exSubmitted
    };
  });
}

/**
 * Evaluation Status Data with Filtering & Summary Stats
 */
async function getEvaluationStatusReport(filters = {}) {
  const allTeams = await fetchAllEvaluationData();

  // Summary counts across all teams (before filters)
  const totalTeams = allTeams.length;
  let fullyEvaluated = 0;
  let internalEvaluatedOnly = 0;
  let externalEvaluatedOnly = 0;
  let notEvaluated = 0;
  let internalPending = 0;
  let externalPending = 0;

  const themeStatsMap = new Map();

  for (const t of allTeams) {
    if (t.overall_status === 'FULLY_EVALUATED') fullyEvaluated++;
    else if (t.overall_status === 'INTERNAL_EVALUATED') internalEvaluatedOnly++;
    else if (t.overall_status === 'EXTERNAL_EVALUATED') externalEvaluatedOnly++;
    else notEvaluated++;

    if (t.internal_status !== 'SUBMITTED') internalPending++;
    if (t.external_status !== 'SUBMITTED') externalPending++;

    if (!themeStatsMap.has(t.theme)) {
      themeStatsMap.set(t.theme, { theme: t.theme, total: 0, fully_evaluated: 0, pending: 0 });
    }
    const ts = themeStatsMap.get(t.theme);
    ts.total++;
    if (t.is_fully_evaluated) ts.fully_evaluated++;
    else ts.pending++;
  }

  const completionPercent = totalTeams > 0 ? Number(((fullyEvaluated / totalTeams) * 100).toFixed(1)) : 0;

  // Apply filters
  let filtered = allTeams;
  const search = String(filters.search || '').trim().toLowerCase();
  const themeFilter = String(filters.theme || '').trim();
  const panelFilter = String(filters.panel || '').trim().toUpperCase();
  const statusFilter = String(filters.status || '').trim().toUpperCase();

  if (search) {
    filtered = filtered.filter(t =>
      t.team_code.toLowerCase().includes(search) ||
      t.team_name.toLowerCase().includes(search) ||
      t.project_title.toLowerCase().includes(search) ||
      t.panel_code.toLowerCase().includes(search) ||
      t.theme.toLowerCase().includes(search)
    );
  }

  if (themeFilter && themeFilter !== 'ALL') {
    filtered = filtered.filter(t => t.theme.toLowerCase() === themeFilter.toLowerCase());
  }

  if (panelFilter && panelFilter !== 'ALL') {
    filtered = filtered.filter(t => t.panel_code.toUpperCase() === panelFilter);
  }

  if (statusFilter && statusFilter !== 'ALL') {
    if (statusFilter === 'FULLY_EVALUATED') {
      filtered = filtered.filter(t => t.overall_status === 'FULLY_EVALUATED');
    } else if (statusFilter === 'PENDING') {
      filtered = filtered.filter(t => t.overall_status !== 'FULLY_EVALUATED');
    } else if (statusFilter === 'INTERNAL_PENDING') {
      filtered = filtered.filter(t => t.internal_status !== 'SUBMITTED');
    } else if (statusFilter === 'EXTERNAL_PENDING') {
      filtered = filtered.filter(t => t.external_status !== 'SUBMITTED');
    } else if (statusFilter === 'NOT_EVALUATED') {
      filtered = filtered.filter(t => t.overall_status === 'NOT_EVALUATED');
    } else {
      filtered = filtered.filter(t => t.overall_status === statusFilter);
    }
  }

  // Sort teams:
  // 1. Both evaluated (FULLY_EVALUATED)
  // 2. Evaluated by only external (EXTERNAL_EVALUATED)
  // 3. Evaluated by only internal (INTERNAL_EVALUATED)
  // 4. Evaluated by none (NOT_EVALUATED)
  // Within each group, arrange by team ID (team_code ascending)
  filtered.sort((a, b) => {
    const getPriority = (t) => {
      if (t.overall_status === 'FULLY_EVALUATED') return 1;
      if (t.overall_status === 'EXTERNAL_EVALUATED') return 2;
      if (t.overall_status === 'INTERNAL_EVALUATED') return 3;
      return 4;
    };
    const prioA = getPriority(a);
    const prioB = getPriority(b);
    if (prioA !== prioB) return prioA - prioB;
    return String(a.team_code || '').localeCompare(String(b.team_code || ''), undefined, { numeric: true });
  });

  return {
    summary: {
      total_teams: totalTeams,
      fully_evaluated: fullyEvaluated,
      internal_evaluated_only: internalEvaluatedOnly,
      external_evaluated_only: externalEvaluatedOnly,
      internal_pending: internalPending,
      external_pending: externalPending,
      not_evaluated: notEvaluated,
      completion_percent: completionPercent,
      theme_breakdown: Array.from(themeStatsMap.values())
    },
    teams: filtered
  };
}

/**
 * Theme-wise Rankings
 */
async function getThemeRankings(selectedTheme = null) {
  const allTeams = await fetchAllEvaluationData();

  // Group teams by theme
  const themesMap = new Map();
  for (const t of allTeams) {
    if (!themesMap.has(t.theme)) {
      themesMap.set(t.theme, {
        theme: t.theme,
        total_teams: 0,
        fully_evaluated_count: 0,
        pending_count: 0,
        ranked_teams: [],
        pending_teams: []
      });
    }

    const group = themesMap.get(t.theme);
    group.total_teams++;

    if (t.is_fully_evaluated) {
      group.fully_evaluated_count++;
      group.ranked_teams.push({ ...t });
    } else {
      group.pending_count++;
      group.pending_teams.push({ ...t });
    }
  }

  // Calculate ranks for each theme
  for (const group of themesMap.values()) {
    // Sort completed teams: descending by combined_score, then team_code ASC
    group.ranked_teams.sort((a, b) => {
      if (b.combined_score !== a.combined_score) {
        return b.combined_score - a.combined_score;
      }
      return a.team_code.localeCompare(b.team_code);
    });

    assignCompetitionRanks(group.ranked_teams);

    // Sort pending teams by team_code ASC
    group.pending_teams.sort((a, b) => a.team_code.localeCompare(b.team_code));
  }

  const allThemesList = Array.from(themesMap.values());

  if (selectedTheme && selectedTheme !== 'ALL') {
    const single = allThemesList.find(th => th.theme.toLowerCase() === selectedTheme.toLowerCase());
    return {
      themes: single ? [single] : [],
      available_themes: allThemesList.map(th => th.theme)
    };
  }

  return {
    themes: allThemesList,
    available_themes: allThemesList.map(th => th.theme)
  };
}

/**
 * Overall Hackathon Leaderboard
 */
async function getOverallRankings() {
  const allTeams = await fetchAllEvaluationData();

  const fullyEvaluatedTeams = [];
  const pendingTeams = [];

  for (const t of allTeams) {
    if (t.is_fully_evaluated) {
      fullyEvaluatedTeams.push({ ...t });
    } else {
      pendingTeams.push({ ...t });
    }
  }

  // Sort descending by combined_score, then team_code ASC
  fullyEvaluatedTeams.sort((a, b) => {
    if (b.combined_score !== a.combined_score) {
      return b.combined_score - a.combined_score;
    }
    return a.team_code.localeCompare(b.team_code);
  });

  assignCompetitionRanks(fullyEvaluatedTeams);

  // Sort pending teams by team_code ASC
  pendingTeams.sort((a, b) => a.team_code.localeCompare(b.team_code));

  return {
    total_registered: allTeams.length,
    fully_evaluated_count: fullyEvaluatedTeams.length,
    pending_count: pendingTeams.length,
    ranked_teams: fullyEvaluatedTeams,
    pending_teams: pendingTeams
  };
}

/**
 * Apply Standard Executive Header with Flanking Logos to an ExcelJS worksheet
 */
function applyExecutiveHeader(ws, title, subtitle, totalCols) {
  // Rows 1-3
  ws.mergeCells(1, 1, 1, totalCols);
  ws.mergeCells(2, 1, 2, totalCols);
  ws.mergeCells(3, 1, 3, totalCols);

  const r1 = ws.getCell(1, 1);
  r1.value = 'R.M.K. GROUP OF INSTITUTIONS';
  r1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: PALETTE.headerTextGreen } };
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  const r2 = ws.getCell(2, 1);
  r2.value = title;
  r2.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: PALETTE.headerTextDark } };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  const r3 = ws.getCell(3, 1);
  r3.value = `${subtitle} • Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  r3.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: '64748B' } };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 18;

  ws.getRow(4).height = 8; // Spacer row
}

/**
 * Export A: Complete Evaluation Status Report (Workbook)
 */
async function buildEvaluationStatusWorkbook() {
  const data = await getEvaluationStatusReport({});
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RMK Jr. Hackathon 2026 Admin';
  wb.created = new Date();

  // Sheet 1: Evaluation Status
  const ws1 = wb.addWorksheet('Evaluation Status', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
  });

  const cols1 = [
    { key: 'sl', header: 'Sl. No.', width: 8 },
    { key: 'team_code', header: 'Team ID', width: 15 },
    { key: 'team_name', header: 'Team Name', width: 28 },
    { key: 'project_title', header: 'Project Title', width: 38 },
    { key: 'theme', header: 'Theme / Domain', width: 30 },
    { key: 'panel_code', header: 'Panel', width: 10 },
    { key: 'panel_venue', header: 'Panel Venue', width: 28 },
    { key: 'internal_status', header: 'Internal Jury Status', width: 18 },
    { key: 'internal_marks', header: 'Internal Marks (/50)', width: 18 },
    { key: 'external_status', header: 'External Jury Status', width: 18 },
    { key: 'external_marks', header: 'External Marks (/50)', width: 18 },
    { key: 'combined_score', header: 'Combined Marks (/100)', width: 20 },
    { key: 'overall_status', header: 'Overall Status', width: 18 }
  ];

  ws1.columns = cols1;
  applyExecutiveHeader(ws1, 'RMK JUNIOR HACKATHON 2026 — COMPLETE EVALUATION STATUS REPORT', 'All Registered Teams Evaluation Progress', cols1.length);

  // Table Header Row 5
  const hRow1 = ws1.getRow(5);
  hRow1.height = 26;
  cols1.forEach((col, idx) => {
    const cell = hRow1.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER_THIN;
  });

  // Data rows
  data.teams.forEach((t, index) => {
    const rowNum = 6 + index;
    const row = ws1.getRow(rowNum);
    row.height = 20;
    const isEven = index % 2 === 0;
    const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;

    row.getCell(1).value = index + 1;
    row.getCell(2).value = t.team_code;
    row.getCell(3).value = t.team_name;
    row.getCell(4).value = t.project_title;
    row.getCell(5).value = t.theme;
    row.getCell(6).value = t.panel_code;
    row.getCell(7).value = t.panel_venue;
    row.getCell(8).value = t.internal_status_label;
    row.getCell(9).value = t.internal_marks !== null ? t.internal_marks : '—';
    row.getCell(10).value = t.external_status_label;
    row.getCell(11).value = t.external_marks !== null ? t.external_marks : '—';
    row.getCell(12).value = t.combined_score !== null ? t.combined_score : '—';
    row.getCell(13).value = t.overall_status_label;

    for (let c = 1; c <= cols1.length; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.rowText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = BORDER_THIN;
      if ([1, 2, 6, 8, 9, 10, 11, 12, 13].includes(c)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }
  });

  ws1.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + data.teams.length, column: cols1.length } };

  // Sheet 2: Summary
  const ws2 = wb.addWorksheet('Evaluation Summary', {
    views: [{ showGridLines: true }]
  });

  applyExecutiveHeader(ws2, 'RMK JUNIOR HACKATHON 2026 — EVALUATION EXECUTIVE SUMMARY', 'Statistics & Completion Metrics', 5);

  const metricRows = [
    ['Metric', 'Count / Value'],
    ['Total Registered Teams', data.summary.total_teams],
    ['Fully Evaluated Teams (Both Completed)', data.summary.fully_evaluated],
    ['Internal Evaluation Pending', data.summary.internal_pending],
    ['External Evaluation Pending', data.summary.external_pending],
    ['Not Evaluated Teams (Neither Completed)', data.summary.not_evaluated],
    ['Overall Evaluation Completion Rate', `${data.summary.completion_percent}%`]
  ];

  metricRows.forEach((m, idx) => {
    const row = ws2.getRow(5 + idx);
    row.height = 22;
    row.getCell(2).value = m[0];
    row.getCell(3).value = m[1];
    const isHead = idx === 0;

    for (let c = 2; c <= 3; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER_THIN;
      if (isHead) {
        cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.tblHeaderText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      } else {
        cell.font = { name: 'Segoe UI', size: 10, bold: c === 3 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? PALETTE.rowEven : PALETTE.rowOdd } };
      }
      cell.alignment = { horizontal: c === 3 ? 'center' : 'left', vertical: 'middle' };
    }
  });

  // Theme Breakdown Table on Sheet 2
  const startThemeRow = 14;
  const thHead = ws2.getRow(startThemeRow);
  thHead.height = 24;
  ['Theme / Domain', 'Total Teams', 'Fully Evaluated', 'Pending Evaluations', 'Completion %'].forEach((h, i) => {
    const cell = thHead.getCell(2 + i);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  data.summary.theme_breakdown.forEach((tb, i) => {
    const r = ws2.getRow(startThemeRow + 1 + i);
    r.height = 20;
    const rate = tb.total > 0 ? ((tb.fully_evaluated / tb.total) * 100).toFixed(1) + '%' : '0%';
    const vals = [tb.theme, tb.total, tb.fully_evaluated, tb.pending, rate];
    vals.forEach((v, cIdx) => {
      const cell = r.getCell(2 + cIdx);
      cell.value = v;
      cell.font = { name: 'Segoe UI', size: 9.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? PALETTE.rowEven : PALETTE.rowOdd } };
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: cIdx === 0 ? 'left' : 'center', vertical: 'middle' };
    });
  });

  ws2.getColumn(2).width = 36;
  ws2.getColumn(3).width = 16;
  ws2.getColumn(4).width = 18;
  ws2.getColumn(5).width = 22;
  ws2.getColumn(6).width = 18;

  return wb;
}

/**
 * Export B: Theme-wise Ranking Report (Workbook)
 */
async function buildThemeRankingsWorkbook({ topN = 'ALL' } = {}) {
  const { themes } = await getThemeRankings('ALL');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RMK Jr. Hackathon 2026 Admin';
  wb.created = new Date();

  const usedSheetNames = new Set();
  const isTopN = topN && String(topN).toUpperCase() !== 'ALL' && !isNaN(parseInt(topN, 10));
  const topNVal = isTopN ? parseInt(topN, 10) : null;
  const scopeLabel = isTopN ? `Top ${topNVal} Teams (with ties)` : 'All Eligible Teams';

  // Sheet 1: Summary Sheet
  const wsSummary = wb.addWorksheet('Summary', { views: [{ showGridLines: true }] });
  applyExecutiveHeader(
    wsSummary,
    'RMK JUNIOR HACKATHON 2026 — THEME-WISE RANKINGS SUMMARY',
    `Leaderboard Overview Across Themes • Scope: ${scopeLabel}`,
    7
  );

  const sumHead = wsSummary.getRow(5);
  sumHead.height = 24;
  ['Theme / Domain', 'Total Teams', 'Ranked Teams (Eligible)', isTopN ? `Shown (Top ${topNVal})` : 'Shown in Report', 'Pending Teams', 'Top Team ID', 'Top Combined Score'].forEach((h, i) => {
    const cell = sumHead.getCell(1 + i);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  themes.forEach((th, i) => {
    const row = wsSummary.getRow(6 + i);
    row.height = 20;
    const filteredRanked = isTopN ? filterTopNWithTies(th.ranked_teams, topNVal) : th.ranked_teams;
    const topTeam = th.ranked_teams.length > 0 ? th.ranked_teams[0] : null;
    const vals = [
      th.theme,
      th.total_teams,
      th.fully_evaluated_count,
      filteredRanked.length,
      th.pending_count,
      topTeam ? `${topTeam.team_code} (${topTeam.team_name})` : '—',
      topTeam ? topTeam.combined_score : '—'
    ];

    vals.forEach((v, cIdx) => {
      const cell = row.getCell(1 + cIdx);
      cell.value = v;
      cell.font = { name: 'Segoe UI', size: 9.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? PALETTE.rowEven : PALETTE.rowOdd } };
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: [0, 5].includes(cIdx) ? 'left' : 'center', vertical: 'middle' };
    });
  });

  wsSummary.columns = [
    { width: 34 },
    { width: 14 },
    { width: 22 },
    { width: 18 },
    { width: 16 },
    { width: 36 },
    { width: 20 }
  ];

  // Individual Sheets per Theme
  for (const th of themes) {
    const sheetName = sanitizeSheetName(th.theme, usedSheetNames);
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    const cols = [
      { key: 'rank', header: 'Rank', width: 9 },
      { key: 'team_code', header: 'Team ID', width: 15 },
      { key: 'team_name', header: 'Team Name', width: 28 },
      { key: 'project_title', header: 'Project Title', width: 40 },
      { key: 'panel_code', header: 'Panel', width: 10 },
      { key: 'internal_marks', header: 'Internal Marks (/50)', width: 18 },
      { key: 'external_marks', header: 'External Marks (/50)', width: 18 },
      { key: 'combined_score', header: 'Total Marks (/100)', width: 18 }
    ];

    ws.columns = cols;
    const filteredRanked = isTopN ? filterTopNWithTies(th.ranked_teams, topNVal) : th.ranked_teams;
    const subHeader = isTopN
      ? `Official Leaderboard • Scope: Top ${topNVal} • ${filteredRanked.length} Teams Shown with Ties (${th.fully_evaluated_count} eligible)`
      : `Official Leaderboard • ${th.fully_evaluated_count} Ranked Teams`;
    applyExecutiveHeader(ws, `THEME: ${th.theme.toUpperCase()}`, subHeader, cols.length);

    // Header Row 5
    const hRow = ws.getRow(5);
    hRow.height = 24;
    cols.forEach((col, idx) => {
      const cell = hRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.tblHeaderText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BORDER_THIN;
    });

    // Ranked Teams
    let curRowIdx = 6;
    if (filteredRanked.length === 0) {
      const emptyRow = ws.getRow(curRowIdx);
      ws.mergeCells(curRowIdx, 1, curRowIdx, cols.length);
      const emptyCell = emptyRow.getCell(1);
      emptyCell.value = isTopN
        ? `No teams qualified in Top ${topNVal} (or no teams fully evaluated yet).`
        : 'No teams have completed both internal and external evaluations yet.';
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };
      emptyRow.height = 24;
      curRowIdx++;
    } else {
      filteredRanked.forEach((t, i) => {
        const row = ws.getRow(curRowIdx);
        row.height = 20;

        // Highlight top 3
        let rowBg = i % 2 === 0 ? PALETTE.rowEven : PALETTE.rowOdd;
        if (t.rank === 1) rowBg = PALETTE.goldBg;
        else if (t.rank === 2) rowBg = PALETTE.silverBg;
        else if (t.rank === 3) rowBg = PALETTE.bronzeBg;

        row.getCell(1).value = t.rank;
        row.getCell(2).value = t.team_code;
        row.getCell(3).value = t.team_name;
        row.getCell(4).value = t.project_title;
        row.getCell(5).value = t.panel_code;
        row.getCell(6).value = t.internal_marks;
        row.getCell(7).value = t.external_marks;
        row.getCell(8).value = t.combined_score;

        for (let c = 1; c <= cols.length; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Segoe UI', size: 10, bold: c === 1 || c === 8, color: { argb: PALETTE.rowText } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.border = BORDER_THIN;
          cell.alignment = { horizontal: [1, 2, 5, 6, 7, 8].includes(c) ? 'center' : 'left', vertical: 'middle' };
        }
        curRowIdx++;
      });
    }

    // Pending Teams Section below
    if (th.pending_teams.length > 0) {
      curRowIdx++; // blank spacer
      const pendTitleRow = ws.getRow(curRowIdx);
      pendTitleRow.height = 22;
      ws.mergeCells(curRowIdx, 1, curRowIdx, cols.length);
      const ptCell = pendTitleRow.getCell(1);
      ptCell.value = `Pending Incomplete Teams (${th.pending_teams.length}) — Not Ranked Until Fully Evaluated`;
      ptCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'B45309' } };
      ptCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      ptCell.alignment = { horizontal: 'left', vertical: 'middle' };
      ptCell.border = BORDER_THIN;
      curRowIdx++;

      th.pending_teams.forEach((pt, pi) => {
        const row = ws.getRow(curRowIdx);
        row.height = 20;
        const rowBg = pi % 2 === 0 ? PALETTE.rowEven : PALETTE.rowOdd;

        row.getCell(1).value = '—';
        row.getCell(2).value = pt.team_code;
        row.getCell(3).value = pt.team_name;
        row.getCell(4).value = pt.project_title;
        row.getCell(5).value = pt.panel_code;
        row.getCell(6).value = pt.internal_marks !== null ? pt.internal_marks : `Pending (${pt.internal_status_label})`;
        row.getCell(7).value = pt.external_marks !== null ? pt.external_marks : `Pending (${pt.external_status_label})`;
        row.getCell(8).value = 'Pending';

        for (let c = 1; c <= cols.length; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Segoe UI', size: 9.5, italic: c === 1 || c >= 6, color: { argb: '64748B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.border = BORDER_THIN;
          cell.alignment = { horizontal: [1, 2, 5, 6, 7, 8].includes(c) ? 'center' : 'left', vertical: 'middle' };
        }
        curRowIdx++;
      });
    }

    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + (th.ranked_teams.length || 1), column: cols.length } };
  }

  return wb;
}

/**
 * Export C: Overall Ranking Report (Workbook)
 */
async function buildOverallRankingsWorkbook() {
  const data = await getOverallRankings();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RMK Jr. Hackathon 2026 Admin';
  wb.created = new Date();

  // Sheet 1: Overall Leaderboard
  const ws1 = wb.addWorksheet('Overall Leaderboard', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
  });

  const cols1 = [
    { key: 'rank', header: 'Overall Rank', width: 14 },
    { key: 'team_code', header: 'Team ID', width: 15 },
    { key: 'team_name', header: 'Team Name', width: 28 },
    { key: 'project_title', header: 'Project Title', width: 38 },
    { key: 'theme', header: 'Theme / Domain', width: 30 },
    { key: 'panel_code', header: 'Panel', width: 10 },
    { key: 'internal_marks', header: 'Internal Marks (/50)', width: 18 },
    { key: 'external_marks', header: 'External Marks (/50)', width: 18 },
    { key: 'combined_score', header: 'Combined Total (/100)', width: 20 }
  ];

  ws1.columns = cols1;
  applyExecutiveHeader(ws1, 'RMK JUNIOR HACKATHON 2026 — OVERALL GRAND LEADERBOARD', `Rankings Across All Themes • ${data.fully_evaluated_count} Fully Evaluated Teams`, cols1.length);

  // Header row 5
  const hRow1 = ws1.getRow(5);
  hRow1.height = 24;
  cols1.forEach((col, idx) => {
    const cell = hRow1.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  if (data.ranked_teams.length === 0) {
    const emptyRow = ws1.getRow(6);
    ws1.mergeCells(6, 1, 6, cols1.length);
    const cell = emptyRow.getCell(1);
    cell.value = 'No projects have completed both internal and external evaluations yet.';
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };
  } else {
    data.ranked_teams.forEach((t, i) => {
      const rowNum = 6 + i;
      const row = ws1.getRow(rowNum);
      row.height = 20;

      let rowBg = i % 2 === 0 ? PALETTE.rowEven : PALETTE.rowOdd;
      if (t.rank === 1) rowBg = PALETTE.goldBg;
      else if (t.rank === 2) rowBg = PALETTE.silverBg;
      else if (t.rank === 3) rowBg = PALETTE.bronzeBg;

      row.getCell(1).value = t.rank;
      row.getCell(2).value = t.team_code;
      row.getCell(3).value = t.team_name;
      row.getCell(4).value = t.project_title;
      row.getCell(5).value = t.theme;
      row.getCell(6).value = t.panel_code;
      row.getCell(7).value = t.internal_marks;
      row.getCell(8).value = t.external_marks;
      row.getCell(9).value = t.combined_score;

      for (let c = 1; c <= cols1.length; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Segoe UI', size: 10, bold: c === 1 || c === 9, color: { argb: PALETTE.rowText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: [1, 2, 6, 7, 8, 9].includes(c) ? 'center' : 'left', vertical: 'middle' };
      }
    });

    ws1.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + data.ranked_teams.length, column: cols1.length } };
  }

  // Sheet 2: Pending Evaluations
  const ws2 = wb.addWorksheet('Pending Evaluations', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
  });

  const cols2 = [
    { key: 'sl', header: 'Sl. No.', width: 8 },
    { key: 'team_code', header: 'Team ID', width: 15 },
    { key: 'team_name', header: 'Team Name', width: 28 },
    { key: 'project_title', header: 'Project Title', width: 38 },
    { key: 'theme', header: 'Theme / Domain', width: 30 },
    { key: 'panel_code', header: 'Panel', width: 10 },
    { key: 'internal_status', header: 'Internal Jury Status', width: 18 },
    { key: 'internal_marks', header: 'Internal Marks (/50)', width: 18 },
    { key: 'external_status', header: 'External Jury Status', width: 18 },
    { key: 'external_marks', header: 'External Marks (/50)', width: 18 },
    { key: 'overall_status', header: 'Pending Reason', width: 20 }
  ];

  ws2.columns = cols2;
  applyExecutiveHeader(ws2, 'RMK JUNIOR HACKATHON 2026 — PENDING EVALUATIONS ROSTER', `Teams Awaiting Evaluation Completion (${data.pending_count} Total)`, cols2.length);

  const hRow2 = ws2.getRow(5);
  hRow2.height = 24;
  cols2.forEach((col, idx) => {
    const cell = hRow2.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  data.pending_teams.forEach((pt, i) => {
    const row = ws2.getRow(6 + i);
    row.height = 20;
    const rowBg = i % 2 === 0 ? PALETTE.rowEven : PALETTE.rowOdd;

    row.getCell(1).value = i + 1;
    row.getCell(2).value = pt.team_code;
    row.getCell(3).value = pt.team_name;
    row.getCell(4).value = pt.project_title;
    row.getCell(5).value = pt.theme;
    row.getCell(6).value = pt.panel_code;
    row.getCell(7).value = pt.internal_status_label;
    row.getCell(8).value = pt.internal_marks !== null ? pt.internal_marks : '—';
    row.getCell(9).value = pt.external_status_label;
    row.getCell(10).value = pt.external_marks !== null ? pt.external_marks : '—';
    row.getCell(11).value = pt.overall_status_label;

    for (let c = 1; c <= cols2.length; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: PALETTE.rowText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: [1, 2, 6, 7, 8, 9, 10, 11].includes(c) ? 'center' : 'left', vertical: 'middle' };
    }
  });

  ws2.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + (data.pending_teams.length || 1), column: cols2.length } };

  return wb;
}

module.exports = {
  fetchAllEvaluationData,
  getEvaluationStatusReport,
  getThemeRankings,
  getOverallRankings,
  assignCompetitionRanks,
  filterTopNWithTies,
  buildEvaluationStatusWorkbook,
  buildThemeRankingsWorkbook,
  buildOverallRankingsWorkbook
};

