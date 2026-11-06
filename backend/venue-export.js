const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_THEME_VENUES = {
  'Renewable/Sustainable Energy': 'CO WORK SPACE (RJ BLOCK)',
  'Agriculture': 'SV BLOCK SEMINAR HALL 3',
  'Healthcare': 'RJ BLOCK SECOND FLOOR SEMINAR HALL',
  'Education': 'SV BLOCK SEMINAR HALL 1',
  'Robotics': 'NEW BLOCK SEMINAR HALL',
  'Smart Automation': 'RJ BLOCK FIRST FLOOR SEMINAR HALL',
  'Smart Vehicles': 'RJ BLOCK SECOND FLOOR SEMINAR HALL',
  'Traditional Games of Indian Ethos': 'IDEA LAB / AR&VR LAB (RJ BLOCK)',
  'Virtual Reality Experience': 'IDEA LAB / AR&VR LAB (RJ BLOCK)',
  'Clean and Green Environment': 'SV BLOCK SEMINAR HALL 2',
  'Indian Heritage and Digital Creativity': 'CORPORATE CENTRE (RJ BLOCK)',
  'AI for Disater Management': 'NEW BLOCK SEMINAR HALL'
};

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

function getSafeSheetName(theme, index) {
  if (SHEET_NAME_MAP[theme]) return SHEET_NAME_MAP[theme];
  let safe = String(theme || `Theme_${index}`).replace(/[\\/?*:[\]]/g, ' ').trim();
  if (safe.length > 28) safe = safe.slice(0, 28).trim();
  return safe || `Theme_${index}`;
}

async function generateVenueExcel(pool, outputPath) {
  const [rows] = await pool.execute(
    `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.college_name, t.project_title, t.category, v.venue
     FROM teams t LEFT JOIN theme_venues v ON v.theme = t.category
     ORDER BY t.category, t.team_code`
  );

  const groups = new Map();
  for (const r of rows) {
    const theme = r.category || 'Unassigned';
    const venue = r.venue || DEFAULT_THEME_VENUES[theme] || 'TBD';
    if (!groups.has(theme)) {
      groups.set(theme, { theme, venue, teams: [] });
    }
    groups.get(theme).teams.push(r);
  }

  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryData = [];
  let sl = 1;
  let totalTeams = 0;
  for (const [theme, info] of groups) {
    totalTeams += info.teams.length;
    summaryData.push({
      'Sl. No.': sl++,
      'Theme': theme,
      'Venue': info.venue,
      'Number of Teams': info.teams.length,
      'Lab Coordinator Signature': ''
    });
  }
  summaryData.push({
    'Sl. No.': '',
    'Theme': 'TOTAL',
    'Venue': '',
    'Number of Teams': totalTeams,
    'Lab Coordinator Signature': ''
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 8 },
    { wch: 38 },
    { wch: 40 },
    { wch: 18 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Individual Theme Sheets
  let themeIdx = 1;
  for (const [theme, info] of groups) {
    const sheetName = getSafeSheetName(theme, themeIdx++);
    const themeData = info.teams.map((t, idx) => ({
      'Sl. No.': idx + 1,
      'Junior Hackathon ID': t.team_code || '',
      'Team Leader Name': t.leader_name || '',
      'Team Name': t.team_name || '',
      'Title': t.project_title || '',
      'School Name': t.college_name || ''
    }));

    const wsTheme = XLSX.utils.json_to_sheet(themeData);
    wsTheme['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 25 },
      { wch: 25 },
      { wch: 45 },
      { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTheme, sheetName);
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  XLSX.writeFile(wb, outputPath);
  return outputPath;
}

function findVenueDocx() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'),
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'),
    'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/.user_uploaded/media_1793970474220_c155a53f.docx'
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.size > 0) return p;
      } catch {}
    }
  }
  return null;
}

function findVenueExcel() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx'),
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.size > 0) return p;
      } catch {}
    }
  }
  return null;
}

function findVenuePdf() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf'),
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.size > 0) return p;
      } catch {}
    }
  }
  return null;
}

module.exports = {
  DEFAULT_THEME_VENUES,
  generateVenueExcel,
  findVenueDocx,
  findVenueExcel,
  findVenuePdf
};
