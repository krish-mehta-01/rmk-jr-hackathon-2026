/**
 * RMK Jr. Hackathon 2026 — Official Excel Importer Script
 * Seamlessly parses Google Forms responses and custom spreadsheets into TiDB Cloud.
 *
 * Usage:
 *   node backend/import-excel.js [optional_path_to_excel_file]
 *   npm run import
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { pool, testConnection } = require('./db');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

  // 1. Locate file
  let targetFile = filePath;
  const defaultDownloadPath = 'C:\\Users\\krish\\Downloads\\Junior Hackathon 2026 (Responses) (1).xlsx';

  if (!targetFile) {
    if (fs.existsSync(defaultDownloadPath)) {
      targetFile = defaultDownloadPath;
      console.log(`[INFO] Auto-detected download responses file: ${targetFile}`);
    } else {
      const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
      if (files.length > 0) {
        targetFile = path.join(__dirname, files[0]);
        console.log(`[INFO] Auto-detected Excel file in workspace: ${files[0]}`);
      } else {
        console.error('[ERROR] No Excel file specified and none found.');
        process.exit(1);
      }
    }
  }

  const resolvedPath = path.resolve(targetFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`[ERROR] File does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`[STEP 1] Reading Excel file: ${path.basename(resolvedPath)}`);
  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  console.log(`[INFO] Processing Sheet: "${sheetName}"`);

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rows.length === 0) {
    console.error('[ERROR] The spreadsheet contains no data rows.');
    process.exit(1);
  }

  console.log(`[INFO] Found ${rows.length} rows in sheet.\n`);

  // 2. Connect and verify TiDB schema
  console.log('[STEP 2] Connecting to database and verifying schema...');
  const connected = await testConnection();
  if (!connected) {
    console.warn('[WARN] Running import against in-memory fallback.');
  }

  // Ensure mentor columns exist
  try {
    await pool.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS mentor_name VARCHAR(200) NULL');
    await pool.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS mentor_contact VARCHAR(50) NULL');
    await pool.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS mentor_email VARCHAR(200) NULL');
  } catch {}

  // 3. Process and map columns
  console.log('\n[STEP 3] Parsing and inserting team records into TiDB...');
  const firstRow = rows[0];

  const colName = findKey(firstRow, ['team name', 'team_name', 'teamname', 'name of team'], ['card']);
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const leaderName = colLeader && row[colLeader] ? String(row[colLeader]).trim() : '';
    const rawMobile = colMobile && row[colMobile] ? String(row[colMobile]).trim() : '';
    const mobileNo = cleanMobile(rawMobile);
    const email = colEmail && row[colEmail] ? String(row[colEmail]).trim() : '';
    const school = colSchool && row[colSchool] ? String(row[colSchool]).trim() : 'RMK Group of Institutions';
    const project = colProject && row[colProject] ? String(row[colProject]).trim() : '';
    const category = colCategory && row[colCategory] ? String(row[colCategory]).trim() : 'General Innovation';
    const mentorName = colMentor && row[colMentor] ? String(row[colMentor]).trim() : '';
    const mentorContact = colMentorMobile && row[colMentorMobile] ? String(row[colMentorMobile]).trim() : '';
    const mentorEmail = colMentorEmail && row[colMentorEmail] ? String(row[colMentorEmail]).trim() : '';

    const rawTeamName = colName && row[colName] ? String(row[colName]).trim() : '';
    let teamName = rawTeamName;
    if (!teamName) {
      if (project && project.length <= 40) {
        teamName = project;
      } else if (leaderName) {
        teamName = `Team ${leaderName}`;
      } else {
        teamName = `Team #${i + 1}`;
      }
    }

    const members = extractMembers(row, leaderName);
    const teamUuid = crypto.randomUUID();

    if (!leaderName) {
      skipped++;
      skippedDetails.push(`Row ${rowNum}: Missing Leader Name`);
      continue;
    }

    if (!mobileNo || mobileNo.length < 10) {
      skipped++;
      skippedDetails.push(`Row ${rowNum} (${teamName}): Invalid Mobile Number "${rawMobile}"`);
      continue;
    }

    try {
      const [res] = await pool.execute(
        `INSERT INTO teams (team_uuid, team_name, leader_name, mobile_no, email, college_name, project_title, category, members, mentor_name, mentor_contact, mentor_email, is_present, check_in_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NULL)
         ON DUPLICATE KEY UPDATE
           team_name = VALUES(team_name),
           leader_name = VALUES(leader_name),
           email = VALUES(email),
           college_name = VALUES(college_name),
           project_title = VALUES(project_title),
           category = VALUES(category),
           members = VALUES(members),
           mentor_name = VALUES(mentor_name),
           mentor_contact = VALUES(mentor_contact),
           mentor_email = VALUES(mentor_email)`,
        [teamUuid, teamName, leaderName, mobileNo, email, school, project, category, members, mentorName, mentorContact, mentorEmail]
      );

      if (res && res.affectedRows === 1) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      skipped++;
      skippedDetails.push(`Row ${rowNum}: Database error ${err.message}`);
    }
  }

  console.log('====================================================');
  console.log('                 IMPORT SUMMARY');
  console.log('====================================================');
  console.log(`  - Total Rows in Excel:  ${rows.length}`);
  console.log(`  - Teams Added:          ${inserted}`);
  console.log(`  - Teams Updated:        ${updated}`);
  console.log(`  - Rows Skipped:         ${skipped}`);

  if (skippedDetails.length > 0) {
    console.log('\n[WARNING] Skipped Rows Details:');
    skippedDetails.slice(0, 10).forEach(d => console.log(`  * ${d}`));
  }

  console.log('\n[SUCCESS] Excel import completed successfully with mentor details!');
  process.exit(0);
}

const fileArg = process.argv[2];
importExcel(fileArg).catch(err => {
  console.error('[FATAL] Import failed:', err);
  process.exit(1);
});
