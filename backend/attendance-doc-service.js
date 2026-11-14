const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageOrientation,
  AlignmentType,
  ShadingType,
  BorderStyle,
  VerticalAlign
} = require('docx');

function formatCheckInTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' }
};

const colWidths = [
  380,   // 0. Sl. No.
  850,   // 1. Team ID
  1000,  // 2. Team Name
  2400,  // 3. Idea / Project Title (More space)
  800,   // 4. Team Leader
  850,   // 5. Team Members
  450,   // 6. Mentor Name (Very much less)
  750,   // 7. Contact Mobile
  550,   // 8. Leader Email (Reduced)
  1700,  // 9. School Name (More space)
  1500,  // 10. Theme Track (More space)
  700,   // 11. Panel No. (More space)
  1950,  // 12. Allocated Venue (More space)
  700,   // 13. Attendance Status
  680,   // 14. Marked By / Mode
  920    // 15. Check-In Timestamp
];

function createHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: '059669', type: ShadingType.CLEAR },
    borders: cellBorders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 70, right: 70 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text, bold: true, color: 'FFFFFF', size: 16, font: 'Calibri' })
        ]
      })
    ]
  });
}

function createDataCell(text, width, isCenter = false, isStatus = false, isPresent = false, isEven = false) {
  let textColor = '0F172A';
  let isBold = false;
  if (isStatus) {
    isBold = true;
    textColor = isPresent ? '15803D' : 'B91C1C';
  }

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: isEven ? 'F8FAFC' : 'FFFFFF', type: ShadingType.CLEAR },
    borders: cellBorders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 70, right: 70 },
    children: [
      new Paragraph({
        alignment: isCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({ text: text || '—', bold: isBold, color: textColor, size: 16, font: 'Calibri' })
        ]
      })
    ]
  });
}

function createHeaderRow() {
  const headers = [
    'Sl. No.', 'Team ID', 'Team Name', 'Idea / Project Title', 'Team Leader',
    'Team Members', 'Mentor Name', 'Contact Mobile', 'Leader Email',
    'School Name', 'Theme Track', 'Panel No.', 'Allocated Venue',
    'Attendance Status', 'Marked By / Mode', 'Check-In Timestamp'
  ];

  return new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => createHeaderCell(h, colWidths[i]))
  });
}

function createTeamRow(r, index, isEven) {
  const isPresent = Boolean(r.is_present);
  const statusStr = isPresent ? 'Scanned' : 'Not Scanned';
  const timeStr = formatCheckInTime(r.check_in_time);
  const methodStr = formatMarkedBy(r);

  const cells = [
    createDataCell(String(index), colWidths[0], true, false, false, isEven),
    createDataCell(r.team_code || '—', colWidths[1], true, false, false, isEven),
    createDataCell(r.team_name || '—', colWidths[2], false, false, false, isEven),
    createDataCell(r.project_title || '—', colWidths[3], false, false, false, isEven),
    createDataCell(r.leader_name || '—', colWidths[4], false, false, false, isEven),
    createDataCell(r.members || '—', colWidths[5], false, false, false, isEven),
    createDataCell(r.mentor_name || '—', colWidths[6], false, false, false, isEven),
    createDataCell(r.mobile_no || '—', colWidths[7], true, false, false, isEven),
    createDataCell(r.email || '—', colWidths[8], false, false, false, isEven),
    createDataCell(r.college_name || '—', colWidths[9], false, false, false, isEven),
    createDataCell(r.category || '—', colWidths[10], false, false, false, isEven),
    createDataCell(r.panel_no ? `Panel ${r.panel_no}` : '—', colWidths[11], true, false, false, isEven),
    createDataCell(r.venue || '—', colWidths[12], false, false, false, isEven),
    createDataCell(statusStr, colWidths[13], true, true, isPresent, isEven),
    createDataCell(methodStr, colWidths[14], true, false, false, isEven),
    createDataCell(timeStr, colWidths[15], true, false, false, isEven)
  ];

  return new TableRow({ children: cells });
}

/**
 * Builds Dynamic Master Attendance Word Document (.docx)
 */
