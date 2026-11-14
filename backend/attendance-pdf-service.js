const PDFDocument = require('pdfkit');

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
  return 'Admin Manual';
}

const COLS = [
  { key: 'sl', label: 'Sl. No.', width: 16, align: 'center' },
  { key: 'team_code', label: 'Team ID', width: 46, align: 'center' },
  { key: 'team_name', label: 'Team Name', width: 50, align: 'left' },
  { key: 'project_title', label: 'Idea / Project Title', width: 124, align: 'left' },
  { key: 'leader_name', label: 'Team Leader', width: 42, align: 'left' },
  { key: 'members', label: 'Team Members', width: 44, align: 'left' },
  { key: 'mentor_name', label: 'Mentor Name', width: 26, align: 'left' },
  { key: 'mobile_no', label: 'Contact Mobile', width: 40, align: 'center' },
  { key: 'email', label: 'Leader Email', width: 32, align: 'left' },
  { key: 'college_name', label: 'School Name', width: 82, align: 'left' },
  { key: 'category', label: 'Theme Track', width: 76, align: 'left' },
  { key: 'panel_no', label: 'Panel No.', width: 34, align: 'center' },
  { key: 'venue', label: 'Allocated Venue', width: 94, align: 'left' },
  { key: 'status', label: 'Attendance Status', width: 34, align: 'center' },
  { key: 'marked_by', label: 'Marked By / Mode', width: 30, align: 'center' },
  { key: 'check_in_time', label: 'Check-In Timestamp', width: 40, align: 'center' }
];

function drawTableHeader(doc, startY) {
  const startX = 16;
  let curX = startX;
  const hHeight = 18;

  // Background rect
  const totalW = COLS.reduce((sum, c) => sum + c.width, 0);
  doc.rect(startX, startY, totalW, hHeight).fill('#059669');

  doc.fillColor('#FFFFFF').fontSize(6.2).font('Helvetica-Bold');
  COLS.forEach(c => {
    doc.text(c.label, curX + 2, startY + 5, {
      width: c.width - 4,
      align: c.align,
      lineBreak: false,
      ellipsis: true
    });
    curX += c.width;
  });

  return startY + hHeight;
}

