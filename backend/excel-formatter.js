/**
 * High-craft Excel Document Generator for RMK Jr. Hackathon 2026
 * Built with ExcelJS for pixel-perfect executive formatting:
 * - Institutional Navy headers with clean typography
 * - Generous, auto-calculated column widths (never truncated)
 * - Alternating zebra striping and crisp light borders
 * - Status pills (Emerald for Scanned, Rose for Not Scanned)
 * - Frozen header rows and active auto-filters
 */

const ExcelJS = require('exceljs');

const PALETTE = {
  headerBg: '1F3864',       // Institutional Deep Navy
  headerText: 'FFFFFF',
  subHeaderBg: 'F1F5F9',    // Crisp Slate Tint
  subHeaderText: '334155',
  tblHeaderBg: '0F172A',    // Dark Slate
  tblHeaderText: 'FFFFFF',
  rowEven: 'FFFFFF',
  rowOdd: 'F8FAFC',
  border: 'E2E8F0',
  teamIdText: '0369A1',
  scannedBg: 'DCFCE7',
  scannedText: '15803D',
  pendingBg: 'FEE2E2',
  pendingText: 'B91C1C'
};

const BORDER_THIN = {
  top: { style: 'thin', color: { argb: PALETTE.border } },
  left: { style: 'thin', color: { argb: PALETTE.border } },
  bottom: { style: 'thin', color: { argb: PALETTE.border } },
  right: { style: 'thin', color: { argb: PALETTE.border } }
};

/**
 * Builds the Master Presence & Registration Roster workbook
 */
async function buildPresenceExcel(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RMK Jr. Hackathon Organizers';
  wb.created = new Date();

  const ws = wb.addWorksheet('Master Attendance Roster', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }]
  });

  const columns = [
    { key: 'sl', header: 'Sl. No.', width: 9 },
    { key: 'team_code', header: 'Team ID', width: 17 },
    { key: 'team_name', header: 'Team Name', width: 28 },
    { key: 'project_title', header: 'Idea / Project Title', width: 42 },
    { key: 'leader_name', header: 'Team Leader', width: 24 },
    { key: 'members', header: 'Team Members', width: 32 },
    { key: 'mentor_name', header: 'Mentor Name', width: 22 },
    { key: 'mobile_no', header: 'Contact Mobile', width: 18 },
    { key: 'email', header: 'Leader Email', width: 32 },
    { key: 'college_name', header: 'School Name', width: 40 },
    { key: 'category', header: 'Theme Track', width: 30 },
    { key: 'venue', header: 'Allocated Venue', width: 36 },
    { key: 'status', header: 'Attendance Status', width: 19 },
    { key: 'check_in_time', header: 'Check-In Timestamp', width: 22 }
  ];

  const totalCols = columns.length;

  // 1. Title Row
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell('A1');
  titleCell.value = 'R.M.K. GROUP OF INSTITUTIONS — JUNIOR HACKATHON 2026';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: PALETTE.headerText } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 34;

  // 2. Subtitle Row
  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const scannedCount = rows.filter(r => r.is_present).length;
  ws.mergeCells(2, 1, 2, totalCols);
  const subCell = ws.getCell('A2');
  subCell.value = `MASTER REGISTRATION & ATTENDANCE ROSTER  •  Total Teams: ${rows.length}  •  Scanned: ${scannedCount}  •  Exported: ${nowStr} IST`;
  subCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.subHeaderText } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.subHeaderBg } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // 3. Spacer Row
  ws.getRow(3).height = 8;

  // 4. Column Headers Row (Row 4)
  const headerRow = ws.getRow(4);
  headerRow.height = 26;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 7 || idx === 12 || idx === 13) ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  // Enable AutoFilter on row 4
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: totalCols } };

  // 5. Data Rows (Row 5 onwards)
  rows.forEach((r, rowIdx) => {
    const rNum = rowIdx + 5;
    const isEven = (rowIdx % 2 === 0);
    const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
    const dRow = ws.getRow(rNum);
    dRow.height = 22;

    const isPresent = Boolean(r.is_present);
    const timeStr = r.check_in_time ? new Date(r.check_in_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : '—';

    const values = [
      rowIdx + 1,
      r.team_code || '—',
      r.team_name || '—',
      r.project_title || '—',
      r.leader_name || '—',
      r.members || '—',
      r.mentor_name || '—',
      r.mobile_no || '—',
      r.email || '—',
      r.college_name || '—',
      r.category || '—',
      r.venue || 'TBD',
      isPresent ? 'Scanned' : 'Not Scanned',
      timeStr
    ];

    values.forEach((val, colIdx) => {
      const cell = dRow.getCell(colIdx + 1);
      cell.value = val;
      cell.border = BORDER_THIN;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: '0F172A' } };

      // Alignments & special formatting
      if (colIdx === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 1) { // Team ID
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.teamIdText } };
      } else if (colIdx === 7 || colIdx === 13) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 12) { // Attendance Status
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (isPresent) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.scannedBg } };
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.scannedText } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pendingBg } };
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.pendingText } };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Set explicit column widths
  columns.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width;
  });

  return wb;
}

