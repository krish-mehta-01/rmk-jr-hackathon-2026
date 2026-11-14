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
    { key: 'members', header: 'Team Members', width: 34 },
    { key: 'mentor_name', header: 'Mentor Name', width: 22 },
    { key: 'mobile_no', header: 'Contact Mobile', width: 18 },
    { key: 'email', header: 'Leader Email', width: 32 },
    { key: 'college_name', header: 'School Name', width: 40 },
    { key: 'category', header: 'Theme Track', width: 30 },
    { key: 'panel_no', header: 'Panel No.', width: 14 },
    { key: 'venue', header: 'Allocated Venue', width: 36 },
    { key: 'status', header: 'Attendance Status', width: 19 },
    { key: 'signature', header: 'Signature', width: 24 }
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

  // Row 2: Event Subtitle on Crisp White
  ws.mergeCells(2, 1, 2, totalCols);
  const titleCell2 = ws.getCell('A2');
  titleCell2.value = 'JUNIOR HACKATHON 2026';
  titleCell2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
  titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  titleCell2.alignment = { horizontal: 'center', vertical: 'top' };
  ws.getRow(2).height = 26;

  // Count attendance stats
  const totalTeams = rows.length;
  const scannedTeams = rows.filter(r => r.is_present).length;
  const attendancePct = totalTeams > 0 ? Math.round((scannedTeams / totalTeams) * 100) : 0;

  // Row 3: Event Context Ribbon
  ws.mergeCells(3, 1, 3, totalCols);
  const ribbonCell = ws.getCell('A3');
  ribbonCell.value = `MASTER PRESENCE & REGISTRATION ROSTER  •  ${totalTeams} Total Teams  •  ${scannedTeams} Scanned (${attendancePct}%)  •  15 Evaluation Panels`;
  ribbonCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
  ribbonCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
  ribbonCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ribbonCell.border = BORDER_RIBBON;
  ws.getRow(3).height = 24;

  // Row 4: Spacer
  ws.getRow(4).height = 6;

  // Row 5: Column Headers Row
  const headerRow = ws.getRow(5);
  headerRow.height = 28;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 7 || idx === 11 || idx >= 13) ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_CELL;
    ws.getColumn(idx + 1).width = col.width;
  });

  // Enable AutoFilter
  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: totalCols }
  };

  // Row 6+: Data Rows
  rows.forEach((r, rowIdx) => {
    const rNum = rowIdx + 6;
    const isEven = (rowIdx % 2 === 0);
    const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
    const dRow = ws.getRow(rNum);
    dRow.height = 22;

    const isPresent = Boolean(r.is_present);

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
      r.panel_no ? `Panel ${r.panel_no}` : '—',
      r.venue || 'TBD',
      isPresent ? 'Scanned' : 'Not Scanned',
      '' // Signature blank column
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
      } else if (colIdx === 7 || colIdx === 14) { // Contact Mobile & Signature
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 11) { // Panel No
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
      } else if (colIdx === 13) { // Attendance Status
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
 * Builds the Multi-Sheet 15-Panel Jury & Venue Workbook
 */
async function buildVenueWiseWorkbook(panelsMap) {
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
  // SHEET 1: SUMMARY SHEET (15 PANELS)
  // ─────────────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
  });

  const sumCols = [
    { header: 'Sl. No.', width: 9 },
    { header: 'Panel No.', width: 14 },
    { header: 'Allocated Presentation Venue', width: 44 },
    { header: 'Themes / Domain Allocation', width: 46 },
    { header: 'Registered Teams', width: 20 },
    { header: 'Scanned (Present)', width: 20 },
    { header: 'Attendance %', width: 18 },
    { header: 'Jury / Coordinator Signature', width: 32 }
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
  for (const info of panelsMap.values()) {
    totalAllTeams += info.teams.length;
    totalAllScanned += info.teams.filter(t => t.is_present).length;
  }

  // Row 3: Ribbon Banner
  wsSummary.mergeCells(3, 1, 3, sumCols.length);
  const sumSub = wsSummary.getCell('A3');
  sumSub.value = `15-PANEL JURY VENUE ALLOCATION SUMMARY  •  15 Evaluation Panels  •  ${totalAllTeams} Registered Teams`;
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
    c.alignment = { horizontal: (idx === 0 || idx === 1 || idx >= 4) ? 'center' : 'left', vertical: 'middle' };
    c.border = BORDER_CELL;
    wsSummary.getColumn(idx + 1).width = col.width;
  });

  let sl = 1;
  for (const [panelNo, info] of panelsMap) {
    const rNum = sl + 5;
    const row = wsSummary.getRow(rNum);
    row.height = 24;
    const isEven = (sl % 2 === 1);
    const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;

    const tCount = info.teams.length;
    const sCount = info.teams.filter(t => t.is_present).length;
    const pct = tCount > 0 ? Math.round((sCount / tCount) * 100) + '%' : '0%';
    const themesStr = [...(info.themes || [])].join(', ');

    const vals = [sl, `Panel ${panelNo}`, info.venue, themesStr, tCount, sCount, pct, ''];
    vals.forEach((v, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = v;
      cell.border = BORDER_CELL;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };
      cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx >= 4) ? 'center' : 'left', vertical: 'middle' };
      if (idx === 1) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
    });
    sl++;
  }

  // Total Summary Row
  const totalRow = wsSummary.getRow(sl + 5);
  totalRow.height = 26;
  const totVals = ['', 'TOTAL', '', '', totalAllTeams, totalAllScanned, totalAllTeams > 0 ? Math.round((totalAllScanned / totalAllTeams) * 100) + '%' : '0%', ''];
  totVals.forEach((v, idx) => {
    const cell = totalRow.getCell(idx + 1);
    cell.value = v;
    cell.border = BORDER_RIBBON;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.ribbonText } };
    cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx >= 4) ? 'center' : 'left', vertical: 'middle' };
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
  // SHEETS 2..16: INDIVIDUAL VENUE SHEETS (Named by Venue)
  // 8 Standard Columns: Sl, ID, Leader, Members, Team Name, Title, Theme Track, School
  // ─────────────────────────────────────────────────────────────
  function safeVenueTabName(venue, panelNo) {
    if (!venue) return `Venue ${panelNo}`;
    let clean = venue
      .replace(/Second Floor/g, '2nd Flr')
      .replace(/First Floor/g, '1st Flr')
      .replace(/Seminar Hall/g, 'Sem Hall')
      .replace(/[:\\/?*\[\]]/g, '')
      .trim();
    if (clean.length > 31) clean = clean.substring(0, 31).trim();
    return clean || `Venue ${panelNo}`;
  }

  for (const [panelNo, info] of panelsMap) {
    const safeSheetName = safeVenueTabName(info.venue, panelNo);
    const themesStr = [...(info.themes || [])].join(', ');

    const wsPanel = wb.addWorksheet(safeSheetName, {
      views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    const panelCols = [
      { header: 'Sl. No.', width: 8 },
      { header: 'Team ID', width: 16 },
      { header: 'Team Name', width: 24 },
      { header: 'Idea / Project Title', width: 34 },
      { header: 'Team Leader', width: 22 },
      { header: 'Team Members', width: 30 },
      { header: 'Mentor Name', width: 20 },
      { header: 'Contact Mobile', width: 16 },
      { header: 'Leader Email', width: 26 },
      { header: 'School Name', width: 32 },
      { header: 'Theme Track', width: 26 },
      { header: 'Attendance Status', width: 18 },
      { header: 'Signature', width: 24 }
    ];

    // Row 1 & 2: Header on Clean White (logos flank this area)
    wsPanel.mergeCells(1, 1, 1, panelCols.length);
    const tCell1 = wsPanel.getCell('A1');
    tCell1.value = 'R.M.K. GROUP OF INSTITUTIONS';
    tCell1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
    tCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tCell1.alignment = { horizontal: 'center', vertical: 'bottom' };
    wsPanel.getRow(1).height = 30;

    wsPanel.mergeCells(2, 1, 2, panelCols.length);
    const tCell2 = wsPanel.getCell('A2');
    tCell2.value = 'JUNIOR HACKATHON 2026';
    tCell2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
    tCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tCell2.alignment = { horizontal: 'center', vertical: 'top' };
    wsPanel.getRow(2).height = 26;

    // Row 3: Theme & Venue Ribbon Banner (Light Mint Green with Pure Black text)
    wsPanel.mergeCells(3, 1, 3, panelCols.length);
    const subTCell = wsPanel.getCell('A3');
    subTCell.value = `VENUE: ${info.venue.toUpperCase()}      |      PANEL ${panelNo}      |      THEMES: ${themesStr.toUpperCase()}      |      Teams: ${info.teams.length}`;
    subTCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
    subTCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    subTCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subTCell.border = BORDER_RIBBON;
    wsPanel.getRow(3).height = 24;

    // Row 4: Spacer
    wsPanel.getRow(4).height = 6;

    // Row 5: Column Headers Row
    const tHeadRow = wsPanel.getRow(5);
    tHeadRow.height = 28;
    panelCols.forEach((col, idx) => {
      const c = tHeadRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      c.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 7 || idx >= 11) ? 'center' : 'left', vertical: 'middle' };
      c.border = BORDER_CELL;
      wsPanel.getColumn(idx + 1).width = col.width;
    });

    wsPanel.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: panelCols.length } };

    // Row 6+: Teams Rows (Pure Black Text on alternating green shades with clean black border)
    info.teams.forEach((t, tIdx) => {
      const rNum = tIdx + 6;
      const row = wsPanel.getRow(rNum);
      row.height = 22;
      const isEven = (tIdx % 2 === 0);
      const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;

      const isPresent = Boolean(t.is_present);
      const timeStr = t.check_in_time ? new Date(t.check_in_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : '—';
      const markedByStr = isPresent ? (t.marked_by || (t.qr_verification_token ? 'QR Scan' : 'Admin')) : '—';

      const vals = [
        tIdx + 1,
        t.team_code || '—',
        t.team_name || '—',
        t.project_title || '—',
        t.leader_name || '—',
        t.members || '—',
        t.mentor_name || '—',
        t.mobile_no || '—',
        t.email || '—',
        t.college_name || '—',
        t.category || '—',
        isPresent ? 'Scanned' : 'Not Scanned',
        '' // Signature blank column
      ];

      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.border = BORDER_CELL;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };

        if (cIdx === 0 || cIdx === 1 || cIdx === 7 || cIdx >= 11) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (cIdx === 1) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
        } else if (cIdx === 2 || cIdx === 4) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        if (cIdx === 11) {
          if (isPresent) {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.pillPresentText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pillPresentBg } };
          } else {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.pillAbsentText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pillAbsentBg } };
          }
        }
      });
    });

    // Embed Logos on each venue sheet (Rows 1 & 2 - Clean White Area, never overlaps Row 3)
    if (logoLeftId !== null) {
      wsPanel.addImage(logoLeftId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 130, height: 50 }
      });
    }
    if (logoRightId !== null) {
      wsPanel.addImage(logoRightId, {
        tl: { col: panelCols.length - 1.5, row: 0.1 },
        ext: { width: 155, height: 50 }
      });
    }
  }

  return wb;
}

