const fs = require('fs');
const path = require('path');

const DEFAULT_THEME_VENUES = {
  'Renewable/Sustainable Energy': 'Idea Lab I (RJ Block)',
  'Agriculture': 'Second Floor Seminar Hall-A (RJ Block)',
  'Healthcare': 'Co-Work Space (RJ Block)',
  'Education': 'Ground Floor - A (VR Block)',
  'Robotics': 'Seminar Hall 3 (SV Block)',
  'Smart Automation': 'First Floor Seminar Hall-A (RJ Block)',
  'Smart Vehicles': 'Idea Lab II (RJ Block)',
  'Traditional Games of Indian Ethos': 'Ground Floor - B (VR Block)',
  'Virtual Reality Experience': 'First Floor - A (VR Block)',
  'Clean and Green Environment': 'First Floor - B (VR Block)',
  'Indian Heritage and Digital Creativity': 'Ground Floor - B (VR Block)',
  'AI for Disaster Management': 'Seminar Hall 1 (SV Block)',
  'AI for Disater Management': 'Seminar Hall 1 (SV Block)'
};

async function generateVenueExcel(pool, outputPath) {
  const [rows] = await pool.execute(
    `SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.email, t.college_name, t.project_title, t.category, t.members, t.mentor_name, t.is_present, t.check_in_time, t.marked_by, t.qr_verification_token, t.panel_no, COALESCE(t.venue, v.venue) AS venue
     FROM teams t
     LEFT JOIN theme_venues v ON v.theme = t.category
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
    const resolvedVenue = r.venue || DEFAULT_THEME_VENUES[r.category] || '';
    if (resolvedVenue && (!pan.venue || pan.venue === 'TBD')) {
      pan.venue = resolvedVenue;
    }
    if (r.category) pan.themes.add(r.category);
    r.venue = resolvedVenue || pan.venue || 'TBD';
    pan.teams.push(r);
  }

  const { buildVenueRosterWorkbook } = require('./excel-formatter');
  const wb = await buildVenueRosterWorkbook(panels);

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await wb.xlsx.writeFile(outputPath);
  }
  return outputPath;
}

function findVenueDocx() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx'),
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx')
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.size > 0) return p;
      }
    } catch {}
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
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.size > 0) return p;
      }
    } catch {}
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
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.size > 0) return p;
      }
    } catch {}
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
