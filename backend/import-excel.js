/**
 * RMK Jr. Hackathon 2026 — Excel importer
 * Loads the Google Forms responses sheet into TiDB. Teams are matched by their official TEAM ID,
 * so re-importing a newer sheet adds new teams and updates details without touching scan status.
 *
 * Usage:
 *   npm run import -- "C:\path\to\Junior Hackathon 2026 (Responses).xlsx"
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { pool, testConnection } = require('./db');

// Flexible column matcher with exclusions
function findKey(row, aliases, excludeWords = []) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isExcluded = excludeWords.some(ex => {
        const cleanEx = ex.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanK.includes(cleanEx);
      });
      if (isExcluded) continue;

      if (cleanK === cleanAlias || cleanK.includes(cleanAlias)) {
        return k;
      }
    }
  }
  return null;
}

// Clean mobile number to standard 10 digits
function cleanMobile(raw) {
  if (!raw) return '';
  let str = String(raw).trim().replace(/[^0-9]/g, '');
  if (str.startsWith('91') && str.length === 12) {
    str = str.slice(2);
  } else if (str.startsWith('0') && str.length === 11) {
    str = str.slice(1);
  } else if (str.length > 10) {
    str = str.slice(-10);
  }
  return str;
}

// "S. Janani" and "S Janani" count as the same leader
function sameName(a, b) {
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm(a) === norm(b);
}

// Build list of team members
function extractMembers(row, leaderName) {
  const members = [leaderName];
  for (let i = 2; i <= 6; i++) {
    const key = Object.keys(row).find(k => {
      const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      return clean.includes(`member${i}`) &&
             !clean.includes('id') &&
             !clean.includes('card') &&
             !clean.includes('contact') &&
             !clean.includes('phone') &&
             !clean.includes('email');
    });
    if (key && row[key]) {
      const val = String(row[key]).trim();
      if (val && !['nil', 'none', 'n/a', '-', 'no', 'null'].includes(val.toLowerCase())) {
        members.push(val);
      }
    }
  }

  if (members.length === 1) {
    const singleKey = findKey(row, ['members', 'team members', 'member names', 'participants'], ['card', 'id']);
    if (singleKey && row[singleKey]) {
      return String(row[singleKey]).trim();
    }
  }

  return members.join(', ');
}

async function importExcel(filePath) {
  console.log('====================================================');
  console.log('   RMK JR. HACKATHON 2026 — EXCEL TO TiDB IMPORTER');
  console.log('====================================================\n');

  // 1. Locate file (always explicit, so an outdated download is never picked up by accident)
  if (!filePath) {
    console.error('[ERROR] Give the Excel file: npm run import -- "C:\\path\\to\\responses.xlsx"');
    process.exit(1);
  }
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`[ERROR] File does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`[STEP 1] Reading Excel file: ${path.basename(resolvedPath)}`);
  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  console.log(`[INFO] Processing Sheet: "${sheetName}"`);

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (rows.length === 0) {
    console.error('[ERROR] The spreadsheet contains no data rows.');
    process.exit(1);
  }
  console.log(`[INFO] Found ${rows.length} rows in sheet.\n`);

  // 2. Connect and verify TiDB schema (db.js adds the team_code column if needed)
  console.log('[STEP 2] Connecting to database and verifying schema...');
  if (!(await testConnection())) {
    console.error('[ERROR] Could not connect to TiDB.');
    process.exit(1);
  }

  // 3. Map columns
  console.log('\n[STEP 3] Parsing and saving team records...');
  const firstRow = rows[0];

  const colTeamId = findKey(firstRow, ['team id', 'team_id', 'teamid']);
  if (!colTeamId) {
    console.error('[ERROR] No "TEAM ID" column found. Teams are matched by their official TEAM ID.');
    process.exit(1);
  }
  const colName = findKey(firstRow, ['team name', 'team_name', 'teamname', 'name of team'], ['card', 'team id']);
  const colLeader = findKey(firstRow, ['team leader name', 'leader name', 'leader_name', 'team leader', 'leader', 'student name'], ['card', 'id']);
  const colMobile = findKey(firstRow, ['team leader contact number', 'mobile', 'mobile no', 'mobile number', 'phone', 'contact number', 'phone no'], ['mentor', 'member']);
  const colEmail = findKey(firstRow, ['team leader email id', 'email address', 'email', 'email id', 'mail'], ['mentor', 'member']);
  const colSchool = findKey(firstRow, ['name of the school', 'school', 'school name', 'college', 'college name', 'institution'], ['card']);
  const colProject = findKey(firstRow, ['title of your project', 'project title', 'project name', 'topic', 'title']);
  const colCategory = findKey(firstRow, ['theme', 'category', 'domain', 'track']);
  const colMentor = findKey(firstRow, ['mentor name', 'mentor', 'faculty mentor', 'guide', 'teacher'], ['contact', 'email', 'mobile', 'phone']);
  const colMentorMobile = findKey(firstRow, ['mentor contact number', 'mentor mobile', 'mentor phone', 'mentor contact']);
  const colMentorEmail = findKey(firstRow, ['mentor email id', 'mentor email', 'mentor mail']);

  console.log('[INFO] Column Mapping Detected:');
  console.log(`  - Team ID:       ${colTeamId}`);
  console.log(`  - Team Name:     ${colName || '(Project title / Leader fallback)'}`);
  console.log(`  - Leader Name:   ${colLeader || '(Required)'}`);
  console.log(`  - Mobile No:     ${colMobile || '(Required)'}`);
  console.log(`  - School Name:   ${colSchool || '(Optional)'}`);
  console.log(`  - Project Title: ${colProject || '(Optional)'}`);
  console.log(`  - Mentor Name:   ${colMentor || '(Optional)'}`);
  console.log(`  - Theme:         ${colCategory || '(Optional)'}\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const skippedDetails = [];
  const sheetCodes = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const text = col => (col && row[col] ? String(row[col]).trim() : '');

    const teamCode = text(colTeamId).toUpperCase().replace(/\s+/g, '');
    const leaderName = text(colLeader);
    const rawMobile = text(colMobile);
    const mobileNo = cleanMobile(rawMobile);
    const email = text(colEmail);
    const school = text(colSchool) || 'RMK Group of Institutions';
    const project = text(colProject);
    const category = text(colCategory) || 'General Innovation';
    const mentorName = text(colMentor);
    const mentorContact = text(colMentorMobile);
    const mentorEmail = text(colMentorEmail);

    let teamName = text(colName);
    if (!teamName) {
      if (project && project.length <= 40) teamName = project;
      else if (leaderName) teamName = `Team ${leaderName}`;
      else teamName = `Team #${i + 1}`;
    }
    const members = extractMembers(row, leaderName);

    if (!teamCode) {
      skipped++;
      skippedDetails.push(`Row ${rowNum} (${teamName}): Missing TEAM ID`);
      continue;
    }
    sheetCodes.add(teamCode);

    if (!leaderName) {
      skipped++;
      skippedDetails.push(`Row ${rowNum} (${teamCode}): Missing Leader Name`);
      continue;
    }

    if (!mobileNo || mobileNo.length < 10) {
      skipped++;
      skippedDetails.push(`Row ${rowNum} (${teamCode} ${teamName}): Invalid Mobile Number "${rawMobile}"`);
      continue;
    }

    try {
      const details = [teamName, leaderName, mobileNo, email, school, project, category, members, mentorName, mentorContact, mentorEmail];

      let [existing] = await pool.execute('SELECT id FROM teams WHERE team_code = ?', [teamCode]);
      if (existing.length === 0) {
        // Teams imported before TEAM IDs existed: same phone number and same leader name
        const [legacy] = await pool.execute('SELECT id, leader_name FROM teams WHERE team_code IS NULL AND mobile_no = ?', [mobileNo]);
        existing = legacy.filter(t => sameName(t.leader_name, leaderName));
      }

      if (existing.length > 0) {
        await pool.execute(
          `UPDATE teams SET team_code = ?, team_name = ?, leader_name = ?, mobile_no = ?, email = ?, college_name = ?, project_title = ?,
             category = ?, members = ?, mentor_name = ?, mentor_contact = ?, mentor_email = ? WHERE id = ?`,
          [teamCode, ...details, existing[0].id]
        );
        updated++;
      } else {
        await pool.execute(
          `INSERT INTO teams (team_uuid, team_code, team_name, leader_name, mobile_no, email, college_name, project_title, category,
             members, mentor_name, mentor_contact, mentor_email, is_present, check_in_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NULL)`,
          [crypto.randomUUID(), teamCode, ...details]
        );
        inserted++;
      }
    } catch (err) {
      skipped++;
      skippedDetails.push(`Row ${rowNum} (${teamCode}): Database error ${err.message}`);
    }
  }

  const [dbTeams] = await pool.execute('SELECT team_code, team_name, leader_name FROM teams');
  const notInSheet = dbTeams.filter(t => !t.team_code || !sheetCodes.has(t.team_code));

  console.log('====================================================');
  console.log('                 IMPORT SUMMARY');
  console.log('====================================================');
  console.log(`  - Total Rows in Excel:  ${rows.length}`);
  console.log(`  - Teams Added:          ${inserted}`);
  console.log(`  - Teams Updated:        ${updated}`);
  console.log(`  - Rows Skipped:         ${skipped}`);
  console.log(`  - Teams in database:    ${dbTeams.length}`);

  if (skippedDetails.length > 0) {
    console.log('\n[WARNING] Skipped Rows Details:');
    skippedDetails.forEach(d => console.log(`  * ${d}`));
  }

  if (notInSheet.length > 0) {
    console.log('\n[WARNING] In the database but not in this sheet (left unchanged):');
    notInSheet.forEach(t => console.log(`  * ${t.team_code || '(no TEAM ID)'} ${t.team_name} (${t.leader_name})`));
  }

  console.log('\n[SUCCESS] Excel import completed.');
  process.exit(0);
}

importExcel(process.argv[2]).catch(err => {
  console.error('[FATAL] Import failed:', err);
  process.exit(1);
});
