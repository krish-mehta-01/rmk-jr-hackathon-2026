/**
 * High-craft Excel Document Generator for RMK Jr. Hackathon 2026
 * 
 * Design Rules Specified:
 * 1. Dual Logos: RMK Group Logo on LEFT, RMK Jr. Hackathon 2026 Logo on RIGHT.
 * 2. Palette: Strictly shades and family of green for cell backgrounds.
 * 3. Typography: Text color is strictly pure BLACK (#000000) or pure WHITE (#FFFFFF) ONLY.
 * 4. Generous column widths, freeze panes, auto-filters, and zebra rows.
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const LOGO_LEFT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_group_logo.png');
const LOGO_RIGHT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_jr_hackathon_2026_logo.png');

const GREEN_PALETTE = {
  headerBg: '14532D',       // Deep Forest Green
  headerText: 'FFFFFF',     // Pure White
  subHeaderBg: 'DCFCE7',    // Light Mint Green
  subHeaderText: '000000',  // Pure Black
  tblHeaderBg: '166534',    // Deep Emerald Green
  tblHeaderText: 'FFFFFF',  // Pure White
  rowEven: 'FFFFFF',        // Pure White
  rowOdd: 'F0FDF4',         // Very Soft Mint Green Tint
  rowText: '000000',        // Pure Black
  border: '86EFAC',         // Soft Green border
  scannedBg: '22C55E',      // Green Status Pill
  scannedText: 'FFFFFF',    // Pure White
  pendingBg: 'F1F5F9',      // Neutral Pending Pill
  pendingText: '000000'     // Pure Black
};

const BORDER_GREEN = {
  top: { style: 'thin', color: { argb: GREEN_PALETTE.border } },
  left: { style: 'thin', color: { argb: GREEN_PALETTE.border } },
  bottom: { style: 'thin', color: { argb: GREEN_PALETTE.border } },
  right: { style: 'thin', color: { argb: GREEN_PALETTE.border } }
};

/**
 * Builds the Master Presence & Registration Roster workbook
 */
async function buildPresenceExcel(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RMK Jr. Hackathon Organizers';
  wb.created = new Date();

  // Add logos to workbook if they exist
  let logoLeftId = null;
  let logoRightId = null;
  if (fs.existsSync(LOGO_LEFT_PATH)) {
    logoLeftId = wb.addImage({ filename: LOGO_LEFT_PATH, extension: 'png' });
  }
  if (fs.existsSync(LOGO_RIGHT_PATH)) {
    logoRightId = wb.addImage({ filename: LOGO_RIGHT_PATH, extension: 'png' });
  }

  const ws = wb.addWorksheet('Master Attendance Roster', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }]
  });

  const columns = [
    { key: 'sl', header: 'Sl. No.', width: 9 },
    { key: 'team_code', header: 'Team ID', width: 17 },
    { key: 'team_name', header: 'Team Name', width: 28 },
    { key: 'project_title', header: 'Idea / Project Title', width: 44 },
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

  // 1. Title Row with Deep Forest Green fill & Pure White text
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell('A1');
  titleCell.value = 'R.M.K. GROUP OF INSTITUTIONS — JUNIOR HACKATHON 2026';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: GREEN_PALETTE.headerText } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.headerBg } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 42;

  // 2. Subtitle Row with Light Mint Green fill & Pure Black text
  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const scannedCount = rows.filter(r => r.is_present).length;
  ws.mergeCells(2, 1, 2, totalCols);
  const subCell = ws.getCell('A2');
  subCell.value = `MASTER REGISTRATION & ATTENDANCE ROSTER  •  Total Teams: ${rows.length}  •  Scanned: ${scannedCount}  •  Exported: ${nowStr} IST`;
  subCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.subHeaderText } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.subHeaderBg } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // 3. Spacer Row
  ws.getRow(3).height = 8;

  // 4. Column Headers Row with Deep Emerald Green fill & Pure White text
  const headerRow = ws.getRow(4);
  headerRow.height = 28;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN_PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 7 || idx === 12 || idx === 13) ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_GREEN;
    ws.getColumn(idx + 1).width = col.width;
  });

  // Enable AutoFilter on row 4
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: totalCols } };

  // 5. Data Rows (Row 5 onwards) - Pure Black text on alternating shades of green
  rows.forEach((r, rowIdx) => {
    const rNum = rowIdx + 5;
    const isEven = (rowIdx % 2 === 0);
    const rowBg = isEven ? GREEN_PALETTE.rowEven : GREEN_PALETTE.rowOdd;
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
      cell.border = BORDER_GREEN;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: GREEN_PALETTE.rowText } };

      if (colIdx === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 1) { // Team ID
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.rowText } };
      } else if (colIdx === 7 || colIdx === 13) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 12) { // Attendance Status
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (isPresent) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.scannedBg } };
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.scannedText } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.pendingBg } };
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.pendingText } };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Embed Logos (Left: RMK Group Logo, Right: RMK Jr Hackathon Logo)
  if (logoLeftId !== null) {
    ws.addImage(logoLeftId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 125, height: 46 }
    });
  }
  if (logoRightId !== null) {
    ws.addImage(logoRightId, {
      tl: { col: totalCols - 1.8, row: 0.1 },
      ext: { width: 145, height: 46 }
    });
  }

  return wb;
}

/**
 * Builds the Multi-Sheet Venue-Wise Segregated Workbook
 */
