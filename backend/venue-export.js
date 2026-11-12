const fs = require('fs');
const path = require('path');

const DEFAULT_THEME_VENUES = {
  'Renewable/Sustainable Energy': 'Idea Lab I (RJ Block)',
  'Agriculture': 'Second Floor Seminar Hall-A (RJ Block)',
  'Healthcare': 'Co-Work Space (RJ Block)',
  'Education': 'VR Block Ground Floor - A',
  'Robotics': 'Seminar Hall 3 (SV Block)',
  'Smart Automation': 'First Floor Seminar Hall-A (RJ Block)',
  'Smart Vehicles': 'Idea Lab II (RJ Block)',
  'Traditional Games of Indian Ethos': 'VR Block Ground Floor - B',
  'Virtual Reality Experience': 'VR Block First Floor - A',
  'Clean and Green Environment': 'VR Block First Floor - B',
  'Indian Heritage and Digital Creativity': 'VR Block Ground Floor - B',
  'AI for Disater Management': 'Seminar Hall 1 (SV Block)'
};

async function generateVenueExcel(pool, outputPath) {
  const [rows] = await pool.execute(
    `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.college_name, t.project_title, t.category, t.members, t.mentor_name, t.is_present, t.check_in_time, t.marked_by, t.qr_verification_token, t.panel_no, t.venue
     FROM teams t
     ORDER BY t.panel_no ASC, t.category ASC, t.team_code ASC`
  );

  const panels = new Map();
  for (let p = 1; p <= 15; p++) {
    panels.set(p, { panel_no: p, venue: '', themes: new Set(), teams: [] });
  }

  for (const r of rows) {
    const p = r.panel_no || 1;
    if (!panels.has(p)) {
      panels.set(p, { panel_no: p, venue: r.venue || 'TBD', themes: new Set(), teams: [] });
    }
    const pan = panels.get(p);
    if (r.venue) pan.venue = r.venue;
    if (r.category) pan.themes.add(r.category);
    pan.teams.push(r);
  }

  const { buildVenueWiseWorkbook } = require('./excel-formatter');
  const wb = await buildVenueWiseWorkbook(panels);

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
    'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'
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
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx'),
    'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx'
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
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf'),
    'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf'
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
