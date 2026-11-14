const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const LOGO_LEFT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_group_logo.png');
const LOGO_RIGHT_PATH = path.join(__dirname, '..', 'frontend', 'assets', 'rmk_jr_hackathon_2026_logo.png');

function formatCheckInTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(iso);
  }
}

function formatMarkedBy(r) {
  if (!r.is_present) return '—';
  if (r.marked_by) return r.marked_by;
  if (r.qr_verification_token) return 'QR Scan';
  return 'Admin';
}

/**
 * Cleans string for PDF rendering: removes raw newlines/tabs and normalizes spaces.
 * NEVER truncates with ellipsis so staff gets complete visibility for printouts.
 */
function cleanString(str) {
  if (str === null || str === undefined) return '—';
  let s = String(str).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s || '—';
}

// Master Attendance (15 Canonical Columns matching Excel)
// Sum: 18+44+52+105+50+56+44+38+58+82+66+32+70+47+48 = 810 pt (Exact printable width on A4 landscape)
const MASTER_COLS = [
  { key: 'sl', label: 'Sl. No.', width: 18, align: 'center' },
  { key: 'team_code', label: 'Team ID', width: 44, align: 'center' },
  { key: 'team_name', label: 'Team Name', width: 52, align: 'left' },
  { key: 'project_title', label: 'Idea / Project Title', width: 105, align: 'left' },
  { key: 'leader_name', label: 'Team Leader', width: 50, align: 'left' },
  { key: 'members', label: 'Team Members', width: 56, align: 'left' },
  { key: 'mentor_name', label: 'Mentor Name', width: 44, align: 'left' },
  { key: 'mobile_no', label: 'Contact Mobile', width: 38, align: 'center' },
  { key: 'email', label: 'Leader Email', width: 58, align: 'left' },
  { key: 'college_name', label: 'School Name', width: 82, align: 'left' },
  { key: 'category', label: 'Theme Track', width: 66, align: 'left' },
  { key: 'panel_no', label: 'Panel No.', width: 32, align: 'center' },
  { key: 'venue', label: 'Allocated Venue', width: 70, align: 'left' },
  { key: 'status', label: 'Attendance Status', width: 47, align: 'center' },
  { key: 'signature', label: 'Signature', width: 48, align: 'center' }
];

// Venue-Wise Attendance (13 Columns - NO Venue column, has Theme Track and Signature)
// Sum: 20+46+58+130+56+66+48+42+68+96+76+49+55 = 810 pt
const VENUE_COLS = [
  { key: 'sl', label: 'Sl. No.', width: 20, align: 'center' },
  { key: 'team_code', label: 'Team ID', width: 46, align: 'center' },
  { key: 'team_name', label: 'Team Name', width: 58, align: 'left' },
  { key: 'project_title', label: 'Idea / Project Title', width: 130, align: 'left' },
  { key: 'leader_name', label: 'Team Leader', width: 56, align: 'left' },
  { key: 'members', label: 'Team Members', width: 66, align: 'left' },
  { key: 'mentor_name', label: 'Mentor Name', width: 48, align: 'left' },
  { key: 'mobile_no', label: 'Contact Mobile', width: 42, align: 'center' },
  { key: 'email', label: 'Leader Email', width: 68, align: 'left' },
  { key: 'college_name', label: 'School Name', width: 96, align: 'left' },
  { key: 'category', label: 'Theme Track', width: 76, align: 'left' },
  { key: 'status', label: 'Attendance Status', width: 49, align: 'center' },
  { key: 'signature', label: 'Signature', width: 55, align: 'center' }
];

// Theme-Wise Attendance (15 Columns - HAS Theme Track, Panel, Venue, Status, Signature)
const THEME_COLS = MASTER_COLS;