async function buildVenueWiseWorkbook(teamsGroupedByTheme) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RMK Jr. Hackathon Organizers';
  wb.created = new Date();

  let logoLeftId = null;
  let logoRightId = null;
  if (fs.existsSync(LOGO_LEFT_PATH)) {
    logoLeftId = wb.addImage({ filename: LOGO_LEFT_PATH, extension: 'png' });
  }
  if (fs.existsSync(LOGO_RIGHT_PATH)) {
    logoRightId = wb.addImage({ filename: LOGO_RIGHT_PATH, extension: 'png' });
  }

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
  sumTitle.font = { name: 'Calibri', size: 15, bold: true, color: { argb: GREEN_PALETTE.headerText } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.headerBg } };
  sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 42;

  let totalAllTeams = 0;
  let totalAllScanned = 0;
  for (const info of teamsGroupedByTheme.values()) {
    totalAllTeams += info.teams.length;
    totalAllScanned += info.teams.filter(t => t.is_present).length;
  }

  wsSummary.mergeCells(2, 1, 2, sumCols.length);
  const sumSub = wsSummary.getCell('A2');
  sumSub.value = `VENUE ALLOCATION & ROOM SUMMARY  •  ${teamsGroupedByTheme.size} Themes  •  ${totalAllTeams} Registered Teams`;
  sumSub.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.subHeaderText } };
  sumSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.subHeaderBg } };
  sumSub.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(2).height = 22;

  wsSummary.getRow(3).height = 8;

  const sumHeaderRow = wsSummary.getRow(4);
  sumHeaderRow.height = 28;
  sumCols.forEach((col, idx) => {
    const c = sumHeaderRow.getCell(idx + 1);
    c.value = col.header;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN_PALETTE.tblHeaderText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.tblHeaderBg } };
    c.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
    c.border = BORDER_GREEN;
    wsSummary.getColumn(idx + 1).width = col.width;
  });

  let sl = 1;
  for (const [theme, info] of teamsGroupedByTheme) {
    const rNum = sl + 4;
    const row = wsSummary.getRow(rNum);
    row.height = 24;
    const isEven = (sl % 2 === 1);
    const rowBg = isEven ? GREEN_PALETTE.rowEven : GREEN_PALETTE.rowOdd;

    const tCount = info.teams.length;
    const sCount = info.teams.filter(t => t.is_present).length;
    const pct = tCount > 0 ? Math.round((sCount / tCount) * 100) + '%' : '0%';

    const vals = [sl, theme, info.venue, tCount, sCount, pct, ''];
    vals.forEach((v, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = v;
      cell.border = BORDER_GREEN;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: GREEN_PALETTE.rowText } };
      cell.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
      if (idx === 1) cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.rowText } };
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
    cell.border = BORDER_GREEN;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.subHeaderBg } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN_PALETTE.subHeaderText } };
    cell.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
  });

  // Embed Logos on Summary Sheet
  if (logoLeftId !== null) {
    wsSummary.addImage(logoLeftId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 125, height: 46 }
    });
  }
  if (logoRightId !== null) {
    wsSummary.addImage(logoRightId, {
      tl: { col: sumCols.length - 1.5, row: 0.1 },
      ext: { width: 145, height: 46 }
    });
  }

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
    tCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: GREEN_PALETTE.headerText } };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.headerBg } };
    tCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsTheme.getRow(1).height = 42;

    // Subtitle Row
    wsTheme.mergeCells(2, 1, 2, themeCols.length);
    const subTCell = wsTheme.getCell('A2');
    subTCell.value = `THEME: ${theme.toUpperCase()}   |   VENUE: ${info.venue.toUpperCase()}   |   Teams: ${info.teams.length}`;
    subTCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN_PALETTE.subHeaderText } };
    subTCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.subHeaderBg } };
    subTCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsTheme.getRow(2).height = 24;

    wsTheme.getRow(3).height = 8;

    // Column Headers Row
    const tHeadRow = wsTheme.getRow(4);
    tHeadRow.height = 28;
    themeCols.forEach((col, idx) => {
      const c = tHeadRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN_PALETTE.tblHeaderText } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.tblHeaderBg } };
      c.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 6 || idx === 7) ? 'center' : 'left', vertical: 'middle' };
      c.border = BORDER_GREEN;
      wsTheme.getColumn(idx + 1).width = col.width;
    });

    wsTheme.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: themeCols.length } };

    // Teams Rows: Pure Black Text on alternating green shades
    info.teams.forEach((t, tIdx) => {
      const rNum = tIdx + 5;
      const row = wsTheme.getRow(rNum);
      row.height = 22;
      const isEven = (tIdx % 2 === 0);
      const rowBg = isEven ? GREEN_PALETTE.rowEven : GREEN_PALETTE.rowOdd;
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
        cell.border = BORDER_GREEN;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { name: 'Calibri', size: 10.5, color: { argb: GREEN_PALETTE.rowText } };

        if (cIdx === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (cIdx === 1) { // Team ID
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.rowText } };
        } else if (cIdx === 6) { // Attendance
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (isPresent) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.scannedBg } };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.scannedText } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_PALETTE.pendingBg } };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: GREEN_PALETTE.pendingText } };
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Embed Logos on each theme sheet
    if (logoLeftId !== null) {
      wsTheme.addImage(logoLeftId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 125, height: 46 }
      });
    }
    if (logoRightId !== null) {
      wsTheme.addImage(logoRightId, {
        tl: { col: themeCols.length - 1.5, row: 0.1 },
        ext: { width: 145, height: 46 }
      });
    }

    themeIndex++;
  }

  return wb;
}

module.exports = {
  buildPresenceExcel,
  buildVenueWiseWorkbook
};
