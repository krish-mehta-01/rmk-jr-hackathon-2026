const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_THEME_VENUES = {
  'Renewable/Sustainable Energy': 'CO WORK SPACE (RJ Block)',
  'Agriculture': 'SEMINAR HALL 3 (SV Block)',
  'Healthcare': 'SECOND FLOOR SEMINAR HALL (RJ Block)',
  'Education': 'SEMINAR HALL 1 (SV Block)',
  'Robotics': 'SEMINAR HALL (New Block)',
  'Smart Automation': 'FIRST FLOOR SEMINAR HALL (RJ Block)',
  'Smart Vehicles': 'SECOND FLOOR SEMINAR HALL (RJ Block)',
  'Traditional Games of Indian Ethos': 'IDEA LAB / AR&VR LAB (RJ Block)',
  'Virtual Reality Experience': 'IDEA LAB / AR&VR LAB (RJ Block)',
  'Clean and Green Environment': 'SEMINAR HALL 2 (SV Block)',
  'Indian Heritage and Digital Creativity': 'CORPORATE CENTRE (RJ Block)',
  'AI for Disater Management': 'SEMINAR HALL (New Block)'
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
    `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.college_name, t.project_title, t.category, t.is_present, t.check_in_time, v.venue
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

  const { buildVenueWiseWorkbook } = require('./excel-formatter');
  const wb = await buildVenueWiseWorkbook(groups);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await wb.xlsx.writeFile(outputPath);
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
