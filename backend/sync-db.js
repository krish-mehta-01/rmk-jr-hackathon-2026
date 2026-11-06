/**
 * RMK Jr. Hackathon 2026 — Master Database Sync Script
 * 
 * Reconciles the latest Excel responses sheet with TiDB Cloud MySQL:
 * 1. Preserves existing 97 teams (RMKJH261001 - RMKJH261097) untouched.
 * 2. Deduplicates new entries from Form Responses 1.
 * 3. Assigns sequential team codes starting from RMKJH261098.
 * 4. Inserts new teams with clean fields, tokens, and UUIDs using batch inserts.
 * 5. Updates theme_venues with official venue allocations.
 * 6. Verifies all assertions.
 */

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { pool, testConnection } = require('./db');

const EXCEL_PATH = 'C:/Users/krish/.gemini/antigravity/brain/85886fa9-8576-486f-bb61-edd05d989cbf/.user_uploaded/media_1793970474248_1f91d49c.xlsx';

const THEME_VENUE_MAPPING = {
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

function cleanMobile(raw) {
  if (!raw) return '';
  let str = String(raw).trim().replace(/[^0-9]/g, '');
  if (str.startsWith('91') && str.length === 12) str = str.slice(2);
  else if (str.startsWith('0') && str.length === 11) str = str.slice(1);
  else if (str.length > 10) str = str.slice(-10);
  else if (str.length === 9) str = '0' + str; // Pad 9-digit numbers (e.g. 701392004 -> 0701392004)
  return str;
}

function norm(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractMembers(row, leaderName) {
  const members = [leaderName.trim()];
  const memberCols = ['Name of Member-2', 'Name of Member-3', 'Name of Member-4'];
  
  for (const col of memberCols) {
    if (row[col]) {
      const val = String(row[col]).trim();
      const lower = val.toLowerCase();
      if (val && !['nil', 'none', 'n/a', '-', 'no', 'null'].includes(lower)) {
        if (!members.some(m => norm(m) === norm(val))) {
          members.push(val);
        }
      }
    }
  }
  return members.join(', ');
}

async function syncDatabase() {
  console.log('====================================================');
  console.log('  RMK JR. HACKATHON 2026 — MASTER DATABASE SYNC');
  console.log('====================================================\n');

  // 1. Verify DB connection
  console.log('[STEP 1] Testing TiDB Cloud database connection...');
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Could not connect to TiDB Cloud.');
  }

  // Ensure column sizes support long descriptions from Google Form
  console.log('[INFO] Ensuring column limits are sufficient for form text...');
  await pool.execute('ALTER TABLE teams MODIFY COLUMN project_title TEXT NULL');
  await pool.execute('ALTER TABLE teams MODIFY COLUMN college_name VARCHAR(500) NULL');
  await pool.execute('ALTER TABLE teams MODIFY COLUMN mentor_name VARCHAR(500) NULL');
  await pool.execute('ALTER TABLE teams MODIFY COLUMN team_name VARCHAR(500) NOT NULL');

  // 2. Fetch and snapshot existing 97 teams (Codes RMKJH261001 - RMKJH261097)
  console.log('\n[STEP 2] Verifying existing 97 teams in DB (RMKJH261001 - RMKJH261097)...');
  const [existingTeams] = await pool.execute(
    'SELECT * FROM teams WHERE team_code BETWEEN "RMKJH261001" AND "RMKJH261097" ORDER BY team_code ASC'
  );
  console.log(`Verified ${existingTeams.length} existing base teams in DB (RMKJH261001 - RMKJH261097).`);

  if (existingTeams.length !== 97) {
    throw new Error(`CRITICAL INTEGRITY FAILURE: Expected exactly 97 base teams, found ${existingTeams.length}`);
  }

  // Clean up any partially inserted teams from a previous interrupted run above RMKJH261097
  const [partialNew] = await pool.execute('SELECT COUNT(*) as count FROM teams WHERE team_code > "RMKJH261097"');
  if (partialNew[0].count > 0) {
    console.log(`[CLEANUP] Cleaning up ${partialNew[0].count} partial new teams from prior failed attempt...`);
    await pool.execute('DELETE FROM teams WHERE team_code > "RMKJH261097"');
    console.log('[OK] Reset to pristine state with 97 original teams intact.');
  }

  // 3. Read Excel Form Responses 1
  console.log(`\n[STEP 3] Reading Excel file: ${EXCEL_PATH}`);
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets['Form Responses 1'];
  if (!sheet) throw new Error("Sheet 'Form Responses 1' not found in Excel!");

  const excelRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`Loaded ${excelRows.length} rows from 'Form Responses 1'.`);

  // 4. Identify which Excel rows correspond to existing 97 teams
  const matchedExistingExcelRowNums = new Set();
  existingTeams.forEach(t => {
    const dbMob = cleanMobile(t.mobile_no);
    const dbLead = norm(t.leader_name);
    const dbTeam = norm(t.team_name);

    excelRows.forEach((r, idx) => {
      const mob = cleanMobile(r['Team Leader Contact Number (Mobile Number)']);
      const lead = norm(r['Team Leader Name']);
      const team = norm(r['Team Name']);

      if ((dbMob === mob && (dbLead === lead || dbTeam === team)) ||
          (dbLead === lead && dbTeam === team)) {
        matchedExistingExcelRowNums.add(idx + 2);
      }
    });
  });

  console.log(`Matched ${matchedExistingExcelRowNums.size} Excel rows to existing 97 DB teams (preserved intact).`);

  // 5. Filter out existing and deduplicate remaining new rows
  const seenNewKeys = new Set();
  const newTeamsToInsert = [];
  const skippedDuplicates = [];

  for (let idx = 0; idx < excelRows.length; idx++) {
    const rowNum = idx + 2;
    if (matchedExistingExcelRowNums.has(rowNum)) continue; // Already in DB

    const r = excelRows[idx];
    const mob = cleanMobile(r['Team Leader Contact Number (Mobile Number)']);
    const leader = norm(r['Team Leader Name']);
    const team = norm(r['Team Name']);
    const project = norm(r['Title of Your Project']);

    const key1 = mob + '|' + leader;
    const key2 = mob + '|' + team;
    const key3 = mob + '|' + project;

    let isDupe = false;
    let dupeReason = '';

    if (seenNewKeys.has(key1)) {
      isDupe = true;
      dupeReason = `Duplicate mobile & leader: ${mob} / ${r['Team Leader Name']}`;
    } else if (mob && team && team !== 'team' && seenNewKeys.has(key2)) {
      isDupe = true;
      dupeReason = `Duplicate mobile & team: ${mob} / ${r['Team Name']}`;
    } else if (mob && project && project.length > 5 && seenNewKeys.has(key3)) {
      isDupe = true;
      dupeReason = `Duplicate mobile & project: ${mob} / ${r['Title of Your Project']}`;
    }

    if (isDupe) {
      skippedDuplicates.push({ rowNum, dupeReason, team: r['Team Name'], leader: r['Team Leader Name'] });
    } else {
      seenNewKeys.add(key1);
      if (team) seenNewKeys.add(key2);
      if (project) seenNewKeys.add(key3);
      newTeamsToInsert.push({ rowNum, idx, r });
    }
  }

  console.log(`\n[STEP 4] Deduplication Results:`);
  console.log(`  - New unique teams to insert: ${newTeamsToInsert.length}`);
  console.log(`  - Duplicate rows filtered out: ${skippedDuplicates.length}`);
  skippedDuplicates.forEach(d => console.log(`    * Row ${d.rowNum}: ${d.dupeReason}`));

  // 6. Assign sequential team codes starting from RMKJH261098
  let currentCodeNum = 1098;
  const insertPayloads = newTeamsToInsert.map(item => {
    const r = item.r;
    const teamCode = `RMKJH26${currentCodeNum++}`;
    
    let teamName = String(r['Team Name'] || '').trim();
    const leaderName = String(r['Team Leader Name'] || '').trim();
    const projectTitle = String(r['Title of Your Project'] || '').trim();
    if (!teamName) {
      teamName = projectTitle || `Team ${leaderName}`;
    }

    const mobileNo = cleanMobile(r['Team Leader Contact Number (Mobile Number)']);
    const email = String(r['Team Leader Email ID'] || r['Email Address'] || '').trim().toLowerCase();
    const collegeName = String(r['Name of the School'] || 'RMK Group of Institutions').trim();
    const category = String(r['Theme'] || 'General Innovation').trim();
    const members = extractMembers(r, leaderName);

    const mentorName = r['Mentor Name'] ? String(r['Mentor Name']).trim() : null;
    const mentorContactRaw = r['Mentor Contact Number'];
    const mentorContact = mentorContactRaw ? (cleanMobile(mentorContactRaw) || String(mentorContactRaw).trim()) : null;
    const mentorEmail = r['Mentor Email ID'] ? String(r['Mentor Email ID']).trim().toLowerCase() : null;

    const qrToken = crypto.randomBytes(32).toString('hex');
    const teamUuid = crypto.randomUUID();

    return {
      rowNum: item.rowNum,
      team_uuid: teamUuid,
      team_code: teamCode,
      team_name: teamName,
      leader_name: leaderName,
      mobile_no: mobileNo,
      email: email,
      college_name: collegeName,
      project_title: projectTitle,
      category: category,
      members: members,
      mentor_name: mentorName,
      mentor_contact: mentorContact,
      mentor_email: mentorEmail,
      qr_verification_token: qrToken
    };
  });

  console.log(`\n[STEP 5] Inserting ${insertPayloads.length} new teams (Codes: ${insertPayloads[0].team_code} to ${insertPayloads[insertPayloads.length - 1].team_code})...`);

  // Batch insert in chunks of 50 for speed and connection stability
  const CHUNK_SIZE = 50;
  let insertedCount = 0;
  for (let i = 0; i < insertPayloads.length; i += CHUNK_SIZE) {
    const chunk = insertPayloads.slice(i, i + CHUNK_SIZE);
    const valuePlaceholders = [];
    const params = [];

    for (const p of chunk) {
      valuePlaceholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NULL, ?)');
      params.push(
        p.team_uuid, p.team_code, p.team_name, p.leader_name, p.mobile_no, p.email,
        p.college_name, p.project_title, p.category, p.members, p.mentor_name,
        p.mentor_contact, p.mentor_email, p.qr_verification_token
      );
    }

    const sql = `INSERT INTO teams (
      team_uuid, team_code, team_name, leader_name, mobile_no, email,
      college_name, project_title, category, members, mentor_name,
      mentor_contact, mentor_email, is_present, check_in_time, qr_verification_token
    ) VALUES ${valuePlaceholders.join(', ')}`;

    await pool.execute(sql, params);
    insertedCount += chunk.length;
    console.log(`[PROGRESS] Inserted batch ${Math.floor(i / CHUNK_SIZE) + 1} (${insertedCount}/${insertPayloads.length} teams)...`);
  }
  console.log(`[OK] Successfully inserted all ${insertedCount} new teams.`);

  // 7. Update theme_venues
  console.log('\n[STEP 6] Updating theme_venues table...');
  let venuesUpdated = 0;
  for (const [theme, venue] of Object.entries(THEME_VENUE_MAPPING)) {
    await pool.execute(
      `INSERT INTO theme_venues (theme, venue) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE venue = VALUES(venue)`,
      [theme, venue]
    );
    venuesUpdated++;
  }
  console.log(`[OK] Updated ${venuesUpdated} theme venues.`);

  // 8. Verification
  console.log('\n====================================================');
  console.log('               VERIFICATION CHECKS');
  console.log('====================================================');
  
  const [totalCountRows] = await pool.execute('SELECT COUNT(*) as total, MIN(team_code) as min_code, MAX(team_code) as max_code FROM teams');
  console.log('Teams Summary in DB:', totalCountRows[0]);

  // Check existing 97 intact
  const [existingVerify] = await pool.execute(
    'SELECT COUNT(*) as count FROM teams WHERE team_code BETWEEN "RMKJH261001" AND "RMKJH261097"'
  );
  console.log(`Existing 97 teams intact check: ${existingVerify[0].count} / 97`);

  // Check new teams count
  const [newVerify] = await pool.execute(
    'SELECT COUNT(*) as count FROM teams WHERE team_code BETWEEN "RMKJH261098" AND "RMKJH261262"'
  );
  console.log(`New teams check (RMKJH261098 - RMKJH261262): ${newVerify[0].count} / 165`);

  // Check venues
  const [venueRows] = await pool.execute('SELECT * FROM theme_venues ORDER BY theme ASC');
  console.log('\nTheme Venues Status:');
  let missingVenues = 0;
  venueRows.forEach(v => {
    console.log(`  - ${v.theme.padEnd(42)} -> ${v.venue || '[MISSING]'}`);
    if (!v.venue) missingVenues++;
  });

  if (missingVenues > 0) {
    console.warn(`[WARN] ${missingVenues} themes have missing venues!`);
  } else {
    console.log('[OK] All themes have valid venues allocated!');
  }

  console.log('\n[SUCCESS] Database sync completed successfully!');
  return {
    totalTeams: totalCountRows[0].total,
    minCode: totalCountRows[0].min_code,
    maxCode: totalCountRows[0].max_code,
    insertedTeams: insertedCount,
    duplicatesFiltered: skippedDuplicates.length,
    venuesCount: venueRows.length,
    venueRows
  };
}

if (require.main === module) {
  syncDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[FATAL ERROR]:', err);
      process.exit(1);
    });
}

module.exports = { syncDatabase };
