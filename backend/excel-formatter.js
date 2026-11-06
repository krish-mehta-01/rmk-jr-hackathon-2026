/**
 * High-craft Executive Excel Document Generator for RMK Jr. Hackathon 2026
 * 
 * Design Standards Applied:
 * 1. Clean Letterhead Header: Rows 1 & 2 are crisp pure WHITE (#FFFFFF), providing
 *    a clean, non-clashing canvas for the RMK Group Logo (Left) and
 *    RMK Junior Hackathon 2026 Logo (Right).
 * 2. Zero Overlap: Header rows have 56pt total height, ensuring logos (48px high)
 *    never touch, overflow, or clip into Row 3 or venue text.
 * 3. Green Family Palette for cells:
 *    - Theme / Venue Ribbon: Light Mint Green (#DCFCE7)
 *    - Table Headers: Deep Emerald Green (#166534)
 *    - Data Rows: Alternating Pure White (#FFFFFF) & Soft Mint Tint (#F0FDF4)
 *    - Status: Vibrant Forest Green (#22C55E)
 * 4. Crisp, Classic Black Borders: Clean thin black borders (#000000) matching
 *    the official institutional template specifications.
 * 5. Typography: Text colors are STRICTLY Pure Black (#000000) or Pure White (#FFFFFF) ONLY.
 * 6. Generous column widths, auto-filters, and freeze panes.
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const LOGO_LEFT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_group_logo.png');
const LOGO_RIGHT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_jr_hackathon_2026_logo.png');

const PALETTE = {
  headerBg: 'FFFFFF',       // Pure White header area for maximum logo clarity
  headerTextDark: '000000', // Pure Black
  headerTextGreen: '14532D',// Deep Forest Green
  ribbonBg: 'DCFCE7',       // Light Mint Green ribbon
  ribbonText: '000000',     // Pure Black
  tblHeaderBg: '166534',    // Deep Emerald Green
  tblHeaderText: 'FFFFFF',  // Pure White
  rowEven: 'FFFFFF',        // Pure White
  rowOdd: 'F0FDF4',         // Very Soft Mint Green Tint
  rowText: '000000',        // Pure Black
  border: '000000',         // Clean thin black border (matching institutional standard)
  borderMedium: '000000',   // Black border for ribbon/totals
  scannedBg: '22C55E',      // Green Status Pill
  scannedText: 'FFFFFF',    // Pure White
  pendingBg: 'F1F5F9',      // Neutral Pending Pill
  pendingText: '000000'     // Pure Black
};

const BORDER_BLACK = {
  top: { style: 'thin', color: { argb: PALETTE.border } },
  left: { style: 'thin', color: { argb: PALETTE.border } },
  bottom: { style: 'thin', color: { argb: PALETTE.border } },
  right: { style: 'thin', color: { argb: PALETTE.border } }
};

const BORDER_CELL = BORDER_BLACK;
const BORDER_RIBBON = BORDER_BLACK;

/**
 * Builds the Master Presence & Registration Roster workbook
 */