function drawTableRow(doc, row, slNo, startY, isEven) {
  const startX = 16;
  let curX = startX;
  const rHeight = 16;
  const totalW = COLS.reduce((sum, c) => sum + c.width, 0);

  // Background
  const bg = isEven ? '#F8FAFC' : '#FFFFFF';
  doc.rect(startX, startY, totalW, rHeight).fill(bg);

  // Border lines (bottom)
  doc.strokeColor('#E2E8F0').lineWidth(0.5);
  doc.moveTo(startX, startY + rHeight).lineTo(startX + totalW, startY + rHeight).stroke();

  const isPresent = Boolean(row.is_present);
  const statusStr = isPresent ? 'Scanned' : 'Absent';
  const methodStr = formatMarkedBy(row);
  const timeStr = formatCheckInTime(row.check_in_time);

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
    venue: row.venue || '—',
    status: statusStr,
    marked_by: methodStr,
    check_in_time: timeStr
  };

  COLS.forEach(c => {
    const val = rowValues[c.key] || '—';
    if (c.key === 'status') {
      doc.font('Helvetica-Bold').fontSize(6.0);
      doc.fillColor(isPresent ? '#15803D' : '#64748B');
    } else if (c.key === 'team_code') {
      doc.font('Helvetica-Bold').fontSize(6.0).fillColor('#0F172A');
    } else {
      doc.font('Helvetica').fontSize(6.0).fillColor('#1E293B');
    }

    doc.text(val, curX + 2, startY + 4, {
      width: c.width - 4,
      align: c.align,
      lineBreak: false,
      ellipsis: true
    });
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
      const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

      // Header on Page 1
      doc.fontSize(13).fillColor('#166534').font('Helvetica-Bold').text('R.M.K. GROUP OF INSTITUTIONS', { align: 'center' });
      doc.fontSize(10).fillColor('#0F172A').font('Helvetica-Bold').text('JUNIOR HACKATHON 2026 — MASTER ATTENDANCE ROSTER', { align: 'center' });
      doc.fontSize(7.5).fillColor('#0369A1').font('Helvetica').text(`Total Teams: ${total}   |   Scanned (Present): ${present}   |   Absent: ${total - present}   |   Attendance: ${pct}%   |   Generated: ${genTime} IST`, { align: 'center' });
      doc.moveDown(0.5);

      let curY = doc.y;
      curY = drawTableHeader(doc, curY);

      rows.forEach((r, idx) => {
        // If approaching page bottom
        if (curY > 550) {
          doc.addPage();
          doc.fontSize(8).fillColor('#166534').font('Helvetica-Bold').text('R.M.K. JUNIOR HACKATHON 2026 — MASTER ATTENDANCE ROSTER (Contd.)', { align: 'center' });
          doc.moveDown(0.3);
          curY = doc.y;
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
      const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

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

      // Cover / Header on first page
      doc.fontSize(13).fillColor('#166534').font('Helvetica-Bold').text('R.M.K. GROUP OF INSTITUTIONS', { align: 'center' });
      doc.fontSize(10).fillColor('#0F172A').font('Helvetica-Bold').text('JUNIOR HACKATHON 2026 — 15-PANEL VENUE ATTENDANCE REPORT', { align: 'center' });
      doc.fontSize(7.5).fillColor('#0369A1').font('Helvetica').text(`Total Teams: ${total}   |   Scanned: ${present} (${pct}%)   |   15 Evaluation Panels   |   Generated: ${genTime} IST`, { align: 'center' });
      doc.moveDown(0.5);

      let isFirstPanel = true;
      for (const [pNo, info] of panelsMap) {
        if (info.teams.length === 0) continue;

        if (!isFirstPanel) {
          doc.addPage();
        }
        isFirstPanel = false;

        const pPres = info.teams.filter(t => t.is_present).length;
        const pPct = info.teams.length > 0 ? Math.round((pPres / info.teams.length) * 100) : 0;

        doc.fontSize(9.5).fillColor('#166534').font('Helvetica-Bold')
           .text(`PANEL ${pNo} — VENUE: ${(info.venue || 'TBD').toUpperCase()} (${info.teams.length} Teams, ${pPres} Scanned - ${pPct}%)`);
        doc.moveDown(0.2);

        let curY = doc.y;
        curY = drawTableHeader(doc, curY);

        info.teams.forEach((t, idx) => {
          if (curY > 550) {
            doc.addPage();
            doc.fontSize(8).fillColor('#166534').font('Helvetica-Bold')
               .text(`PANEL ${pNo} — VENUE: ${(info.venue || 'TBD').toUpperCase()} (Contd.)`);
            doc.moveDown(0.2);
            curY = doc.y;
            curY = drawTableHeader(doc, curY);
          }
          curY = drawTableRow(doc, t, idx + 1, curY, idx % 2 === 1);
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
      const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

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

      doc.fontSize(13).fillColor('#166534').font('Helvetica-Bold').text('R.M.K. GROUP OF INSTITUTIONS', { align: 'center' });
      doc.fontSize(10).fillColor('#0F172A').font('Helvetica-Bold').text('JUNIOR HACKATHON 2026 — THEME-WISE ATTENDANCE REPORT', { align: 'center' });
      doc.fontSize(7.5).fillColor('#0369A1').font('Helvetica').text(`Total Teams: ${total}   |   Scanned: ${present} (${pct}%)   |   Themes: ${themesMap.size}   |   Generated: ${genTime} IST`, { align: 'center' });
      doc.moveDown(0.5);

      let isFirstTheme = true;
      for (const [themeName, info] of themesMap) {
        if (info.teams.length === 0) continue;

        if (!isFirstTheme) {
          doc.addPage();
        }
        isFirstTheme = false;

        const tPres = info.teams.filter(t => t.is_present).length;
        const tPct = info.teams.length > 0 ? Math.round((tPres / info.teams.length) * 100) : 0;

        doc.fontSize(9.5).fillColor('#6B21A8').font('Helvetica-Bold')
           .text(`THEME: ${themeName.toUpperCase()} — VENUE: ${(info.venue || 'TBD').toUpperCase()} (${info.teams.length} Teams, ${tPres} Scanned - ${tPct}%)`);
        doc.moveDown(0.2);

        let curY = doc.y;
        curY = drawTableHeader(doc, curY);

        info.teams.forEach((t, idx) => {
          if (curY > 550) {
            doc.addPage();
            doc.fontSize(8).fillColor('#6B21A8').font('Helvetica-Bold')
               .text(`THEME: ${themeName.toUpperCase()} (Contd.)`);
            doc.moveDown(0.2);
            curY = doc.y;
            curY = drawTableHeader(doc, curY);
          }
          curY = drawTableRow(doc, t, idx + 1, curY, idx % 2 === 1);
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