/**
 * Builds the Multi-Sheet 12-Theme Evaluation & Attendance Workbook
 */
async function buildThemeWiseWorkbook(themesMap) {
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
  // SHEET 1: THEME SUMMARY SHEET (12 THEMES)
  // ─────────────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
  });

  const sumCols = [
    { header: 'Sl. No.', width: 9 },
    { header: 'Hackathon Theme / Category', width: 42 },
    { header: 'Allocated Venues & Panels', width: 48 },
    { header: 'Registered Teams', width: 20 },
    { header: 'Scanned (Present)', width: 20 },
    { header: 'Attendance %', width: 18 },
    { header: 'Lead Jury / Evaluator Signature', width: 34 }
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
  for (const info of themesMap.values()) {
    totalAllTeams += info.teams.length;
    totalAllScanned += info.teams.filter(t => t.is_present).length;
  }

  // Row 3: Ribbon Banner
  wsSummary.mergeCells(3, 1, 3, sumCols.length);
  const sumSub = wsSummary.getCell('A3');
  sumSub.value = `12-THEME JURY EVALUATION & VENUE ROSTER SUMMARY  •  12 Hackathon Themes  •  ${totalAllTeams} Registered Teams`;
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
  });

  // Data rows
  let rowIdx = 6;
  let slNo = 1;
  for (const [themeName, info] of themesMap.entries()) {
    const teams = info.teams || [];
    const tCount = teams.length;
    const sCount = teams.filter(t => t.is_present).length;
    const attPct = tCount > 0 ? `${Math.round((sCount / tCount) * 100)}%` : '0%';

    // Build venue string: e.g. "Panel 7 & 8 (RJ Block), Panel 11 (VR Block)"
    const venuePanels = new Map();
    for (const t of teams) {
      const p = t.panel_no || 1;
      const v = t.venue || 'TBD';
      if (!venuePanels.has(p)) venuePanels.set(p, v);
    }
    const venuesStr = [...venuePanels.entries()]
      .map(([p, v]) => `Panel ${p}: ${v}`)
      .join(' | ');

    const r = wsSummary.getRow(rowIdx);
    r.height = 24;

    const rowBg = (slNo % 2 === 0) ? PALETTE.rowOdd : PALETTE.rowEven;
    const cells = [
      slNo,
      themeName,
      venuesStr || 'TBD',
      tCount,
      sCount,
      attPct,
      '' // Signature blank
    ];

    cells.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: PALETTE.rowText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = BORDER_CELL;

      if (cIdx === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cIdx === 1) {
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.rowText } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (cIdx === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (cIdx >= 3 && cIdx <= 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (cIdx === 3) cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.rowText } };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    slNo++;
    rowIdx++;
  }

  // Summary Totals Row
  const totalRow = wsSummary.getRow(rowIdx);
  totalRow.height = 26;
  const totAttPct = totalAllTeams > 0 ? `${Math.round((totalAllScanned / totalAllTeams) * 100)}%` : '0%';
  const totCells = [
    '',
    'TOTAL (ALL 12 THEMES)',
    '15 Evaluation Panels Across Campus',
    totalAllTeams,
    totalAllScanned,
    totAttPct,
    ''
  ];

  totCells.forEach((val, cIdx) => {
    const cell = totalRow.getCell(cIdx + 1);
    cell.value = val;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.border = BORDER_CELL;
    cell.alignment = { horizontal: (cIdx === 1 || cIdx === 2) ? 'left' : 'center', vertical: 'middle' };
  });

  // Set explicit column widths for Summary
  sumCols.forEach((col, idx) => {
    wsSummary.getColumn(idx + 1).width = col.width;
  });

  // Embed Logos on Summary sheet (Rows 1 & 2)
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
  // SHEETS 2..13: INDIVIDUAL THEME SHEETS (ONE PER THEME)
  // Matching Venue-Wise Columns with Theme-Based Split
  // ─────────────────────────────────────────────────────────────
  const themeCols = [
    { header: 'Sl. No.', width: 8 },
    { header: 'Team ID', width: 16 },
    { header: 'Team Name', width: 24 },
    { header: 'Idea / Project Title', width: 32 },
    { header: 'Team Leader', width: 22 },
    { header: 'Team Members', width: 30 },
    { header: 'Mentor Name', width: 20 },
    { header: 'Contact Mobile', width: 16 },
    { header: 'Leader Email', width: 26 },
    { header: 'School Name', width: 32 },
    { header: 'Theme Track', width: 26 },
    { header: 'Panel No.', width: 14 },
    { header: 'Allocated Venue', width: 32 },
    { header: 'Attendance Status', width: 18 },
    { header: 'Signature', width: 24 }
  ];

  // Helper for safe Excel worksheet tab names (max 31 chars, no invalid chars : \ / ? * [ ])
  function safeSheetName(name, index) {
    let clean = name.replace(/[:\\/?*\[\]]/g, '').trim();
    if (clean.length > 28) clean = clean.substring(0, 28);
    return clean || `Theme ${index}`;
  }

  let themeIndex = 1;
  for (const [themeName, info] of themesMap.entries()) {
    const teams = info.teams || [];
    const sheetTitle = safeSheetName(themeName, themeIndex);
    const wsTheme = wb.addWorksheet(sheetTitle, {
      views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    themeCols.forEach((col, idx) => {
      wsTheme.getColumn(idx + 1).width = col.width;
    });

    // Row 1 & 2: Institutional Title on Clean White
    wsTheme.mergeCells(1, 1, 1, themeCols.length);
    const tTitle1 = wsTheme.getCell('A1');
    tTitle1.value = 'R.M.K. GROUP OF INSTITUTIONS';
    tTitle1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
    tTitle1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tTitle1.alignment = { horizontal: 'center', vertical: 'bottom' };
    wsTheme.getRow(1).height = 30;

    wsTheme.mergeCells(2, 1, 2, themeCols.length);
    const tTitle2 = wsTheme.getCell('A2');
    tTitle2.value = 'JUNIOR HACKATHON 2026';
    tTitle2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
    tTitle2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tTitle2.alignment = { horizontal: 'center', vertical: 'top' };
    wsTheme.getRow(2).height = 26;

    // Build unique venues string for this theme
    const venuePanels = new Map();
    for (const t of teams) {
      const p = t.panel_no || 1;
      const v = t.venue || 'TBD';
      if (!venuePanels.has(p)) venuePanels.set(p, v);
    }
    const venuesSummary = [...venuePanels.entries()].map(([p, v]) => `Panel ${p}: ${v}`).join(' | ');

    // Row 3: Ribbon Banner with Theme Name & Venues
    wsTheme.mergeCells(3, 1, 3, themeCols.length);
    const tSub = wsTheme.getCell('A3');
    tSub.value = `THEME: ${themeName.toUpperCase()}      |      VENUES: ${venuesSummary.toUpperCase() || 'TBD'}      |      Teams: ${teams.length}`;
    tSub.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
    tSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    tSub.alignment = { horizontal: 'center', vertical: 'middle' };
    tSub.border = BORDER_RIBBON;
    wsTheme.getRow(3).height = 25;

    // Row 4: Spacer
    wsTheme.getRow(4).height = 6;

    // Row 5: Column Headers
    const hRow = wsTheme.getRow(5);
    hRow.height = 28;
    themeCols.forEach((col, idx) => {
      const c = hRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      c.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 7 || idx === 11 || idx >= 13) ? 'center' : 'left', vertical: 'middle' };
      c.border = BORDER_CELL;
    });

    wsTheme.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: themeCols.length } };

    // Team Rows
    teams.forEach((t, tIdx) => {
      const rNum = 6 + tIdx;
      const r = wsTheme.getRow(rNum);
      r.height = 25;

      const isEven = (tIdx % 2 === 0);
      const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
      const isPresent = Boolean(t.is_present);

      const rowValues = [
        tIdx + 1,
        t.team_code || '—',
        t.team_name || '—',
        t.project_title || '—',
        t.leader_name || '—',
        t.members || '—',
        t.mentor_name || '—',
        t.mobile_no || '—',
        t.email || '—',
        t.college_name || '—',
        t.category || themeName || '—',
        t.panel_no ? `Panel ${t.panel_no}` : '—',
        t.venue || 'TBD',
        isPresent ? 'Scanned' : 'Not Scanned',
        '' // Signature blank column
      ];

      rowValues.forEach((val, cIdx) => {
        const cell = r.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = BORDER_CELL;

        if (cIdx === 0 || cIdx === 1 || cIdx === 7 || cIdx === 11 || cIdx >= 13) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (cIdx === 1 || cIdx === 11) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
        } else if (cIdx === 2 || cIdx === 4) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        if (cIdx === 13) {
          if (isPresent) {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.pillPresentText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pillPresentBg } };
          } else {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.pillAbsentText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.pillAbsentBg } };
          }
        }
      });
    });

    // Embed Logos on each theme sheet (Rows 1 & 2)
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