async function buildMasterAttendanceDocx(rows) {
  const total = rows.length;
  const present = rows.filter(r => r.is_present).length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const generatedTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

  const tableRows = [createHeaderRow()];
  rows.forEach((r, idx) => {
    tableRows.push(createTeamRow(r, idx + 1, idx % 2 === 1));
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 500, bottom: 500, left: 450, right: 450 }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'R.M.K. GROUP OF INSTITUTIONS', bold: true, size: 28, color: '166534', font: 'Calibri' })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({ text: 'JUNIOR HACKATHON 2026 — MASTER ATTENDANCE ROSTER', bold: true, size: 22, color: '0F172A', font: 'Calibri' })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new TextRun({ text: `Total Teams: ${total}   |   Scanned (Present): ${present}   |   Absent: ${total - present}   |   Attendance: ${pct}%   |   Generated: ${generatedTime} IST`, bold: true, size: 18, color: '0369A1', font: 'Calibri' })
          ]
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

/**
 * Builds Dynamic Venue-wise Attendance Word Document (.docx)
 */
async function buildVenueAttendanceDocx(rows) {
  const total = rows.length;
  const present = rows.filter(r => r.is_present).length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const generatedTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

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

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'R.M.K. GROUP OF INSTITUTIONS', bold: true, size: 28, color: '166534', font: 'Calibri' })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'JUNIOR HACKATHON 2026 — VENUE & PANEL ATTENDANCE REPORT', bold: true, size: 22, color: '0F172A', font: 'Calibri' })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({ text: `Total Teams: ${total}   |   Scanned: ${present} (${pct}%)   |   15 Evaluation Panels   |   Generated: ${generatedTime} IST`, bold: true, size: 18, color: '0369A1', font: 'Calibri' })
      ]
    })
  ];

  for (const [pNo, info] of panelsMap) {
    if (info.teams.length === 0) continue;
    const pPres = info.teams.filter(t => t.is_present).length;
    const pPct = info.teams.length > 0 ? Math.round((pPres / info.teams.length) * 100) : 0;

    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({ text: `PANEL ${pNo} — VENUE: ${(info.venue || 'TBD').toUpperCase()} (${info.teams.length} Teams, ${pPres} Scanned - ${pPct}%)`, bold: true, size: 20, color: '166534', font: 'Calibri' })
        ]
      })
    );

    const tRows = [createHeaderRow()];
    info.teams.forEach((t, idx) => {
      tRows.push(createTeamRow(t, idx + 1, idx % 2 === 1));
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tRows
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 500, bottom: 500, left: 450, right: 450 }
        }
      },
      children
    }]
  });

  return await Packer.toBuffer(doc);
}

/**
 * Builds Dynamic Theme-wise Attendance Word Document (.docx)
 */
async function buildThemeAttendanceDocx(rows) {
  const total = rows.length;
  const present = rows.filter(r => r.is_present).length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const generatedTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

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

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'R.M.K. GROUP OF INSTITUTIONS', bold: true, size: 28, color: '166534', font: 'Calibri' })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'JUNIOR HACKATHON 2026 — THEME-WISE ATTENDANCE REPORT', bold: true, size: 22, color: '0F172A', font: 'Calibri' })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({ text: `Total Teams: ${total}   |   Scanned: ${present} (${pct}%)   |   Themes: ${themesMap.size}   |   Generated: ${generatedTime} IST`, bold: true, size: 18, color: '0369A1', font: 'Calibri' })
      ]
    })
  ];

  for (const [themeName, info] of themesMap) {
    if (info.teams.length === 0) continue;
    const tPres = info.teams.filter(t => t.is_present).length;
    const tPct = info.teams.length > 0 ? Math.round((tPres / info.teams.length) * 100) : 0;

    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({ text: `THEME: ${themeName.toUpperCase()} — VENUE: ${(info.venue || 'TBD').toUpperCase()} (${info.teams.length} Teams, ${tPres} Scanned - ${tPct}%)`, bold: true, size: 20, color: '6B21A8', font: 'Calibri' })
        ]
      })
    );

    const tRows = [createHeaderRow()];
    info.teams.forEach((t, idx) => {
      tRows.push(createTeamRow(t, idx + 1, idx % 2 === 1));
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tRows
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 500, bottom: 500, left: 450, right: 450 }
        }
      },
      children
    }]
  });

  return await Packer.toBuffer(doc);
}

module.exports = {
  buildMasterAttendanceDocx,
  buildVenueAttendanceDocx,
  buildThemeAttendanceDocx
};