/**
 * Builds the Multi-Sheet Venue-Wise Segregated Workbook
 */
async function buildVenueWiseWorkbook(teamsGroupedByTheme) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RMK Jr. Hackathon Organizers';
  wb.created = new Date();

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: SUMMARY SHEET
  // ─────────────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }]
  });

  const sumCols = [
    { header: 'Sl. No.', width: 9 },
    { header: 'Theme Track', width: 36 },
    { header: 'Allocated Presentation Venue', width: 42 },
    { header: 'Registered Teams', width: 20 },
    { header: 'Scanned (Present)', width: 20 },
    { header: 'Attendance %', width: 18 },
    { header: 'Lab Coordinator Signature', width: 32 }
  ];

  wsSummary.mergeCells(1, 1, 1, sumCols.length);
  const sumTitle = wsSummary.getCell('A1');
  sumTitle.value = 'R.M.K. GROUP OF INSTITUTIONS — JUNIOR HACKATHON 2026';
  sumTitle.font = { name: 'Calibri', size: 15, bold: true, color: { argb: PALETTE.headerText } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 34;

  let totalAllTeams = 0;
  let totalAllScanned = 0;
  for (const info of teamsGroupedByTheme.values()) {
    totalAllTeams += info.teams.length;
    totalAllScanned += info.teams.filter(t => t.is_present).length;
  }

  wsSummary.mergeCells(2, 1, 2, sumCols.length);
  const sumSub = wsSummary.getCell('A2');
  sumSub.value = `VENUE ALLOCATION & ROOM SUMMARY  •  ${teamsGroupedByTheme.size} Themes  •  ${totalAllTeams} Registered Teams`;
  sumSub.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.subHeaderText } };
  sumSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.subHeaderBg } };
  sumSub.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(2).height = 22;

  wsSummary.getRow(3).height = 8;

  const sumHeaderRow = wsSummary.getRow(4);
  sumHeaderRow.height = 26;
  sumCols.forEach((col, idx) => {
    const c = sumHeaderRow.getCell(idx + 1);
    c.value = col.header;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    c.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
    c.border = BORDER_THIN;
    wsSummary.getColumn(idx + 1).width = col.width;
  });

  let sl = 1;
  for (const [theme, info] of teamsGroupedByTheme) {
    const rNum = sl + 4;
    const row = wsSummary.getRow(rNum);
    row.height = 24;
    const isEven = (sl % 2 === 1);
    const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;

    const tCount = info.teams.length;
    const sCount = info.teams.filter(t => t.is_present).length;
    const pct = tCount > 0 ? Math.round((sCount / tCount) * 100) + '%' : '0%';

    const vals = [sl, theme, info.venue, tCount, sCount, pct, ''];
    vals.forEach((v, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = v;
      cell.border = BORDER_THIN;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: '0F172A' } };
      cell.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
      if (idx === 1) cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '0F172A' } };
    });
    sl++;
  }

  // Total Summary Row
  const totalRow = wsSummary.getRow(sl + 4);
  totalRow.height = 26;
  const totVals = ['', 'TOTAL', '', totalAllTeams, totalAllScanned, totalAllTeams > 0 ? Math.round((totalAllScanned / totalAllTeams) * 100) + '%' : '0%', ''];
  totVals.forEach((v, idx) => {
    const cell = totalRow.getCell(idx + 1);
    cell.value = v;
    cell.border = BORDER_THIN;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.subHeaderBg } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '0F172A' } };
    cell.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
  });

  // ─────────────────────────────────────────────────────────────
  // SHEETS 2..N: INDIVIDUAL THEME & VENUE SHEETS
  // ─────────────────────────────────────────────────────────────
  const SHEET_NAME_MAP = {
    'Renewable/Sustainable Energy': 'Renewable Energy',
    'Agriculture': 'Agriculture',
    'Healthcare': 'Healthcare',
    'Education': 'Education',
    'Robotics': 'Robotics',
    'Smart Automation': 'Smart Automation',
    'Smart Vehicles': 'Smart Vehicles',
    'Traditional Games of Indian Ethos': 'Traditional Games',
    'Virtual Reality Experience': 'Virtual Reality',
    'Clean and Green Environment': 'Clean & Green Env',
    'Indian Heritage and Digital Creativity': 'Indian Heritage',
    'AI for Disater Management': 'AI Disaster Mgmt'
  };

  let themeIndex = 1;
  for (const [theme, info] of teamsGroupedByTheme) {
    const rawName = SHEET_NAME_MAP[theme] || theme.slice(0, 25);
    const safeSheetName = rawName.replace(/[\\/?*:[\]]/g, ' ').trim() || `Theme_${themeIndex}`;

    const wsTheme = wb.addWorksheet(safeSheetName, {
      views: [{ state: 'frozen', ySplit: 4, showGridLines: true }]
    });

    const themeCols = [
      { header: 'Sl. No.', width: 9 },
      { header: 'Junior Hackathon ID', width: 22 },
      { header: 'Team Leader Name', width: 26 },
      { header: 'Team Name', width: 28 },
      { header: 'Title of Your Project', width: 44 },
      { header: 'School Name', width: 38 },
      { header: 'Attendance Status', width: 18 },
      { header: 'Coordinator Signature', width: 26 }
    ];

    // Title Row
    wsTheme.mergeCells(1, 1, 1, themeCols.length);
    const tCell = wsTheme.getCell('A1');
    tCell.value = 'R.M.K. GROUP OF INSTITUTIONS — JUNIOR HACKATHON 2026';
    tCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: PALETTE.headerText } };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsTheme.getRow(1).height = 34;

    // Subtitle Row
    wsTheme.mergeCells(2, 1, 2, themeCols.length);
    const subTCell = wsTheme.getCell('A2');
    subTCell.value = `THEME: ${theme.toUpperCase()}   |   VENUE: ${info.venue.toUpperCase()}   |   Teams: ${info.teams.length}`;
    subTCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.subHeaderText } };
    subTCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.subHeaderBg } };
    subTCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsTheme.getRow(2).height = 24;

    wsTheme.getRow(3).height = 8;

    // Column Headers Row
    const tHeadRow = wsTheme.getRow(4);
    tHeadRow.height = 26;
    themeCols.forEach((col, idx) => {
      const c = tHeadRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      c.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 6 || idx === 7) ? 'center' : 'left', vertical: 'middle' };
      c.border = BORDER_THIN;
      wsTheme.getColumn(idx + 1).width = col.width;
    });

    wsTheme.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: themeCols.length } };

    // Teams Rows
    info.teams.forEach((t, tIdx) => {
      const rNum = tIdx + 5;
      const row = wsTheme.getRow(rNum);
      row.height = 22;
      const isEven = (tIdx % 2 === 0);
      const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
      const isPresent = Boolean(t.is_present);

      const vals = [
        tIdx + 1,
        t.team_code || '—',
        t.leader_name || '—',
        t.team_name || '—',
        t.project_title || '—',
        t.college_name || '—',
        isPresent ? 'Scanned' : 'Not Scanned',
        ''
      ];

      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.border = BORDER_THIN;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { name: 'Calibri', size: 10.5, color: { argb: '0F172A' } };

        if (cIdx === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (cIdx === 1) { // Team ID
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.teamIdText } };
        } else if (cIdx === 6) { // Attendance
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (isPresent) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.scannedBg } };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.scannedText } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pendingBg } };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.pendingText } };
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    themeIndex++;
  }

  return wb;
}

module.exports = {
  buildPresenceExcel,
  buildVenueWiseWorkbook
};
