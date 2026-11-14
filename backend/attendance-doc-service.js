const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  WidthType,
  PageOrientation,
  AlignmentType,
  ShadingType,
  BorderStyle,
  VerticalAlign
} = require('docx');
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

const noBorder = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE }
};

const blackBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
};

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' }
};

// 16 Canonical Columns matching Excel (excel-formatter.js) exactly
// Generous space allocated to Idea / Project Title and Venue; reduced for Mentor Name and Email
const colWidths = [
  380,   // 0. Sl. No.
  850,   // 1. Team ID
  1000,  // 2. Team Name
  2500,  // 3. Idea / Project Title (High priority: more space)
  850,   // 4. Team Leader
  900,   // 5. Team Members
  450,   // 6. Mentor Name (Very much less)
  750,   // 7. Contact Mobile
  550,   // 8. Leader Email (Reduced)
  1650,  // 9. School Name (More space)
  1450,  // 10. Theme Track (More space)
  720,   // 11. Panel No. (More space)
  1950,  // 12. Allocated Venue (High priority: more space)
  750,   // 13. Attendance Status
  700,   // 14. Marked By / Mode
  900    // 15. Check-In Timestamp
];

function createHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: '166534', type: ShadingType.CLEAR }, // Deep Emerald Green matching Excel #166534
    borders: blackBorder,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text, bold: true, color: 'FFFFFF', size: 15, font: 'Calibri' })
        ]
      })
    ]
  });
}

function createDataCell(text, width, isCenter = false, isStatus = false, isPresent = false, isEven = false, isBold = false) {
  let cellShading = isEven ? 'F0FDF4' : 'FFFFFF'; // Soft Mint Tint (#F0FDF4) & Pure White (#FFFFFF) matching Excel
  let textColor = '000000';
  let fontBold = isBold;

  if (isStatus) {
    if (isPresent) {
      cellShading = '22C55E'; // Green Status Pill matching Excel #22C55E
      textColor = 'FFFFFF';
      fontBold = true;
    } else {
      cellShading = 'F1F5F9'; // Neutral Pending Pill matching Excel #F1F5F9
      textColor = '000000';
      fontBold = false;
    }
  }

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: cellShading, type: ShadingType.CLEAR },
    borders: cellBorders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 50, right: 50 },
    children: [
      new Paragraph({
        alignment: isCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({ text: text || '—', bold: fontBold, color: textColor, size: 14, font: 'Calibri' })
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
    createDataCell(r.team_code || '—', colWidths[1], true, false, false, isEven, true), // Team ID bold
    createDataCell(r.team_name || '—', colWidths[2], false, false, false, isEven),
    createDataCell(r.project_title || '—', colWidths[3], false, false, false, isEven),
    createDataCell(r.leader_name || '—', colWidths[4], false, false, false, isEven),
    createDataCell(r.members || '—', colWidths[5], false, false, false, isEven),
    createDataCell(r.mentor_name || '—', colWidths[6], false, false, false, isEven),
    createDataCell(r.mobile_no || '—', colWidths[7], true, false, false, isEven),
    createDataCell(r.email || '—', colWidths[8], false, false, false, isEven),
    createDataCell(r.college_name || '—', colWidths[9], false, false, false, isEven),
    createDataCell(r.category || '—', colWidths[10], false, false, false, isEven),
    createDataCell(r.panel_no ? `Panel ${r.panel_no}` : '—', colWidths[11], true, false, false, isEven, true), // Panel bold
    createDataCell(r.venue || 'TBD', colWidths[12], false, false, false, isEven),
    createDataCell(statusStr, colWidths[13], true, true, isPresent, isEven),
    createDataCell(methodStr, colWidths[14], true, false, false, isEven, isPresent),
    createDataCell(timeStr, colWidths[15], true, false, false, isEven)
  ];

  return new TableRow({ children: cells });
}

/**
 * Builds the visual institutional header with logos and mint ribbon box identical to Excel
 */
function createInstitutionalHeader(ribbonText) {
  const leftLogoChildren = [];
  if (fs.existsSync(LOGO_LEFT_PATH)) {
    leftLogoChildren.push(
      new ImageRun({
        data: fs.readFileSync(LOGO_LEFT_PATH),
        transformation: { width: 110, height: 44 }
      })
    );
  }

  const rightLogoChildren = [];
  if (fs.existsSync(LOGO_RIGHT_PATH)) {
    rightLogoChildren.push(
      new ImageRun({
        data: fs.readFileSync(LOGO_RIGHT_PATH),
        transformation: { width: 130, height: 44 }
      })
    );
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: noBorder,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: leftLogoChildren
              })
            ]
          }),
          new TableCell({
            width: { size: 12300, type: WidthType.DXA },
            borders: noBorder,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({ text: 'R.M.K. GROUP OF INSTITUTIONS', bold: true, size: 30, color: '14532D', font: 'Calibri' })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'JUNIOR HACKATHON 2026', bold: true, size: 24, color: '000000', font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: noBorder,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: rightLogoChildren
              })
            ]
          })
        ]
      })
    ]
  });

  const ribbonTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: blackBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'DCFCE7', type: ShadingType.CLEAR }, // Light Mint Green ribbon matching Excel #DCFCE7
            borders: blackBorder,
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: ribbonText,
                    bold: true,
                    size: 19,
                    color: '000000',
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  return [
    headerTable,
    new Paragraph({ spacing: { after: 80 } }),
    ribbonTable,
    new Paragraph({ spacing: { after: 100 } })
  ];
}