function drawTableHeader(doc, startY, cols = MASTER_COLS) {
  const startX = 16;
  const hHeight = 20; // Expanded header height so wrapped labels fit completely without cutoffs
  const totalW = cols.reduce((sum, c) => sum + c.width, 0);

  // Background rect (Deep Emerald Green #166534 matching Excel)
  doc.rect(startX, startY, totalW, hHeight).fill('#166534');

  // Outer border
  doc.strokeColor('#000000').lineWidth(0.5);
  doc.rect(startX, startY, totalW, hHeight).stroke();

  let curX = startX;
  doc.fillColor('#FFFFFF').fontSize(5.6).font('Helvetica-Bold');
  cols.forEach((c, idx) => {
    if (idx > 0) {
      doc.strokeColor('#14532D').lineWidth(0.5);
      doc.moveTo(curX, startY).lineTo(curX, startY + hHeight).stroke();
    }
    const labelText = c.label;
    const textH = doc.heightOfString(labelText, { width: c.width - 2, lineBreak: true });
    const textY = startY + Math.max(2, Math.round((hHeight - textH) / 2));

    doc.fillColor('#FFFFFF').text(labelText, curX + 1, textY, {
      width: c.width - 2,
      align: c.align,
      lineBreak: true // Wrap if necessary, NO ellipsis truncation
    });
    curX += c.width;
  });

  return startY + hHeight;
}

/**
 * Calculates dynamic row height based on actual text contents across all cells.
 * Enforces a generous minimum cell height (28pt) so staff printouts have ample readability and signing space.
 */
function calculateRowHeight(doc, rowValues, cols) {
  let maxHeight = 28; // Minimum generous row height for physical printout
  cols.forEach(c => {
    if (c.key === 'signature' || c.key === 'status') return;
    const text = cleanString(rowValues[c.key]);
    if (!text || text === '—') return;

    let fontName = 'Helvetica';
    let fontSize = 5.6;
    if (c.key === 'team_code' || c.key === 'panel_no') {
      fontName = 'Helvetica-Bold';
      fontSize = 5.6;
    }
    doc.font(fontName).fontSize(fontSize);
    const cellW = c.width - 4;
    const h = doc.heightOfString(text, { width: cellW, lineBreak: true });
    const cellReqH = h + 8; // 4 pt top padding + 4 pt bottom padding
    if (cellReqH > maxHeight) {
      maxHeight = cellReqH;
    }
  });
  return Math.ceil(maxHeight);
}

function drawTableRow(doc, row, slNo, startY, isEven, cols = MASTER_COLS, precomputedHeight = null, precomputedValues = null) {
  const startX = 16;
  const totalW = cols.reduce((sum, c) => sum + c.width, 0);

  const isPresent = Boolean(row.is_present);
  const statusStr = isPresent ? 'Scanned' : 'Not Scanned';

  const rowValues = precomputedValues || {
    sl: String(slNo),
    team_code: row.team_code || '—',
    team_name: row.team_name || '—',
    project_title: row.project_title || '—',
    leader_name: row.leader_name || '—',
    members: row.members || '—',
    mentor_name: row.mentor_name || '—',
    mobile_no: row.mobile_no || '—',
    email: row.email || '—',
    college_name: row.college_name || '—',
    category: row.category || '—',
    panel_no: row.panel_no ? `Panel ${row.panel_no}` : '—',
    venue: row.venue || 'TBD',
    status: statusStr,
    signature: ''
  };

  const rHeight = precomputedHeight || calculateRowHeight(doc, rowValues, cols);

  // Background: alternating pure white (#FFFFFF) and soft mint tint (#F0FDF4) matching Excel
  const bg = isEven ? '#F0FDF4' : '#FFFFFF';
  doc.rect(startX, startY, totalW, rHeight).fill(bg);

  // Bottom border line
  doc.strokeColor('#CBD5E1').lineWidth(0.4);
  doc.moveTo(startX, startY + rHeight).lineTo(startX + totalW, startY + rHeight).stroke();

  let curX = startX;
  cols.forEach((c, idx) => {
    // Vertical divider line
    if (idx > 0) {
      doc.strokeColor('#E2E8F0').lineWidth(0.3);
      doc.moveTo(curX, startY).lineTo(curX, startY + rHeight).stroke();
    }

    const val = rowValues[c.key] || '—';

    if (c.key === 'signature') {
      // Signature column: dedicated empty box for staff signature on printout
    } else if (c.key === 'status') {
      // Status pill vertically centered within the expanded cell height
      const pillW = c.width - 6;
      const pillH = 12;
      const pillX = curX + 3;
      const pillY = startY + Math.round((rHeight - pillH) / 2);

      if (isPresent) {
        doc.roundedRect(pillX, pillY, pillW, pillH, 2).fill('#22C55E');
        doc.font('Helvetica-Bold').fontSize(5.4).fillColor('#FFFFFF');
        doc.text('Scanned', curX + 1, pillY + 2.5, {
          width: c.width - 2,
          align: 'center',
          lineBreak: false
        });
      } else {
        doc.roundedRect(pillX, pillY, pillW, pillH, 2).fill('#F1F5F9');
        doc.strokeColor('#CBD5E1').lineWidth(0.3).roundedRect(pillX, pillY, pillW, pillH, 2).stroke();
        doc.font('Helvetica').fontSize(5.2).fillColor('#000000');
        doc.text('Not Scanned', curX + 1, pillY + 2.5, {
          width: c.width - 2,
          align: 'center',
          lineBreak: false
        });
      }
    } else {
      let fontName = 'Helvetica';
      let fontSize = 5.6;
      let fontColor = '#000000';

      if (c.key === 'team_code' || c.key === 'panel_no') {
        fontName = 'Helvetica-Bold';
        fontSize = 5.6;
      }

      doc.font(fontName).fontSize(fontSize).fillColor(fontColor);
      const cleanVal = cleanString(val);
      const textH = doc.heightOfString(cleanVal, { width: c.width - 4, lineBreak: true });
      const textY = (rHeight > textH + 8) ? startY + Math.round((rHeight - textH) / 2) : startY + 4;

      doc.text(cleanVal, curX + 2, textY, {
        width: c.width - 4,
        align: c.align,
        lineBreak: true // Complete multi-line wrapping so entire text is visible
      });
    }

    curX += c.width;
  });

  return startY + rHeight;
}