/**
 * Builds the Venue-wise Presentation Roster workbook (Clean 8 Columns, NO attendance details)
 */
async function buildVenueRosterWorkbook(panelsMap) {
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

  // SHEET 1: SUMMARY SHEET (15 PANELS)
  const wsSummary = wb.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
  });

  const sumCols = [
    { header: 'Sl. No.', width: 9 },
    { header: 'Panel No.', width: 14 },
    { header: 'Allocated Presentation Venue', width: 44 },
    { header: 'Themes / Domain Allocation', width: 46 },
    { header: 'Registered Teams', width: 20 }
  ];

  wsSummary.mergeCells(1, 1, 1, sumCols.length);
  const tCell1 = wsSummary.getCell('A1');
  tCell1.value = 'R.M.K. GROUP OF INSTITUTIONS';
  tCell1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
  tCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  tCell1.alignment = { horizontal: 'center', vertical: 'bottom' };
  wsSummary.getRow(1).height = 30;

  wsSummary.mergeCells(2, 1, 2, sumCols.length);
  const tCell2 = wsSummary.getCell('A2');
  tCell2.value = 'JUNIOR HACKATHON 2026';
  tCell2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
  tCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  tCell2.alignment = { horizontal: 'center', vertical: 'top' };
  wsSummary.getRow(2).height = 26;

  let totalAllTeams = 0;
  for (const [, info] of panelsMap) {
    totalAllTeams += (info.teams || []).length;
  }

  wsSummary.mergeCells(3, 1, 3, sumCols.length);
  const subT = wsSummary.getCell('A3');
  subT.value = `15-PANEL JURY VENUE ALLOCATION SUMMARY   •   15 Panels Across Campus   •   ${totalAllTeams} Registered Teams`;
  subT.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
  subT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
  subT.alignment = { horizontal: 'center', vertical: 'middle' };
  subT.border = BORDER_RIBBON;
  wsSummary.getRow(3).height = 24;

  wsSummary.getRow(4).height = 6;

  const sumHeadRow = wsSummary.getRow(5);
  sumHeadRow.height = 28;
  sumCols.forEach((col, idx) => {
    const cell = sumHeadRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 4) ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_CELL;
  });

  let sl = 1;
  for (const [panelNo, info] of panelsMap) {
    const row = wsSummary.getRow(sl + 5);
    row.height = 24;
    const isEven = (sl % 2 === 0);
    const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
    const tCount = (info.teams || []).length;
    const themesStr = [...(info.themes || [])].join(', ');

    const vals = [sl, `Panel ${panelNo}`, info.venue, themesStr, tCount];
    vals.forEach((v, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = v;
      cell.border = BORDER_CELL;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };
      cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 4) ? 'center' : 'left', vertical: 'middle' };
      if (idx === 1) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
    });
    sl++;
  }

  // Total Summary Row
  const totalRow = wsSummary.getRow(sl + 5);
  totalRow.height = 26;
  const totVals = ['', 'TOTAL', '', '', totalAllTeams];
  totVals.forEach((v, idx) => {
    const cell = totalRow.getCell(idx + 1);
    cell.value = v;
    cell.border = BORDER_RIBBON;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.ribbonText } };
    cell.alignment = { horizontal: (idx === 0 || idx === 1 || idx === 4) ? 'center' : 'left', vertical: 'middle' };
  });

  sumCols.forEach((col, idx) => {
    wsSummary.getColumn(idx + 1).width = col.width;
  });

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

  // SHEETS 2..16: 15 INDIVIDUAL PANEL ROSTER SHEETS (8 COLUMNS)
  const rosterCols = [
    { header: 'Sl. No.', width: 8 },
    { header: 'Junior Hackathon ID', width: 22 },
    { header: 'Team Leader Name', width: 24 },
    { header: 'Team Members', width: 34 },
    { header: 'Team Name', width: 26 },
    { header: 'Title of Your Project', width: 36 },
    { header: 'Theme Track', width: 28 },
    { header: 'School Name', width: 38 }
  ];

  function safeVenueTabName(venue, panelNo) {
    if (!venue) return `Venue ${panelNo}`;
    let clean = venue
      .replace(/Second Floor/g, '2nd Flr')
      .replace(/First Floor/g, '1st Flr')
      .replace(/Seminar Hall/g, 'Sem Hall')
      .replace(/[:\\/?*\[\]]/g, '')
      .trim();
    if (clean.length > 31) clean = clean.substring(0, 31).trim();
    return clean || `Venue ${panelNo}`;
  }

  for (const [panelNo, info] of panelsMap) {
    const safeSheetName = safeVenueTabName(info.venue, panelNo);
    const themesStr = [...(info.themes || [])].join(', ');

    const wsPanel = wb.addWorksheet(safeSheetName, {
      views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    wsPanel.mergeCells(1, 1, 1, rosterCols.length);
    const tCell1 = wsPanel.getCell('A1');
    tCell1.value = 'R.M.K. GROUP OF INSTITUTIONS';
    tCell1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
    tCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tCell1.alignment = { horizontal: 'center', vertical: 'bottom' };
    wsPanel.getRow(1).height = 30;

    wsPanel.mergeCells(2, 1, 2, rosterCols.length);
    const tCell2 = wsPanel.getCell('A2');
    tCell2.value = 'JUNIOR HACKATHON 2026';
    tCell2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
    tCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tCell2.alignment = { horizontal: 'center', vertical: 'top' };
    wsPanel.getRow(2).height = 26;

    wsPanel.mergeCells(3, 1, 3, rosterCols.length);
    const subTCell = wsPanel.getCell('A3');
    subTCell.value = `VENUE: ${info.venue.toUpperCase()}      |      PANEL ${panelNo}      |      THEMES: ${themesStr.toUpperCase()}      |      Teams: ${info.teams.length}`;
    subTCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
    subTCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    subTCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subTCell.border = BORDER_RIBBON;
    wsPanel.getRow(3).height = 24;

    wsPanel.getRow(4).height = 6;

    const tHeadRow = wsPanel.getRow(5);
    tHeadRow.height = 28;
    rosterCols.forEach((col, idx) => {
      const cell = tHeadRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      cell.alignment = { horizontal: (idx === 0 || idx === 1) ? 'center' : 'left', vertical: 'middle' };
      cell.border = BORDER_CELL;
    });

    wsPanel.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: rosterCols.length } };

    info.teams.forEach((t, tIdx) => {
      const rNum = 6 + tIdx;
      const row = wsPanel.getRow(rNum);
      row.height = 24;
      const isEven = (tIdx % 2 === 0);
      const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;

      const vals = [
        tIdx + 1,
        t.team_code || '—',
        t.leader_name || '—',
        t.members || '—',
        t.team_name || '—',
        t.project_title || '—',
        t.category || '—',
        t.college_name || '—'
      ];

      vals.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = BORDER_CELL;
        cell.alignment = { horizontal: (cIdx === 0 || cIdx === 1) ? 'center' : 'left', vertical: 'middle' };
        if (cIdx === 1) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
      });
    });

    rosterCols.forEach((col, idx) => {
      wsPanel.getColumn(idx + 1).width = col.width;
    });

    if (logoLeftId !== null) {
      wsPanel.addImage(logoLeftId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 130, height: 50 }
      });
    }
    if (logoRightId !== null) {
      wsPanel.addImage(logoRightId, {
        tl: { col: rosterCols.length - 1.5, row: 0.1 },
        ext: { width: 155, height: 50 }
      });
    }
  }

  return wb;
}