/**
 * Builds Dynamic Master Attendance Word Document (.docx)
 */
async function buildMasterAttendanceDocx(rows) {
  const total = rows.length;
  const present = rows.filter(r => r.is_present).length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const ribbonText = `MASTER PRESENCE & REGISTRATION ROSTER  •  ${total} Total Teams  •  ${present} Scanned (${pct}%)  •  15 Evaluation Panels`;

  const tableRows = [createHeaderRow()];
  rows.forEach((r, idx) => {
    tableRows.push(createTeamRow(r, idx + 1, idx % 2 === 1));
  });

  const mainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 400, bottom: 400, left: 450, right: 450 }
        }
      },
      children: [
        ...createInstitutionalHeader(ribbonText),
        mainTable
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
  const ribbonText = `15-PANEL VENUE & EVALUATION ROSTER  •  ${total} Total Teams  •  ${present} Scanned (${pct}%)  •  15 Evaluation Panels`;

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

  const children = [...createInstitutionalHeader(ribbonText)];

  for (const [pNo, info] of panelsMap) {
    if (info.teams.length === 0) continue;
    const pPres = info.teams.filter(t => t.is_present).length;
    const pPct = info.teams.length > 0 ? Math.round((pPres / info.teams.length) * 100) : 0;

    const panelRibbon = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: blackBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { fill: 'DCFCE7', type: ShadingType.CLEAR },
              borders: blackBorder,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `PANEL ${pNo} — VENUE: ${(info.venue || 'TBD').toUpperCase()}  •  ${info.teams.length} Teams  •  ${pPres} Scanned (${pPct}%)`,
                      bold: true,
                      size: 18,
                      color: '14532D',
                      font: 'Calibri'
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });

    children.push(panelRibbon);
    children.push(new Paragraph({ spacing: { after: 60 } }));

    const tRows = [createHeaderRow()];
    info.teams.forEach((t, idx) => {
      tRows.push(createTeamRow(t, idx + 1, idx % 2 === 1));
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tRows
    }));

    children.push(new Paragraph({ spacing: { after: 140 } }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 400, bottom: 400, left: 450, right: 450 }
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

  const ribbonText = `THEME-WISE ATTENDANCE ROSTER  •  ${total} Total Teams  •  ${present} Scanned (${pct}%)  •  ${themesMap.size} Themes`;
  const children = [...createInstitutionalHeader(ribbonText)];

  for (const [themeName, info] of themesMap) {
    if (info.teams.length === 0) continue;
    const tPres = info.teams.filter(t => t.is_present).length;
    const tPct = info.teams.length > 0 ? Math.round((tPres / info.teams.length) * 100) : 0;

    const themeRibbon = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: blackBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { fill: 'DCFCE7', type: ShadingType.CLEAR },
              borders: blackBorder,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `THEME: ${themeName.toUpperCase()} — VENUE: ${(info.venue || 'TBD').toUpperCase()}  •  ${info.teams.length} Teams  •  ${tPres} Scanned (${tPct}%)`,
                      bold: true,
                      size: 18,
                      color: '14532D',
                      font: 'Calibri'
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });

    children.push(themeRibbon);
    children.push(new Paragraph({ spacing: { after: 60 } }));

    const tRows = [createHeaderRow()];
    info.teams.forEach((t, idx) => {
      tRows.push(createTeamRow(t, idx + 1, idx % 2 === 1));
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tRows
    }));

    children.push(new Paragraph({ spacing: { after: 140 } }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 400, bottom: 400, left: 450, right: 450 }
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