/**
 * Builds Dynamic Master Attendance PDF
 */
function buildMasterAttendancePdf(rows) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 16 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const total = rows.length;
      const present = rows.filter(r => r.is_present).length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;

      // Header on Page 1 (Identical to Excel)
      if (fs.existsSync(LOGO_LEFT_PATH)) {
        doc.image(LOGO_LEFT_PATH, 16, 12, { width: 44 });
      }
      if (fs.existsSync(LOGO_RIGHT_PATH)) {
        doc.image(LOGO_RIGHT_PATH, 770, 12, { width: 56 });
      }

      doc.fontSize(15).fillColor('#14532D').font('Helvetica-Bold').text('R.M.K. GROUP OF INSTITUTIONS', 16, 14, { align: 'center', width: 810 });
      doc.fontSize(11).fillColor('#000000').font('Helvetica-Bold').text('JUNIOR HACKATHON 2026', 16, 32, { align: 'center', width: 810 });

      // Ribbon (matching Excel row 3)
      doc.rect(16, 48, 810, 18).fillAndStroke('#DCFCE7', '#000000');
      doc.fontSize(8.5).fillColor('#000000').font('Helvetica-Bold').text(
        `MASTER PRESENCE & REGISTRATION ROSTER  •  ${total} Total Teams  •  ${present} Scanned (${pct}%)  •  15 Evaluation Panels`,
        16, 53, { align: 'center', width: 810 }
      );

      let curY = 72;
      curY = drawTableHeader(doc, curY);

      rows.forEach((r, idx) => {
        const isPresent = Boolean(r.is_present);
        const statusStr = isPresent ? 'Scanned' : 'Not Scanned';
        const rowVals = {
          sl: String(idx + 1),
          team_code: r.team_code || '—',
          team_name: r.team_name || '—',
          project_title: r.project_title || '—',
          leader_name: r.leader_name || '—',
          members: r.members || '—',
          mentor_name: r.mentor_name || '—',
          mobile_no: r.mobile_no || '—',
          email: r.email || '—',
          college_name: r.college_name || '—',
          category: r.category || '—',
          panel_no: r.panel_no ? `Panel ${r.panel_no}` : '—',
          venue: r.venue || 'TBD',
          status: statusStr,
          signature: ''
        };
        const rHeight = calculateRowHeight(doc, rowVals, MASTER_COLS);

        // If next row would exceed printable page boundary (550 pt)
        if (curY + rHeight > 550) {
          doc.addPage();
          doc.rect(16, 12, 810, 16).fillAndStroke('#DCFCE7', '#000000');
          doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold').text(
            'R.M.K. JUNIOR HACKATHON 2026 — MASTER ATTENDANCE ROSTER (Contd.)',
            16, 16, { align: 'center', width: 810 }
          );
          curY = 34;
          curY = drawTableHeader(doc, curY, MASTER_COLS);
        }
        curY = drawTableRow(doc, r, idx + 1, curY, idx % 2 === 1, MASTER_COLS, rHeight, rowVals);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Builds Dynamic Venue-wise Attendance PDF
 */
function buildVenueAttendancePdf(rows) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 16 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const total = rows.length;
      const present = rows.filter(r => r.is_present).length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;

      // Group by panel
      const panelsMap = new Map();
      for (let p = 1; p <= 15; p++) {
        panelsMap.set(p, { panel_no: p, venue: '', teams: [] });
      }

      rows.forEach(r => {
        const p = r.panel_no || 1;
        if (!panelsMap.has(p)) {
          panelsMap.set(p, { panel_no: p, venue: r.venue || 'TBD', teams: [] });
        }
        const pan = panelsMap.get(p);
        if (r.venue && !pan.venue) pan.venue = r.venue;
        pan.teams.push(r);
      });

      // Cover / Header on first page (Matching Excel)
      if (fs.existsSync(LOGO_LEFT_PATH)) {
        doc.image(LOGO_LEFT_PATH, 16, 12, { width: 44 });
      }
      if (fs.existsSync(LOGO_RIGHT_PATH)) {
        doc.image(LOGO_RIGHT_PATH, 770, 12, { width: 56 });
      }

      doc.fontSize(15).fillColor('#14532D').font('Helvetica-Bold').text('R.M.K. GROUP OF INSTITUTIONS', 16, 14, { align: 'center', width: 810 });
      doc.fontSize(11).fillColor('#000000').font('Helvetica-Bold').text('JUNIOR HACKATHON 2026', 16, 32, { align: 'center', width: 810 });

      // Ribbon (matching Excel row 3)
      doc.rect(16, 48, 810, 18).fillAndStroke('#DCFCE7', '#000000');
      doc.fontSize(8.5).fillColor('#000000').font('Helvetica-Bold').text(
        `15-PANEL VENUE & EVALUATION ROSTER  •  ${total} Total Teams  •  ${present} Scanned (${pct}%)  •  15 Evaluation Panels`,
        16, 53, { align: 'center', width: 810 }
      );

      let isFirstPanel = true;
      let curY = 72;

      for (const [pNo, info] of panelsMap) {
        if (info.teams.length === 0) continue;

        if (!isFirstPanel) {
          doc.addPage();
          curY = 16;
        }
        isFirstPanel = false;

        const pPres = info.teams.filter(t => t.is_present).length;
        const pPct = info.teams.length > 0 ? Math.round((pPres / info.teams.length) * 100) : 0;

        // Panel banner ribbon
        doc.rect(16, curY, 810, 16).fillAndStroke('#DCFCE7', '#166534');
        doc.fontSize(8.5).fillColor('#14532D').font('Helvetica-Bold')
           .text(`PANEL ${pNo} — VENUE: ${(info.venue || 'TBD').toUpperCase()}  •  ${info.teams.length} Teams  •  ${pPres} Scanned (${pPct}%)`, 16, curY + 4, { align: 'center', width: 810 });

        curY += 20;
        curY = drawTableHeader(doc, curY, VENUE_COLS);

        info.teams.forEach((t, idx) => {
          const isPresent = Boolean(t.is_present);
          const statusStr = isPresent ? 'Scanned' : 'Not Scanned';
          const rowVals = {
            sl: String(idx + 1),
            team_code: t.team_code || '—',
            team_name: t.team_name || '—',
            project_title: t.project_title || '—',
            leader_name: t.leader_name || '—',
            members: t.members || '—',
            mentor_name: t.mentor_name || '—',
            mobile_no: t.mobile_no || '—',
            email: t.email || '—',
            college_name: t.college_name || '—',
            category: t.category || '—',
            status: statusStr,
            signature: ''
          };
          const rHeight = calculateRowHeight(doc, rowVals, VENUE_COLS);

          if (curY + rHeight > 550) {
            doc.addPage();
            doc.rect(16, 12, 810, 16).fillAndStroke('#DCFCE7', '#166534');
            doc.fontSize(8).fillColor('#14532D').font('Helvetica-Bold')
               .text(`PANEL ${pNo} — VENUE: ${(info.venue || 'TBD').toUpperCase()} (Contd.)`, 16, 16, { align: 'center', width: 810 });
            curY = 34;
            curY = drawTableHeader(doc, curY, VENUE_COLS);
          }
          curY = drawTableRow(doc, t, idx + 1, curY, idx % 2 === 1, VENUE_COLS, rHeight, rowVals);
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Builds Dynamic Theme-wise Attendance PDF
 */
function buildThemeAttendancePdf(rows) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 16 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const total = rows.length;
      const present = rows.filter(r => r.is_present).length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;

      // Group by theme
      const themesMap = new Map();
      rows.forEach(r => {
        const cat = r.category || 'General Track';
        if (!themesMap.has(cat)) {
          themesMap.set(cat, { theme: cat, venue: r.venue || 'TBD', teams: [] });
        }
        const th = themesMap.get(cat);
        if (r.venue && (!th.venue || th.venue === 'TBD')) th.venue = r.venue;
        th.teams.push(r);
      });

      // Cover / Header on first page (Matching Excel)
      if (fs.existsSync(LOGO_LEFT_PATH)) {
        doc.image(LOGO_LEFT_PATH, 16, 12, { width: 44 });
      }
      if (fs.existsSync(LOGO_RIGHT_PATH)) {
        doc.image(LOGO_RIGHT_PATH, 770, 12, { width: 56 });
      }

      doc.fontSize(15).fillColor('#14532D').font('Helvetica-Bold').text('R.M.K. GROUP OF INSTITUTIONS', 16, 14, { align: 'center', width: 810 });
      doc.fontSize(11).fillColor('#000000').font('Helvetica-Bold').text('JUNIOR HACKATHON 2026', 16, 32, { align: 'center', width: 810 });

      // Ribbon (matching Excel row 3)
      doc.rect(16, 48, 810, 18).fillAndStroke('#DCFCE7', '#000000');
      doc.fontSize(8.5).fillColor('#000000').font('Helvetica-Bold').text(
        `THEME-WISE ATTENDANCE ROSTER  •  ${total} Total Teams  •  ${present} Scanned (${pct}%)  •  ${themesMap.size} Themes`,
        16, 53, { align: 'center', width: 810 }
      );

      let isFirstTheme = true;
      let curY = 72;

      for (const [themeName, info] of themesMap) {
        if (info.teams.length === 0) continue;

        if (!isFirstTheme) {
          doc.addPage();
          curY = 16;
        }
        isFirstTheme = false;

        const tPres = info.teams.filter(t => t.is_present).length;
        const tPct = info.teams.length > 0 ? Math.round((tPres / info.teams.length) * 100) : 0;

        // Theme banner ribbon
        doc.rect(16, curY, 810, 16).fillAndStroke('#DCFCE7', '#166534');
        doc.fontSize(8.5).fillColor('#14532D').font('Helvetica-Bold')
           .text(`THEME: ${themeName.toUpperCase()} — VENUE: ${(info.venue || 'TBD').toUpperCase()}  •  ${info.teams.length} Teams  •  ${tPres} Scanned (${tPct}%)`, 16, curY + 4, { align: 'center', width: 810 });

        curY += 20;
        curY = drawTableHeader(doc, curY, THEME_COLS);

        info.teams.forEach((t, idx) => {
          const isPresent = Boolean(t.is_present);
          const statusStr = isPresent ? 'Scanned' : 'Not Scanned';
          const rowVals = {
            sl: String(idx + 1),
            team_code: t.team_code || '—',
            team_name: t.team_name || '—',
            project_title: t.project_title || '—',
            leader_name: t.leader_name || '—',
            members: t.members || '—',
            mentor_name: t.mentor_name || '—',
            mobile_no: t.mobile_no || '—',
            email: t.email || '—',
            college_name: t.college_name || '—',
            category: t.category || '—',
            panel_no: t.panel_no ? `Panel ${t.panel_no}` : '—',
            venue: t.venue || 'TBD',
            status: statusStr,
            signature: ''
          };
          const rHeight = calculateRowHeight(doc, rowVals, THEME_COLS);

          if (curY + rHeight > 550) {
            doc.addPage();
            doc.rect(16, 12, 810, 16).fillAndStroke('#DCFCE7', '#166534');
            doc.fontSize(8).fillColor('#14532D').font('Helvetica-Bold')
               .text(`THEME: ${themeName.toUpperCase()} (Contd.)`, 16, 16, { align: 'center', width: 810 });
            curY = 34;
            curY = drawTableHeader(doc, curY, THEME_COLS);
          }
          curY = drawTableRow(doc, t, idx + 1, curY, idx % 2 === 1, THEME_COLS, rHeight, rowVals);
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  buildMasterAttendancePdf,
  buildVenueAttendancePdf,
  buildThemeAttendancePdf
};
