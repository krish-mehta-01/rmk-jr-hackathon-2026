const fs = require('fs');
const path = require('path');

async function generateThemeExcel(pool, outputPath, filterTheme = null) {
  let query = `
    SELECT t.team_code, t.team_name, t.leader_name, t.mobile_no, t.college_name, 
           t.project_title, t.category, t.members, t.mentor_name, t.is_present, 
           t.check_in_time, t.marked_by, t.qr_verification_token, t.panel_no, t.venue
    FROM teams t
  `;
  const params = [];
  if (filterTheme && filterTheme.trim() && filterTheme !== 'all') {
    query += ' WHERE t.category = ?';
    params.push(filterTheme.trim());
  }
  query += ' ORDER BY t.category ASC, t.panel_no ASC, t.team_code ASC';

  const [rows] = await pool.execute(query, params);

  const themesMap = new Map();
  for (const r of rows) {
    const cat = r.category || 'General';
    if (!themesMap.has(cat)) {
      themesMap.set(cat, { theme: cat, teams: [] });
    }
    themesMap.get(cat).teams.push(r);
  }

  const { buildThemeWiseWorkbook } = require('./excel-formatter');
  const wb = await buildThemeWiseWorkbook(themesMap);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await wb.xlsx.writeFile(outputPath);
  return outputPath;
}

function findThemeDocx() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.docx'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.docx'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.docx'),
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.docx'),
    'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/RMK_Junior_Hackathon_2026_Theme_Wise_Teams.docx'
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

function findThemeExcel() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.xlsx'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.xlsx'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.xlsx'),
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.xlsx'),
    'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/RMK_Junior_Hackathon_2026_Theme_Wise_Teams.xlsx'
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

function findThemePdf() {
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.pdf'),
    path.join(__dirname, '..', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.pdf'),
    path.join(__dirname, '..', 'scratch', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.pdf'),
    path.join(__dirname, '..', 'frontend', 'exports', 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.pdf'),
    'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/RMK_Junior_Hackathon_2026_Theme_Wise_Teams.pdf'
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
  generateThemeExcel,
  findThemeDocx,
  findThemeExcel,
  findThemePdf
};
