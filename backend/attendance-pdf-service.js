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
 * Strict single-line text fitter that guarantees zero multi-line wrapping and zero page overflow in PDFKit.
 * Replaces newlines/tabs with spaces and truncates with ellipsis if width exceeds maxWidth.
 */
function fitText(doc, str, maxWidth) {
  if (str === null || str === undefined) return '—';
  let s = String(str).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s === '—') return '—';
  if (doc.widthOfString(s) <= maxWidth) return s;
  while (s.length > 1 && doc.widthOfString(s + '…') > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

// Master Attendance (15 Canonical Columns matching Excel)
// Sum: 18+46+50+120+46+48+26+40+32+88+76+36+94+46+44 = 810 pt (Exact printable width on A4 landscape)
const MASTER_COLS = [
  { key: 'sl', label: 'Sl. No.', width: 18, align: 'center' },
  { key: 'team_code', label: 'Team ID', width: 46, align: 'center' },
  { key: 'team_name', label: 'Team Name', width: 50, align: 'left' },
  { key: 'project_title', label: 'Idea / Project Title', width: 120, align: 'left' },
  { key: 'leader_name', label: 'Team Leader', width: 46, align: 'left' },
  { key: 'members', label: 'Team Members', width: 48, align: 'left' },
  { key: 'mentor_name', label: 'Mentor Name', width: 26, align: 'left' },
  { key: 'mobile_no', label: 'Contact Mobile', width: 40, align: 'center' },
  { key: 'email', label: 'Leader Email', width: 32, align: 'left' },
  { key: 'college_name', label: 'School Name', width: 88, align: 'left' },
  { key: 'category', label: 'Theme Track', width: 76, align: 'left' },
  { key: 'panel_no', label: 'Panel No.', width: 36, align: 'center' },
  { key: 'venue', label: 'Allocated Venue', width: 94, align: 'left' },
  { key: 'status', label: 'Attendance Status', width: 46, align: 'center' },
  { key: 'signature', label: 'Signature', width: 44, align: 'center' }
];

// Venue-Wise Attendance (13 Columns - NO Venue column, has Theme Track and Signature)
// Sum: 20+48+56+160+50+54+28+44+38+110+90+52+60 = 810 pt
const VENUE_COLS = [
  { key: 'sl', label: 'Sl. No.', width: 20, align: 'center' },
  { key: 'team_code', label: 'Team ID', width: 48, align: 'center' },
  { key: 'team_name', label: 'Team Name', width: 56, align: 'left' },
  { key: 'project_title', label: 'Idea / Project Title', width: 160, align: 'left' },
  { key: 'leader_name', label: 'Team Leader', width: 50, align: 'left' },
  { key: 'members', label: 'Team Members', width: 54, align: 'left' },
  { key: 'mentor_name', label: 'Mentor Name', width: 28, align: 'left' },
  { key: 'mobile_no', label: 'Contact Mobile', width: 44, align: 'center' },
  { key: 'email', label: 'Leader Email', width: 38, align: 'left' },
  { key: 'college_name', label: 'School Name', width: 110, align: 'left' },
  { key: 'category', label: 'Theme Track', width: 90, align: 'left' },
  { key: 'status', label: 'Attendance Status', width: 52, align: 'center' },
  { key: 'signature', label: 'Signature', width: 60, align: 'center' }
];

// Theme-Wise Attendance (15 Columns - HAS Theme Track, Panel, Venue, Status, Signature)
const THEME_COLS = MASTER_COLS;

function drawTableHeader(doc, startY, cols = MASTER_COLS) {
  const startX = 16;
  const hHeight = 18;
  const totalW = cols.reduce((sum, c) => sum + c.width, 0);

  // Background rect (Deep Emerald Green #166534 matching Excel)
  doc.rect(startX, startY, totalW, hHeight).fill('#166534');

  // Outer border
  doc.strokeColor('#000000').lineWidth(0.5);
  doc.rect(startX, startY, totalW, hHeight).stroke();

  let curX = startX;
  doc.fillColor('#FFFFFF').fontSize(5.8).font('Helvetica-Bold');
  cols.forEach((c, idx) => {
    if (idx > 0) {
      doc.strokeColor('#14532D').lineWidth(0.5);
      doc.moveTo(curX, startY).lineTo(curX, startY + hHeight).stroke();
    }
    const safeLabel = fitText(doc, c.label, c.width - 2);
    doc.fillColor('#FFFFFF').text(safeLabel, curX + 1, startY + 5, {
      width: c.width - 2,
      height: 10,
      align: c.align,
      lineBreak: false
    });
    curX += c.width;
  });

  return startY + hHeight;
}

function drawTableRow(doc, row, slNo, startY, isEven, cols = MASTER_COLS) {
  const startX = 16;
  const rHeight = 16;
  const totalW = cols.reduce((sum, c) => sum + c.width, 0);

  // Background: alternating pure white (#FFFFFF) and soft mint tint (#F0FDF4) matching Excel
  const bg = isEven ? '#F0FDF4' : '#FFFFFF';
  doc.rect(startX, startY, totalW, rHeight).fill(bg);

  // Bottom border line
  doc.strokeColor('#D1D5DB').lineWidth(0.4);
  doc.moveTo(startX, startY + rHeight).lineTo(startX + totalW, startY + rHeight).stroke();

  const isPresent = Boolean(row.is_present);
  const statusStr = isPresent ? 'Scanned' : 'Not Scanned';

  const rowValues = {
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

  let curX = startX;
  cols.forEach((c, idx) => {
    // Vertical divider line
    if (idx > 0) {
      doc.strokeColor('#E2E8F0').lineWidth(0.3);
      doc.moveTo(curX, startY).lineTo(curX, startY + rHeight).stroke();
    }

    const val = rowValues[c.key] || '—';

    if (c.key === 'signature') {
      // Signature column: empty space for physical signature
    } else if (c.key === 'status') {
      // Draw status badge pill matching Excel
      const pillW = c.width - 6;
      const pillH = 11;
      const pillX = curX + 3;
      const pillY = startY + 2.5;

      if (isPresent) {
        doc.roundedRect(pillX, pillY, pillW, pillH, 2).fill('#22C55E');
        doc.font('Helvetica-Bold').fontSize(5.4).fillColor('#FFFFFF');
        doc.text('Scanned', curX + 1, startY + 4.5, {
          width: c.width - 2,
          height: 10,
          align: 'center',
          lineBreak: false
        });
      } else {
        doc.roundedRect(pillX, pillY, pillW, pillH, 2).fill('#F1F5F9');
        doc.strokeColor('#CBD5E1').lineWidth(0.3).roundedRect(pillX, pillY, pillW, pillH, 2).stroke();
        doc.font('Helvetica').fontSize(5.2).fillColor('#000000');
        doc.text('Not Scanned', curX + 1, startY + 4.5, {
          width: c.width - 2,
          height: 10,
          align: 'center',
          lineBreak: false
        });
      }
    } else {
      let fontName = 'Helvetica';
      let fontSize = 5.5;
      let fontColor = '#000000';

      if (c.key === 'team_code' || c.key === 'panel_no') {
        fontName = 'Helvetica-Bold';
        fontSize = 5.6;
      }

      doc.font(fontName).fontSize(fontSize).fillColor(fontColor);
      const safeText = fitText(doc, val, c.width - 3);

      doc.text(safeText, curX + 1.5, startY + 4.5, {
        width: c.width - 3,
        height: 10,
        align: c.align,
        lineBreak: false
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
        // If next row would exceed page boundary (550 pt)
        if (curY + 16 > 550) {
          doc.addPage();
          doc.rect(16, 12, 810, 16).fillAndStroke('#DCFCE7', '#000000');
          doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold').text(
            'R.M.K. JUNIOR HACKATHON 2026 — MASTER ATTENDANCE ROSTER (Contd.)',
            16, 16, { align: 'center', width: 810 }
          );
          curY = 34;
          curY = drawTableHeader(doc, curY);
        }
        curY = drawTableRow(doc, r, idx + 1, curY, idx % 2 === 1);
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
          if (curY + 16 > 550) {
            doc.addPage();
            doc.rect(16, 12, 810, 16).fillAndStroke('#DCFCE7', '#166534');
            doc.fontSize(8).fillColor('#14532D').font('Helvetica-Bold')
               .text(`PANEL ${pNo} — VENUE: ${(info.venue || 'TBD').toUpperCase()} (Contd.)`, 16, 16, { align: 'center', width: 810 });
            curY = 34;
            curY = drawTableHeader(doc, curY, VENUE_COLS);
          }
          curY = drawTableRow(doc, t, idx + 1, curY, idx % 2 === 1, VENUE_COLS);
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
          if (curY + 16 > 550) {
            doc.addPage();
            doc.rect(16, 12, 810, 16).fillAndStroke('#DCFCE7', '#166534');
            doc.fontSize(8).fillColor('#14532D').font('Helvetica-Bold')
               .text(`THEME: ${themeName.toUpperCase()} (Contd.)`, 16, 16, { align: 'center', width: 810 });
            curY = 34;
            curY = drawTableHeader(doc, curY, THEME_COLS);
          }
          curY = drawTableRow(doc, t, idx + 1, curY, idx % 2 === 1, THEME_COLS);
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
