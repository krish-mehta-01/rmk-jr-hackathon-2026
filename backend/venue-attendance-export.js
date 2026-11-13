const fs = require('fs');
const path = require('path');
const { DEFAULT_THEME_VENUES } = require('./venue-export');
const { buildVenueWiseWorkbook } = require('./excel-formatter');

async function generateVenueAttendanceExcel(pool, outputPath) {
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

  const wb = await buildVenueWiseWorkbook(panels);

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await wb.xlsx.writeFile(outputPath);
  }
  return outputPath;
}

module.exports = {
  generateVenueAttendanceExcel
};