async function buildPresenceExcel(rows) {
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

  const ws = wb.addWorksheet('Master Attendance Roster', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
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

  // Row 1: Institution Title on Crisp White (logos flank this row)
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell1 = ws.getCell('A1');
  titleCell1.value = 'R.M.K. GROUP OF INSTITUTIONS';
  titleCell1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
  titleCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  titleCell1.alignment = { horizontal: 'center', vertical: 'bottom' };
  ws.getRow(1).height = 30;

  // Row 2: Event Title on Crisp White
  ws.mergeCells(2, 1, 2, totalCols);
  const titleCell2 = ws.getCell('A2');
  titleCell2.value = 'JUNIOR HACKATHON 2026';
  titleCell2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
  titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  titleCell2.alignment = { horizontal: 'center', vertical: 'top' };
  ws.getRow(2).height = 26;

  // Row 3: Ribbon Banner (Light Mint Green with Pure Black text)
  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const scannedCount = rows.filter(r => r.is_present).length;
  ws.mergeCells(3, 1, 3, totalCols);
  const subCell = ws.getCell('A3');
  subCell.value = `MASTER REGISTRATION & ATTENDANCE ROSTER  •  Total Teams: ${rows.length}  •  Scanned: ${scannedCount}  •  Exported: ${nowStr} IST`;
  subCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.border = BORDER_RIBBON;
  ws.getRow(3).height = 24;

  // Row 4: Spacer row
  ws.getRow(4).height = 6;

  // Row 5: Column Headers Row with Deep Emerald Green fill & Pure White text
  const headerRow = ws.getRow(5);
  headerRow.height = 28;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 7 || idx === 12 || idx === 13) ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_CELL;
    ws.getColumn(idx + 1).width = col.width;
  });

  // Enable AutoFilter on row 5
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: totalCols } };

  // Row 6+: Data Rows (Pure Black text on alternating shades of green with clean black border)
  rows.forEach((r, rowIdx) => {
    const rNum = rowIdx + 6;
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
      cell.border = BORDER_CELL;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };

      if (colIdx === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 1) { // Team ID
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
      } else if (colIdx === 7 || colIdx === 13) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 12) { // Attendance Status
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (isPresent) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.scannedBg } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.scannedText } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pendingBg } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.pendingText } };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Embed Logos in Row 1 & 2 (Clean White area, 56pt height - perfect fit, zero overlap)
  if (logoLeftId !== null) {
    ws.addImage(logoLeftId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 130, height: 50 }
    });
  }
  if (logoRightId !== null) {
    ws.addImage(logoRightId, {
      tl: { col: totalCols - 1.6, row: 0.1 },
      ext: { width: 155, height: 50 }
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
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
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

  // Row 1 & 2: Header on Clean White
  wsSummary.mergeCells(1, 1, 1, sumCols.length);
  const sumTitle1 = wsSummary.getCell('A1');
  sumTitle1.value = 'R.M.K. GROUP OF INSTITUTIONS';
  sumTitle1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
  sumTitle1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  sumTitle1.alignment = { horizontal: 'center', vertical: 'bottom' };
  wsSummary.getRow(1).height = 30;

  wsSummary.mergeCells(2, 1, 2, sumCols.length);
  const sumTitle2 = wsSummary.getCell('A2');
  sumTitle2.value = 'JUNIOR HACKATHON 2026';
  sumTitle2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
  sumTitle2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  sumTitle2.alignment = { horizontal: 'center', vertical: 'top' };
  wsSummary.getRow(2).height = 26;

  let totalAllTeams = 0;
  let totalAllScanned = 0;
  for (const info of teamsGroupedByTheme.values()) {
    totalAllTeams += info.teams.length;
    totalAllScanned += info.teams.filter(t => t.is_present).length;
  }

  // Row 3: Ribbon Banner
  wsSummary.mergeCells(3, 1, 3, sumCols.length);
  const sumSub = wsSummary.getCell('A3');
  sumSub.value = `VENUE ALLOCATION & ROOM SUMMARY  •  ${teamsGroupedByTheme.size} Themes  •  ${totalAllTeams} Registered Teams`;
  sumSub.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
  sumSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
  sumSub.alignment = { horizontal: 'center', vertical: 'middle' };
  sumSub.border = BORDER_RIBBON;
  wsSummary.getRow(3).height = 24;

  // Row 4: Spacer
  wsSummary.getRow(4).height = 6;

  // Row 5: Column Headers
  const sumHeaderRow = wsSummary.getRow(5);
  sumHeaderRow.height = 28;
  sumCols.forEach((col, idx) => {
    const c = sumHeaderRow.getCell(idx + 1);
    c.value = col.header;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    c.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
    c.border = BORDER_CELL;
    wsSummary.getColumn(idx + 1).width = col.width;
  });

  let sl = 1;
  for (const [theme, info] of teamsGroupedByTheme) {
    const rNum = sl + 5;
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
      cell.border = BORDER_CELL;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };
      cell.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
      if (idx === 1) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
    });
    sl++;
  }

  // Total Summary Row
  const totalRow = wsSummary.getRow(sl + 5);
  totalRow.height = 26;
  const totVals = ['', 'TOTAL', '', totalAllTeams, totalAllScanned, totalAllTeams > 0 ? Math.round((totalAllScanned / totalAllTeams) * 100) + '%' : '0%', ''];
  totVals.forEach((v, idx) => {
    const cell = totalRow.getCell(idx + 1);
    cell.value = v;
    cell.border = BORDER_RIBBON;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.ribbonText } };
    cell.alignment = { horizontal: (idx === 0 || idx >= 3) ? 'center' : 'left', vertical: 'middle' };
  });

  // Embed Logos on Summary Sheet (Rows 1 & 2)
  if (logoLeftId !== null) {
    wsSummary.addImage(logoLeftId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 130, height: 50 }
    });
  }
  if (logoRightId !== null) {
    wsSummary.addImage(logoRightId, {
      tl: { col: sumCols.length - 1.5, row: 0.1 },
      ext: { width: 155, height: 50 }
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
      views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
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

    // Row 1 & 2: Header on Clean White (logos flank this area)
    wsTheme.mergeCells(1, 1, 1, themeCols.length);
    const tCell1 = wsTheme.getCell('A1');
    tCell1.value = 'R.M.K. GROUP OF INSTITUTIONS';
    tCell1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
    tCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tCell1.alignment = { horizontal: 'center', vertical: 'bottom' };
    wsTheme.getRow(1).height = 30;

    wsTheme.mergeCells(2, 1, 2, themeCols.length);
    const tCell2 = wsTheme.getCell('A2');
    tCell2.value = 'JUNIOR HACKATHON 2026';
    tCell2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
    tCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tCell2.alignment = { horizontal: 'center', vertical: 'top' };
    wsTheme.getRow(2).height = 26;

    // Row 3: Theme & Venue Ribbon Banner (Light Mint Green with Pure Black text)
    wsTheme.mergeCells(3, 1, 3, themeCols.length);
    const subTCell = wsTheme.getCell('A3');
    subTCell.value = `THEME: ${theme.toUpperCase()}      |      VENUE: ${info.venue.toUpperCase()}      |      Teams: ${info.teams.length}`;
    subTCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
    subTCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    subTCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subTCell.border = BORDER_RIBBON;
    wsTheme.getRow(3).height = 24;

    // Row 4: Spacer
    wsTheme.getRow(4).height = 6;

    // Row 5: Column Headers Row
    const tHeadRow = wsTheme.getRow(5);
    tHeadRow.height = 28;
    themeCols.forEach((col, idx) => {
      const c = tHeadRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      c.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 6 || idx === 7) ? 'center' : 'left', vertical: 'middle' };
      c.border = BORDER_CELL;
      wsTheme.getColumn(idx + 1).width = col.width;
    });

    wsTheme.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: themeCols.length } };

    // Row 6+: Teams Rows (Pure Black Text on alternating green shades with clean black border)
    info.teams.forEach((t, tIdx) => {
      const rNum = tIdx + 6;
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
        cell.border = BORDER_CELL;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };

        if (cIdx === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (cIdx === 1) { // Team ID
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
        } else if (cIdx === 6) { // Attendance
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (isPresent) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.scannedBg } };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.scannedText } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pendingBg } };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.pendingText } };
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Embed Logos on each theme sheet (Rows 1 & 2 - Clean White Area, never overlaps Row 3)
    if (logoLeftId !== null) {
      wsTheme.addImage(logoLeftId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 130, height: 50 }
      });
    }
    if (logoRightId !== null) {
      wsTheme.addImage(logoRightId, {
        tl: { col: themeCols.length - 1.5, row: 0.1 },
        ext: { width: 155, height: 50 }
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