/**
 * Builds the Theme-wise Presentation Roster workbook (Clean 8 Columns, NO attendance details)
 */
async function buildThemeRosterWorkbook(themesMap) {
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

  // SHEET 1: THEME SUMMARY SHEET (12 THEMES)
  const wsSummary = wb.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
  });

  const sumCols = [
    { header: 'Sl. No.', width: 9 },
    { header: 'Hackathon Theme / Category', width: 42 },
    { header: 'Allocated Venues & Panels', width: 48 },
    { header: 'Registered Teams', width: 20 }
  ];

  wsSummary.mergeCells(1, 1, 1, sumCols.length);
  const tCell1 = wsSummary.getCell('A1');
  tCell1.value = 'R.M.K. GROUP OF INSTITUTIONS';
  tCell1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
  tCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  tCell1.alignment = { horizontal: 'center', vertical: 'bottom' };
  wsSummary.getRow(1).height = 30;

  wsSummary.mergeCells(2, 1, 2, sumCols.length);
  const tCell2 = wsSummary.getCell('A2');
  tCell2.value = 'JUNIOR HACKATHON 2026';
  tCell2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
  tCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
  tCell2.alignment = { horizontal: 'center', vertical: 'top' };
  wsSummary.getRow(2).height = 26;

  let totalAllTeams = 0;
  for (const [, info] of themesMap.entries()) {
    totalAllTeams += (info.teams || []).length;
  }

  wsSummary.mergeCells(3, 1, 3, sumCols.length);
  const subT = wsSummary.getCell('A3');
  subT.value = `12-THEME JURY EVALUATION & VENUE ROSTER SUMMARY   •   12 Themes Across Campus   •   ${totalAllTeams} Registered Teams`;
  subT.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
  subT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
  subT.alignment = { horizontal: 'center', vertical: 'middle' };
  subT.border = BORDER_RIBBON;
  wsSummary.getRow(3).height = 24;

  wsSummary.getRow(4).height = 6;

  const sumHeadRow = wsSummary.getRow(5);
  sumHeadRow.height = 28;
  sumCols.forEach((col, idx) => {
    const cell = sumHeadRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.alignment = { horizontal: (idx === 0 || idx === 3) ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_CELL;
  });

  let rowIdx = 6;
  let sNum = 1;
  for (const [themeName, info] of themesMap.entries()) {
    const teams = info.teams || [];
    const vpMap = new Map();
    for (const t of teams) {
      const p = t.panel_no || 1;
      const v = t.venue || 'TBD';
      if (!vpMap.has(p)) vpMap.set(p, v);
    }
    const vpSummary = [...vpMap.entries()].map(([p, v]) => `Panel ${p}: ${v}`).join(' | ');

    const row = wsSummary.getRow(rowIdx);
    row.height = 24;
    const isEven = (sNum % 2 === 0);
    const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;

    const rowVals = [sNum, themeName, vpSummary || 'TBD', teams.length];
    rowVals.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.border = BORDER_CELL;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };
      cell.alignment = { horizontal: (cIdx === 0 || cIdx === 3) ? 'center' : 'left', vertical: 'middle' };
      if (cIdx === 1) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
    });

    sNum++;
    rowIdx++;
  }

  // Summary Totals Row
  const totalRow = wsSummary.getRow(rowIdx);
  totalRow.height = 26;
  const totCells = ['', 'TOTAL (ALL 12 THEMES)', '15 Evaluation Panels Across Campus', totalAllTeams];
  totCells.forEach((val, cIdx) => {
    const cell = totalRow.getCell(cIdx + 1);
    cell.value = val;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
    cell.border = BORDER_CELL;
    cell.alignment = { horizontal: (cIdx === 1 || cIdx === 2) ? 'left' : 'center', vertical: 'middle' };
  });

  sumCols.forEach((col, idx) => {
    wsSummary.getColumn(idx + 1).width = col.width;
  });

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

  // SHEETS 2..13: INDIVIDUAL THEME ROSTER SHEETS (8 COLUMNS)
  const themeRosterCols = [
    { header: 'Sl. No.', width: 8 },
    { header: 'Junior Hackathon ID', width: 22 },
    { header: 'Team Leader Name', width: 24 },
    { header: 'Team Members', width: 34 },
    { header: 'Team Name', width: 26 },
    { header: 'Title of Your Project', width: 36 },
    { header: 'Venue', width: 34 },
    { header: 'School Name', width: 38 }
  ];

  function safeSheetName(name, index) {
    let clean = name.replace(/[:\\/?*\[\]]/g, '').trim();
    if (clean.length > 28) clean = clean.substring(0, 28);
    return clean || `Theme ${index}`;
  }

  let themeIndex = 1;
  for (const [themeName, info] of themesMap.entries()) {
    const teams = info.teams || [];
    const sheetTitle = safeSheetName(themeName, themeIndex);
    const wsTheme = wb.addWorksheet(sheetTitle, {
      views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    wsTheme.mergeCells(1, 1, 1, themeRosterCols.length);
    const tTitle1 = wsTheme.getCell('A1');
    tTitle1.value = 'R.M.K. GROUP OF INSTITUTIONS';
    tTitle1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerTextGreen } };
    tTitle1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tTitle1.alignment = { horizontal: 'center', vertical: 'bottom' };
    wsTheme.getRow(1).height = 30;

    wsTheme.mergeCells(2, 1, 2, themeRosterCols.length);
    const tTitle2 = wsTheme.getCell('A2');
    tTitle2.value = 'JUNIOR HACKATHON 2026';
    tTitle2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: PALETTE.headerTextDark } };
    tTitle2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } };
    tTitle2.alignment = { horizontal: 'center', vertical: 'top' };
    wsTheme.getRow(2).height = 26;

    const venuePanels = new Map();
    for (const t of teams) {
      const p = t.panel_no || 1;
      const v = t.venue || 'TBD';
      if (!venuePanels.has(p)) venuePanels.set(p, v);
    }
    const venuesSummary = [...venuePanels.entries()].map(([p, v]) => `Panel ${p}: ${v}`).join(' | ');

    wsTheme.mergeCells(3, 1, 3, themeRosterCols.length);
    const tSub = wsTheme.getCell('A3');
    tSub.value = `THEME: ${themeName.toUpperCase()}      |      VENUES: ${venuesSummary.toUpperCase() || 'TBD'}      |      Teams: ${teams.length}`;
    tSub.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.ribbonText } };
    tSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.ribbonBg } };
    tSub.alignment = { horizontal: 'center', vertical: 'middle' };
    tSub.border = BORDER_RIBBON;
    wsTheme.getRow(3).height = 25;

    wsTheme.getRow(4).height = 6;

    const hRow = wsTheme.getRow(5);
    hRow.height = 28;
    themeRosterCols.forEach((col, idx) => {
      const c = hRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.tblHeaderText } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tblHeaderBg } };
      c.alignment = { horizontal: (idx === 0 || idx === 1) ? 'center' : 'left', vertical: 'middle' };
      c.border = BORDER_CELL;
    });

    wsTheme.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: themeRosterCols.length } };

    teams.forEach((t, tIdx) => {
      const rNum = 6 + tIdx;
      const r = wsTheme.getRow(rNum);
      r.height = 24;

      const isEven = (tIdx % 2 === 0);
      const rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
      const venueStr = `Panel ${t.panel_no || 1} — ${t.venue || 'TBD'}`;

      const rowValues = [
        tIdx + 1,
        t.team_code || '—',
        t.leader_name || '—',
        t.members || '—',
        t.team_name || '—',
        t.project_title || '—',
        venueStr,
        t.college_name || '—'
      ];

      rowValues.forEach((val, cIdx) => {
        const cell = r.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.rowText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = BORDER_CELL;
        cell.alignment = { horizontal: (cIdx === 0 || cIdx === 1) ? 'center' : 'left', vertical: 'middle' };
        if (cIdx === 1) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.rowText } };
      });
    });

    themeRosterCols.forEach((col, idx) => {
      wsTheme.getColumn(idx + 1).width = col.width;
    });

    if (logoLeftId !== null) {
      wsTheme.addImage(logoLeftId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 130, height: 50 }
      });
    }
    if (logoRightId !== null) {
      wsTheme.addImage(logoRightId, {
        tl: { col: themeRosterCols.length - 1.5, row: 0.1 },
        ext: { width: 155, height: 50 }
      });
    }

    themeIndex++;
  }

  return wb;
}

module.exports = {
  buildPresenceExcel,
  buildVenueWiseWorkbook,
  buildThemeWiseWorkbook,
  buildVenueRosterWorkbook,
  buildThemeRosterWorkbook
};
