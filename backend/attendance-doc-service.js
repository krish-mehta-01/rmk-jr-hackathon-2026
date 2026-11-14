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

// 15 Canonical Columns for Master & Theme reports matching Excel exactly
// Sum = 15,900 dxa (exact printable width on A4 landscape with 450 margin)
const masterHeaders = [
  'Sl. No.', 'Team ID', 'Team Name', 'Idea / Project Title', 'Team Leader',
  'Team Members', 'Mentor Name', 'Contact Mobile', 'Leader Email',
  'School Name', 'Theme Track', 'Panel No.', 'Allocated Venue',
  'Attendance Status', 'Signature'
];
const masterColWidths = [
  380,   // 0. Sl. No.
  850,   // 1. Team ID
  1050,  // 2. Team Name
  2600,  // 3. Idea / Project Title
  900,   // 4. Team Leader
  950,   // 5. Team Members
  450,   // 6. Mentor Name
  750,   // 7. Contact Mobile
  550,   // 8. Leader Email
  1750,  // 9. School Name
  1500,  // 10. Theme Track
  750,   // 11. Panel No.
  2000,  // 12. Allocated Venue
  750,   // 13. Attendance Status
  700    // 14. Signature
];

// 13 Canonical Columns for Venue-wise report (NO Venue column, has Theme Track and Signature)
// Sum = 15,900 dxa
const venueHeaders = [
  'Sl. No.', 'Team ID', 'Team Name', 'Idea / Project Title', 'Team Leader',
  'Team Members', 'Mentor Name', 'Contact Mobile', 'Leader Email',
  'School Name', 'Theme Track', 'Attendance Status', 'Signature'
];
const venueColWidths = [
  400,   // 0. Sl. No.
  900,   // 1. Team ID
  1200,  // 2. Team Name
  3200,  // 3. Idea / Project Title
  1000,  // 4. Team Leader
  1100,  // 5. Team Members
  500,   // 6. Mentor Name
  800,   // 7. Contact Mobile
  600,   // 8. Leader Email
  2100,  // 9. School Name
  1800,  // 10. Theme Track
  900,   // 11. Attendance Status
  1400   // 12. Signature
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

function createHeaderRow(type = 'master') {
  const headers = type === 'venue' ? venueHeaders : masterHeaders;
  const widths = type === 'venue' ? venueColWidths : masterColWidths;

  return new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => createHeaderCell(h, widths[i]))
  });
}

function createTeamRow(r, index, isEven, type = 'master') {
  const isPresent = Boolean(r.is_present);
  const statusStr = isPresent ? 'Scanned' : 'Not Scanned';

  if (type === 'venue') {
    const cells = [
      createDataCell(String(index), venueColWidths[0], true, false, false, isEven),
      createDataCell(r.team_code || '—', venueColWidths[1], true, false, false, isEven, true), // Team ID bold
      createDataCell(r.team_name || '—', venueColWidths[2], false, false, false, isEven),
      createDataCell(r.project_title || '—', venueColWidths[3], false, false, false, isEven),
      createDataCell(r.leader_name || '—', venueColWidths[4], false, false, false, isEven),
      createDataCell(r.members || '—', venueColWidths[5], false, false, false, isEven),
      createDataCell(r.mentor_name || '—', venueColWidths[6], false, false, false, isEven),
      createDataCell(r.mobile_no || '—', venueColWidths[7], true, false, false, isEven),
      createDataCell(r.email || '—', venueColWidths[8], false, false, false, isEven),
      createDataCell(r.college_name || '—', venueColWidths[9], false, false, false, isEven),
      createDataCell(r.category || '—', venueColWidths[10], false, false, false, isEven),
      createDataCell(statusStr, venueColWidths[11], true, true, isPresent, isEven),
      createDataCell('', venueColWidths[12], true, false, false, isEven) // Signature blank
    ];
    return new TableRow({ children: cells });
  }

  // Master / Theme (15 columns)
  const cells = [
    createDataCell(String(index), masterColWidths[0], true, false, false, isEven),
    createDataCell(r.team_code || '—', masterColWidths[1], true, false, false, isEven, true), // Team ID bold
    createDataCell(r.team_name || '—', masterColWidths[2], false, false, false, isEven),
    createDataCell(r.project_title || '—', masterColWidths[3], false, false, false, isEven),
    createDataCell(r.leader_name || '—', masterColWidths[4], false, false, false, isEven),
    createDataCell(r.members || '—', masterColWidths[5], false, false, false, isEven),
    createDataCell(r.mentor_name || '—', masterColWidths[6], false, false, false, isEven),
    createDataCell(r.mobile_no || '—', masterColWidths[7], true, false, false, isEven),
    createDataCell(r.email || '—', masterColWidths[8], false, false, false, isEven),
    createDataCell(r.college_name || '—', masterColWidths[9], false, false, false, isEven),
    createDataCell(r.category || '—', masterColWidths[10], false, false, false, isEven),
    createDataCell(r.panel_no ? `Panel ${r.panel_no}` : '—', masterColWidths[11], true, false, false, isEven, true), // Panel bold
    createDataCell(r.venue || 'TBD', masterColWidths[12], false, false, false, isEven),
    createDataCell(statusStr, masterColWidths[13], true, true, isPresent, isEven),
    createDataCell('', masterColWidths[14], true, false, false, isEven) // Signature blank
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

  const tableRows = [createHeaderRow('master')];
  rows.forEach((r, idx) => {
    tableRows.push(createTeamRow(r, idx + 1, idx % 2 === 1, 'master'));
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

    const tRows = [createHeaderRow('venue')];
    info.teams.forEach((t, idx) => {
      tRows.push(createTeamRow(t, idx + 1, idx % 2 === 1, 'venue'));
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

    const tRows = [createHeaderRow('theme')];
    info.teams.forEach((t, idx) => {
      tRows.push(createTeamRow(t, idx + 1, idx % 2 === 1, 'theme'));
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
