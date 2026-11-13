// ════════════════════════════════════════════════════════════════
//  RMK JR. HACKATHON 2026 — OFFICIAL CLIENT APPLICATION
//  Dual Cryptographic Verification · Responsive Workspace
//  Team Details with Mentor · Real-time Attendance Check-in
// ════════════════════════════════════════════════════════════════

// Team leaders use the site root; admins use /rmkjrhackathon2026-adminlogin (flag set in index.html)
const IS_ADMIN_PAGE = document.documentElement.classList.contains('admin-page');
const IS_JURY_ADMIN_PAGE = document.documentElement.classList.contains('jury-admin-page');
const IS_JURY_PAGE = document.documentElement.classList.contains('jury-page');

let teamToken = null;
let adminToken = null;
let teamData = null;

let juryAdminToken = null;
let judgeToken = null;
let judgeMeData = null;

let currentFilter = 'all';
let searchDebounceTimer = null;
let permanentQRCodeData = null;

// Camera / Scanner state for Student View
let qrStream = null;
let isScanning = false;
// Venue code from a QR opened with the phone's own camera app (site link ending in #p=<code>)
let pendingVenueCode = null;
let autoScanTried = false;   // the camera opens by itself once per login; after "Close Camera" it stays closed

// ─────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  takeVenueCodeFromLink();
  restoreSession();
});

// A QR opened with the phone's camera app lands here as /#p=<code>. Keep the code for this tab
// (it survives a reload before login) and clear it from the address bar.
function takeVenueCodeFromLink() {
  if (IS_ADMIN_PAGE || IS_JURY_ADMIN_PAGE || IS_JURY_PAGE) return;
  let code = null;
  const hashMatch = location.hash.match(/[#&]?(?:p|venue_qr)=(\d{64})/i);
  if (hashMatch) {
    code = hashMatch[1];
  } else {
    const searchMatch = location.search.match(/[?&]?(?:p|venue_qr)=(\d{64})/i);
    if (searchMatch) code = searchMatch[1];
  }

  if (code) {
    sessionStorage.setItem('rmk_pending_venue_code', code);
    history.replaceState(null, '', location.pathname);
  }
  pendingVenueCode = sessionStorage.getItem('rmk_pending_venue_code');
  updateQrNoticeBanner();
}

function updateQrNoticeBanner() {
  const banner = document.getElementById('venue-qr-notice-banner');
  if (!banner) return;
  if (pendingVenueCode) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function setupEventListeners() {
  const formTeam = document.getElementById('form-team-login');
  if (formTeam) formTeam.addEventListener('submit', handleTeamLogin);

  const formAdmin = document.getElementById('form-admin-login');
  if (formAdmin) formAdmin.addEventListener('submit', handleAdminLogin);

  const formJuryAdmin = document.getElementById('form-jury-admin-login');
  if (formJuryAdmin) formJuryAdmin.addEventListener('submit', handleJuryAdminLogin);

  const formJudge = document.getElementById('form-judge-login');
  if (formJudge) formJudge.addEventListener('submit', handleJudgeLogin);

  const formJudgePwd = document.getElementById('form-judge-change-password');
  if (formJudgePwd) formJudgePwd.addEventListener('submit', handleJudgeChangePassword);
}

// ─────────────────────────────────────────────────────────────
// SESSION RESTORATION
// ─────────────────────────────────────────────────────────────
function restoreSession() {
  // Always restore tokens from localStorage if present
  adminToken = localStorage.getItem('rmk_admin_token') || null;
  juryAdminToken = localStorage.getItem('rmk_jury_admin_token') || null;
  judgeToken = localStorage.getItem('rmk_judge_token') || null;
  teamToken = localStorage.getItem('rmk_team_token') || null;

  if (IS_JURY_ADMIN_PAGE) {
    document.title = 'RMK Jr. Hackathon 2026 — Jury Admin';
    if (juryAdminToken) {
      initJuryAdminDashboard();
      showView('view-jury-admin');
    } else {
      showView('view-jury-admin-login');
    }
    return;
  }

  if (IS_JURY_PAGE) {
    document.title = 'RMK Jr. Hackathon 2026 — Jury Evaluation';
    if (judgeToken) {
      refreshJudgeStatus();
    } else {
      showView('view-jury-login');
    }
    return;
  }

  if (IS_ADMIN_PAGE) {
    document.title = 'RMK Jr. Hackathon 2026 — Admin';
    if (adminToken) {
      initAdminDashboard();
      showView('view-admin');
    } else {
      showView('view-auth');
    }
    return;
  }

  teamToken = localStorage.getItem('rmk_team_token');
  if (teamToken) {
    teamData = JSON.parse(localStorage.getItem('rmk_team_data') || '{}');
    initTeamDashboard();
    showView('view-team');
    // A saved login may have expired: confirm it with the server before opening the camera
    refreshTeamStatus().then(valid => { if (valid) afterTeamLogin(); });
  } else {
    showView('view-auth');
  }
}

// ─────────────────────────────────────────────────────────────
// VIEW SWITCHING
// ─────────────────────────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.app-view').forEach(v => {
    if (v.id === viewId) {
      v.classList.remove('hidden');
      v.classList.add('active');
    } else {
      v.classList.remove('active');
      v.classList.add('hidden');
    }
  });

  const isJuryView = Boolean(viewId && viewId.startsWith('view-jury'));
  document.documentElement.classList.toggle('jury-theme-active', isJuryView);

  if (viewId !== 'view-team') {
    closeScanner();
  }
}

// ─────────────────────────────────────────────────────────────
// TEAM LEADER LOGIN
// ─────────────────────────────────────────────────────────────
async function handleTeamLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById('team-login-error');
  const btn = document.getElementById('team-login-btn');

  // Team IDs are RMKJH261 + three digits; leaders type only the digits ("5" or "49" means "049")
  const idDigits = document.getElementById('team-id-input').value.replace(/\D/g, '');
  const phone = document.getElementById('team-phone-input').value.replace(/\D/g, '').slice(-10);

  errorEl.classList.add('hidden');
  errorEl.textContent = '';

  if (!idDigits || phone.length !== 10) {
    errorEl.textContent = 'Enter the last digits of your Team ID and the 10-digit phone number.';
    errorEl.classList.remove('hidden');
    return;
  }

  setButtonLoading(btn, true);

  try {
    const res = await fetch('/api/team/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: 'RMKJH261' + idDigits.padStart(3, '0'), phone })
    });

    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Team ID and phone number do not match. Please check both.';
      errorEl.classList.remove('hidden');
      return;
    }

    teamToken = data.token;
    teamData = data.team;
    localStorage.setItem('rmk_team_token', teamToken);
    localStorage.setItem('rmk_team_data', JSON.stringify(teamData));

    initTeamDashboard();
    showView('view-team');
    afterTeamLogin();

  } catch {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.remove('hidden');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────────────────────
async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('admin-login-error');
  const btn = document.getElementById('admin-login-btn');

  errorEl.classList.add('hidden');
  errorEl.textContent = '';
  setButtonLoading(btn, true);

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Invalid username or password.';
      errorEl.classList.remove('hidden');
      return;
    }

    adminToken = data.token;
    localStorage.setItem('rmk_admin_token', adminToken);

    initAdminDashboard();
    showView('view-admin');

  } catch {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.remove('hidden');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────
// Logs out of this page's role only, and returns to this page's login form
function logout(message) {
  closeScanner();
  if (IS_ADMIN_PAGE) {
    adminToken = null;
    localStorage.removeItem('rmk_admin_token');
  } else {
    teamToken = null;
    teamData = null;
    autoScanTried = false;
    localStorage.removeItem('rmk_team_token');
    localStorage.removeItem('rmk_team_data');
  }

  showView('view-auth');
  if (typeof message === 'string') showToast(message, 'info');
}

// A 401 means the 12h login expired: send the user back to the login screen
function sessionExpired(res) {
  if (res.status !== 401) return false;
  logout('Session expired. Please log in again.');
  return true;
}

// ─────────────────────────────────────────────────────────────
// TEAM LEADER DASHBOARD
// ─────────────────────────────────────────────────────────────
function initTeamDashboard() {
  if (!teamData) return;

  renderTeamDetails(teamData);
  renderPassStatus(teamData.is_present, teamData.check_in_time);
  renderVenueMap(teamData);
}

function renderVenueMap(team) {
  const mapCard = document.getElementById('pass-venue-map-card');
  if (!mapCard) return;

  // Show map ONLY after they scan
  if (!team || !team.is_present) {
    mapCard.classList.add('hidden');
    return;
  }
  mapCard.classList.remove('hidden');

  const venue = ((team && team.venue) ? team.venue : '').toUpperCase();
  let blockName = '';
  let activeBlockId = '';

  if (venue.includes('RJ BLOCK') || venue.includes('IDEA LAB') || venue.includes('CO-WORK') || venue.includes('CO WORK')) {
    blockName = 'RJ Block';
    activeBlockId = 'dir-block-rj';
  } else if (venue.includes('SV BLOCK')) {
    blockName = 'SV Block';
    activeBlockId = 'dir-block-sv';
  } else if (venue.includes('VR BLOCK')) {
    blockName = 'VR Block';
    activeBlockId = 'dir-block-vr';
  }

  const badge = document.getElementById('pass-map-block-name');
  if (badge) {
    badge.textContent = blockName ? `Allocated Block: ${blockName}` : 'RMK Engineering College Campus';
  }
}

function openMapModal() {
  const modal = document.getElementById('map-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeMapModal() {
  const modal = document.getElementById('map-modal');
  if (modal) modal.classList.add('hidden');
}

function renderTeamDetails(team) {
  if (!team) return;

  document.getElementById('pass-team-name').textContent = team.team_name || 'Team';
  document.getElementById('pass-project-title').textContent = team.project_title || team.team_name || '—';
  document.getElementById('pass-school-name').textContent = team.college_name || '—';
  document.getElementById('pass-mentor-name').textContent = team.mentor_name || '—';

  // Sitting place and Panel for the team (Hero Allocation Bento)
  const venueRow = document.getElementById('pass-venue-row');
  if (venueRow) {
    venueRow.classList.toggle('hidden', !team.venue && !team.panel_no);
    const panelEl = document.getElementById('pass-panel-value');
    if (panelEl) {
      panelEl.textContent = team.panel_no ? `Panel ${team.panel_no}` : 'Panel Pending';
    }
    const venueEl = document.getElementById('pass-venue');
    if (venueEl) {
      venueEl.textContent = team.venue || 'Venue Pending';
    }
    const themeEl = document.getElementById('pass-venue-theme');
    if (themeEl) {
      const cleanTheme = (team.theme || team.category || '').trim();
      themeEl.textContent = cleanTheme || 'General Track';
    }
  }

  document.getElementById('pass-members-list').innerHTML = membersListItems(team);
}

// Numbered member list items; the leader comes first and is tagged unless excluded
function membersListItems(team, includeLeader = true) {
  const leader = includeLeader ? (team.leader_name || '').trim() : '';
  const others = String(team.members || '')
    .split(',')
    .map(m => m.trim())
    .filter(m => m && m.toLowerCase() !== (team.leader_name || '').trim().toLowerCase());

  return [leader, ...others]
    .filter(Boolean)
    .map((name, i) => `<li>${escapeHtml(name)}${i === 0 && leader ? ' <span class="member-leader-tag">Leader</span>' : ''}</li>`)
    .join('');
}

function renderPassStatus(isPresent, checkInTime) {
  const statusPill = document.getElementById('pass-status-pill');
  const scanActionWrap = document.getElementById('pass-scan-action-wrap');
  const successBox = document.getElementById('pass-scanned-success-box');
  const detailsBox = document.getElementById('pass-team-details');
  const timeSub = document.getElementById('pass-scanned-time-sub');

  statusPill.textContent = isPresent ? 'Scanned' : 'Not Scanned';
  statusPill.className = 'status-pill-badge ' + (isPresent ? 'pill-present' : 'pill-absent');
  scanActionWrap.classList.toggle('hidden', Boolean(isPresent));
  successBox.classList.toggle('hidden', !isPresent);
  detailsBox.classList.toggle('hidden', !isPresent);
  const mapCard = document.getElementById('pass-venue-map-card');
  if (mapCard) {
    mapCard.classList.toggle('hidden', !isPresent);
  }

  if (isPresent) {
    timeSub.textContent = checkInTime
      ? new Date(checkInTime).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
      : '';
    closeScanner();
  }
}

// Returns true when the saved login is still valid and the team data is fresh
async function refreshTeamStatus() {
  if (!teamToken) return false;
  try {
    const res = await fetch('/api/team/status', {
      headers: { Authorization: 'Bearer ' + teamToken }
    });
    if (sessionExpired(res) || !res.ok) return false;

    const updated = await res.json();
    teamData = { ...teamData, ...updated };
    localStorage.setItem('rmk_team_data', JSON.stringify(teamData));
    initTeamDashboard();
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// STUDENT QR SCANNER (SCANS VENUE STANDEE)
// ─────────────────────────────────────────────────────────────
// Right after login the camera opens by itself, so the leader just points it at the venue QR. If the browser
// blocks or the leader denies the camera, the "Scan QR Code" button is still there to try again.
// Pulls the 64-digit venue code out of a scanned QR (a site link or the bare code)
function venueCodeFrom(text) {
  const match = String(text || '').match(/\d{64}/);
  return match ? match[0] : null;
}

// Once a team leader is logged in: a code from an opened QR link marks presence directly,
// otherwise the camera opens for scanning
function afterTeamLogin() {
  if (pendingVenueCode) {
    const code = pendingVenueCode;
    pendingVenueCode = null;
    sessionStorage.removeItem('rmk_pending_venue_code');
    if (!teamData.is_present) {
      submitAttendance(code);
      return;
    }
  }
  // No auto camera popup: user is logged in, can view pass or click Scan QR manually
}

function autoOpenScanner() {
  if (autoScanTried || isScanning || !teamData || teamData.is_present) return;
  autoScanTried = true;
  openScanner();
}

async function openScanner() {
  const scanActionWrap = document.getElementById('pass-scan-action-wrap');
  const camSec = document.getElementById('team-camera-view');
  const video = document.getElementById('qr-video');
  const feedback = document.getElementById('scan-feedback');

  feedback.classList.add('hidden');

  // Browsers only allow the camera on HTTPS pages (or localhost)
  if (!window.isSecureContext || !navigator.mediaDevices) {
    feedback.className = 'glass-feedback feedback-error';
    feedback.textContent = 'Camera needs a secure (https://) link. Please open the portal using its https address.';
    feedback.classList.remove('hidden');
    return;
  }

  if (typeof jsQR === 'undefined') {
    feedback.className = 'glass-feedback feedback-error';
    feedback.textContent = 'Scanner did not load. Please refresh the page.';
    feedback.classList.remove('hidden');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    // The leader may have been logged out while the browser was asking for the camera
    if (!teamToken || document.getElementById('view-team').classList.contains('hidden')) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    qrStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();

    if (scanActionWrap) scanActionWrap.classList.add('hidden');
    camSec.classList.remove('hidden');
    isScanning = true;
    requestAnimationFrame(tickScanner);
  } catch {
    feedback.className = 'glass-feedback feedback-error';
    feedback.textContent = 'Camera permission required. Please allow camera access to scan the venue QR code.';
    feedback.classList.remove('hidden');
  }
}

function closeScanner() {
  isScanning = false;
  if (qrStream) {
    qrStream.getTracks().forEach(track => track.stop());
    qrStream = null;
  }
  const camSec = document.getElementById('team-camera-view');
  if (camSec) camSec.classList.add('hidden');

  const scanActionWrap = document.getElementById('pass-scan-action-wrap');
  if (scanActionWrap && (!teamData || !teamData.is_present)) {
    scanActionWrap.classList.remove('hidden');
  }
}

function tickScanner() {
  if (!isScanning) return;

  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');

  if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (typeof jsQR !== 'undefined') {
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        closeScanner();
        submitAttendance(venueCodeFrom(code.data) || code.data.trim());
        return;
      }
    }
  }

  requestAnimationFrame(tickScanner);
}

async function submitAttendance(qrCodeValue) {
  const feedback = document.getElementById('scan-feedback');
  feedback.classList.add('hidden');

  try {
    const res = await fetch('/api/team/mark-attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + teamToken
      },
      body: JSON.stringify({ qr_value: qrCodeValue })
    });

    if (sessionExpired(res)) return;
    const data = await res.json();
    if (!res.ok) {
      feedback.className = 'glass-feedback feedback-error';
      feedback.textContent = data.error || 'Invalid QR code. Please try again.';
      feedback.classList.remove('hidden');
      return;
    }

    teamData = { ...teamData, ...data.team, is_present: true };
    localStorage.setItem('rmk_team_data', JSON.stringify(teamData));

    renderTeamDetails(teamData);
    renderPassStatus(true, teamData.check_in_time);
    renderVenueMap(teamData);
    document.getElementById('view-team').scrollTo({ top: 0, behavior: 'smooth' });

  } catch {
    feedback.className = 'glass-feedback feedback-error';
    feedback.textContent = 'Connection error. Please try again.';
    feedback.classList.remove('hidden');
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────
function initAdminDashboard() {
  loadAdminStats();
  loadTeamsTable();
  loadPermanentVenueQR();
}

function switchAdminSection(secName) {
  const alinkTable = document.getElementById('alink-table');
  const alinkThemes = document.getElementById('alink-themes');
  const alinkQR = document.getElementById('alink-qr');
  const alinkAllocations = document.getElementById('alink-allocations');

  const secTable = document.getElementById('admin-sec-table');
  const secThemes = document.getElementById('admin-sec-themes');
  const secQR = document.getElementById('admin-sec-qr');
  const secAllocations = document.getElementById('admin-sec-allocations');

  [alinkTable, alinkThemes, alinkQR, alinkAllocations].forEach(btn => btn && btn.classList.remove('active'));
  [secTable, secThemes, secQR, secAllocations].forEach(pane => {
    if (pane) {
      pane.classList.add('hidden');
      pane.classList.remove('active');
    }
  });

  if (secName === 'table') {
    if (alinkTable) alinkTable.classList.add('active');
    if (secTable) {
      secTable.classList.remove('hidden');
      secTable.classList.add('active');
    }
    loadTeamsTable();
  } else if (secName === 'themes') {
    if (alinkThemes) alinkThemes.classList.add('active');
    if (secThemes) {
      secThemes.classList.remove('hidden');
      secThemes.classList.add('active');
    }
    loadThemes();
  } else if (secName === 'allocations') {
    if (alinkAllocations) alinkAllocations.classList.add('active');
    if (secAllocations) {
      secAllocations.classList.remove('hidden');
      secAllocations.classList.add('active');
    }
    loadAdminAllocations();
  } else if (secName === 'qr') {
    if (alinkQR) alinkQR.classList.add('active');
    if (secQR) {
      secQR.classList.remove('hidden');
      secQR.classList.add('active');
    }
    loadPermanentVenueQR();
  }
}

async function loadAdminStats() {
  if (!adminToken) return;
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (sessionExpired(res) || !res.ok) return;

    const data = await res.json();
    document.getElementById('stat-total').textContent = data.total ?? 0;
    document.getElementById('stat-present').textContent = data.present ?? 0;
    document.getElementById('stat-absent').textContent = data.absent ?? 0;
    document.getElementById('stat-rate').textContent = (data.attendance_rate ?? 0) + '%';
  } catch {}
}

function setAttendanceFilter(filterVal, btn) {
  currentFilter = filterVal;
  document.querySelectorAll('.filter-tab').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  loadTeamsTable();
}

function handleTableSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadTeamsTable();
  }, 300);
}

async function loadTeamsTable() {
  if (!adminToken) return;

  const tbody = document.getElementById('teams-table-body');
  const search = document.getElementById('admin-search-input').value.trim();

  let url = '/api/admin/teams?limit=500';
  if (currentFilter !== 'all') {
    url += '&present=' + currentFilter;
  }
  if (search) {
    url += '&search=' + encodeURIComponent(search);
  }

  try {
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load teams. Please refresh.</td></tr>';
      return;
    }

    const data = await res.json();
    renderTeamsRows(data.teams || []);
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Network error loading teams.</td></tr>';
  }
}

// Team names by row id, so the action button never embeds user-supplied text in markup
const teamNamesById = new Map();
// Rows the admin has expanded; kept open across table refreshes
const expandedTeams = new Set();

function renderTeamsRows(teams) {
  const tbody = document.getElementById('teams-table-body');
  if (teams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No teams found.</td></tr>';
    return;
  }

  teamNamesById.clear();
  tbody.innerHTML = teams.map(t => {
    const id = Number(t.id);
    teamNamesById.set(id, t.team_name);
    const isPresent = Boolean(t.is_present);
    const isOpen = expandedTeams.has(id);
    const scannedAt = t.check_in_time
      ? new Date(t.check_in_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
      : 'Not scanned yet';

    return `
      <tr class="team-row${isOpen ? ' is-open' : ''}">
        <td data-label="Team">
          <div class="table-team-id mono">${escapeHtml(t.team_code || '')}</div>
          <div class="table-team-title">${escapeHtml(t.team_name || '—')}</div>
        </td>
        <td data-label="Team Leader">${escapeHtml(t.leader_name || '—')}</td>
        <td data-label="Mentor">${escapeHtml(t.mentor_name || '—')}</td>
        <td data-label="School">${escapeHtml(t.college_name || '—')}</td>
        <td data-label="Status">
          <span class="status-pill-badge ${isPresent ? 'pill-present' : 'pill-absent'}">${isPresent ? (t.marked_by === 'Admin' ? 'Present (Admin)' : 'Scanned (QR)') : 'Not Scanned'}</span>
        </td>
        <td data-label="" class="table-actions-cell">
          <button type="button" class="btn-view-details" data-details-id="${id}" aria-expanded="${isOpen}" aria-label="${isOpen ? 'Hide details' : 'View details'}" title="${isOpen ? 'Hide details' : 'View details'}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </td>
      </tr>
      <tr class="team-detail-row${isOpen ? '' : ' hidden'}" data-detail-for="${id}">
        <td colspan="6">
          <div class="team-detail-body">
          <dl class="team-detail-grid">
            <div><dt>Panel & Venue</dt><dd><strong>${t.panel_no ? `Panel ${t.panel_no}` : '—'}</strong> · ${escapeHtml(t.venue || '—')}</dd></div>
            <div><dt>Idea Title</dt><dd>${escapeHtml(t.project_title || '—')}</dd></div>
            <div><dt>Team Members</dt><dd>${membersListItems(t, false) ? `<ol class="members-ol">${membersListItems(t, false)}</ol>` : '—'}</dd></div>
            <div><dt>Leader Contact</dt><dd class="mono">${escapeHtml(t.mobile_no || '—')}</dd></div>
            <div><dt>Scanned Time</dt><dd>${scannedAt}</dd></div>
            <div><dt>Attendance Mode</dt><dd>${isPresent ? (t.marked_by || 'QR Scan') : '—'}</dd></div>
          </dl>
          <button type="button" class="glass-btn-table-action ${isPresent ? 'btn-action-marked' : 'btn-action-unmarked'}" data-team-id="${id}">
            ${isPresent ? 'Mark Not Scanned' : 'Mark Scanned'}
          </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleTeamDetails(id, btn) {
  const open = !expandedTeams.has(id);
  if (open) expandedTeams.add(id); else expandedTeams.delete(id);
  document.querySelector(`tr[data-detail-for="${id}"]`).classList.toggle('hidden', !open);
  btn.closest('tr').classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  btn.setAttribute('aria-label', open ? 'Hide details' : 'View details');
  btn.title = open ? 'Hide details' : 'View details';
}

document.addEventListener('click', e => {
  const actionBtn = e.target.closest('button[data-team-id]');
  if (actionBtn) toggleAttendance(Number(actionBtn.dataset.teamId));

  const detailsBtn = e.target.closest('button[data-details-id]');
  if (detailsBtn) toggleTeamDetails(Number(detailsBtn.dataset.detailsId), detailsBtn);
});

async function toggleAttendance(id) {
  try {
    const res = await fetch('/api/admin/teams/' + id + '/toggle-attendance', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (sessionExpired(res)) return;

    if (res.ok) {
      const data = await res.json();
      loadTeamsTable();
      loadAdminStats();
      showToast(`${teamNamesById.get(id) || 'Team'}: ${data.status}`, 'info');
    } else {
      showToast('Could not update status', 'error');
    }
  } catch {
    showToast('Connection error', 'error');
  }
}

// ─────────────────────────────────────────────
// VENUES & THEMES MANAGEMENT (15 ROOMS SPLIT)
// ─────────────────────────────────────────────
let rawVenuesData = [];
let rawThemesData = [];
let venueDisplayMode = 'venue'; // 'venue' (15 Venues - default) or 'theme' (12 Themes)
let currentThemeFilter = 'all';
let currentThemewiseFilter = 'all';
let currentThemeSearch = '';
const expandedThemes = new Set();

function toggleThemeFilterCustomDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('dropdown-theme-filter-custom');
  const menu = document.getElementById('menu-theme-filter-custom');
  const btn = document.getElementById('btn-theme-filter-trigger');
  const wasOpen = dropdown ? dropdown.classList.contains('open') : false;
  closeDropdowns();
  if (dropdown && !wasOpen) {
    dropdown.classList.add('open');
    if (menu) menu.classList.add('show');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}
window.toggleThemeFilterCustomDropdown = toggleThemeFilterCustomDropdown;

function selectThemewiseCustomFilter(theme, label) {
  currentThemewiseFilter = theme || 'all';
  const labelEl = document.getElementById('theme-filter-selected-label');
  if (labelEl) labelEl.textContent = label || (theme === 'all' ? 'All 12 Themes (282 Teams)' : theme);

  const select = document.getElementById('select-theme-filter');
  if (select) select.value = currentThemewiseFilter;

  // Clear button visibility
  const clearBtn = document.getElementById('theme-active-filter-clear-btn');
  if (clearBtn) {
    if (currentThemewiseFilter !== 'all') clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  // Highlight active dropdown item
  const items = document.querySelectorAll('#menu-theme-filter-custom .dropdown-item');
  items.forEach(item => {
    if (item.dataset.theme === currentThemewiseFilter) item.classList.add('active');
    else item.classList.remove('active');
  });

  handleThemewiseFilter(currentThemewiseFilter);
  closeDropdowns();
}
window.selectThemewiseCustomFilter = selectThemewiseCustomFilter;

function populateThemewiseFilter() {
  const select = document.getElementById('select-theme-filter');
  const menu = document.getElementById('menu-theme-filter-custom');
  const chipsContainer = document.getElementById('theme-quick-chips');

  const currentVal = currentThemewiseFilter;
  const sortedThemes = [...rawThemesData].sort((a, b) => (a.theme || '').localeCompare(b.theme || ''));
  const totalTeams = sortedThemes.reduce((acc, t) => acc + (t.total || 0), 0);

  // Hidden Select Update
  if (select) {
    select.innerHTML = `<option value="all">All 12 Themes (${totalTeams} Teams)</option>` +
      sortedThemes.map(t => `<option value="${escapeHtml(t.theme)}">${escapeHtml(t.theme)} (${t.total} Teams)</option>`).join('');
    select.value = currentVal;
  }

  // Custom Dropdown Menu Update
  if (menu) {
    let itemsHtml = `
      <div class="dropdown-group-header">FILTER BY THEME</div>
      <button type="button" class="dropdown-item ${currentVal === 'all' ? 'active' : ''}" data-theme="all" onclick="selectThemewiseCustomFilter('all', 'All 12 Themes (${totalTeams} Teams)')">
        <span class="dropdown-item-label">All 12 Themes</span>
        <span class="file-tag tag-xlsx" style="background:#f1f5f9; color:#475569; border-color:#cbd5e1;">${totalTeams} Teams</span>
      </button>
    `;
    sortedThemes.forEach(t => {
      const isAct = currentVal === t.theme;
      const safeTheme = escapeHtml(t.theme).replace(/'/g, "\\'");
      itemsHtml += `
        <button type="button" class="dropdown-item ${isAct ? 'active' : ''}" data-theme="${escapeHtml(t.theme)}" onclick="selectThemewiseCustomFilter('${safeTheme}', '${safeTheme} (${t.total} Teams)')">
          <span class="dropdown-item-label">${escapeHtml(t.theme)}</span>
          <span class="file-tag tag-xlsx" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">${t.total}</span>
        </button>
      `;
    });
    menu.innerHTML = itemsHtml;
  }

  // Populate Quick Clickable Chips
  if (chipsContainer) {
    chipsContainer.innerHTML = `
      <button type="button" class="theme-chip ${currentVal === 'all' ? 'active' : ''}" data-theme="all" onclick="selectThemewiseCustomFilter('all', 'All 12 Themes (${totalTeams} Teams)')">All Themes (12)</button>
    ` + sortedThemes.map(t => `
      <button type="button" class="theme-chip ${currentVal === t.theme ? 'active' : ''}" data-theme="${escapeHtml(t.theme)}" onclick="selectThemewiseCustomFilter(this.dataset.theme, '${escapeHtml(t.theme).replace(/'/g, "\\'")} (${t.total} Teams)')">
        ${escapeHtml(t.theme)} (${t.total})
      </button>
    `).join('');
  }

  // Update selected button label
  const labelEl = document.getElementById('theme-filter-selected-label');
  if (labelEl) {
    if (currentVal === 'all') {
      labelEl.textContent = `All 12 Themes (${totalTeams} Teams)`;
    } else {
      const found = sortedThemes.find(t => t.theme === currentVal);
      labelEl.textContent = `${currentVal} (${found ? found.total : 0} Teams)`;
    }
  }

  updateThemewiseFilterBadge();
}

function handleThemewiseFilter(theme) {
  currentThemewiseFilter = theme || 'all';
  const select = document.getElementById('select-theme-filter');
  if (select) select.value = currentThemewiseFilter;

  // Update chip active classes
  const chips = document.querySelectorAll('.theme-chip');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-theme') === currentThemewiseFilter);
  });

  // Update label
  const labelEl = document.getElementById('theme-filter-selected-label');
  if (labelEl && currentThemewiseFilter === 'all') {
    const totalTeams = rawThemesData.reduce((acc, t) => acc + (t.total || 0), 0);
    labelEl.textContent = `All 12 Themes (${totalTeams || 282} Teams)`;
  } else if (labelEl) {
    const found = rawThemesData.find(t => t.theme === currentThemewiseFilter);
    labelEl.textContent = `${currentThemewiseFilter} (${found ? found.total : 0} Teams)`;
  }

  updateThemewiseFilterBadge();

  // If a specific theme is picked, automatically expand the matched cards
  if (currentThemewiseFilter !== 'all') {
    const isVenueMode = (venueDisplayMode === 'venue');
    const sourceData = isVenueMode ? rawVenuesData : rawThemesData;
    sourceData.forEach(g => {
      const matches = isVenueMode 
        ? (g.themes || []).includes(currentThemewiseFilter)
        : (g.theme === currentThemewiseFilter);
      if (matches) expandedThemes.add(getItemKey(g));
    });
  }

  renderThemes();
}
window.handleThemewiseFilter = handleThemewiseFilter;

function clearThemewiseFilter() {
  selectThemewiseCustomFilter('all', 'All 12 Themes (282 Teams)');
}
window.clearThemewiseFilter = clearThemewiseFilter;

function updateThemewiseFilterBadge() {
  const badge = document.getElementById('theme-active-filter-badge');
  const text = document.getElementById('theme-active-filter-text');
  const clearBtn = document.getElementById('theme-active-filter-clear-btn');
  const wrapper = document.querySelector('.theme-filter-select-wrapper');

  if (currentThemewiseFilter && currentThemewiseFilter !== 'all') {
    if (badge) badge.classList.remove('hidden');
    if (text) text.textContent = `Theme: ${currentThemewiseFilter}`;
    if (clearBtn) clearBtn.classList.remove('hidden');
    if (wrapper) wrapper.classList.add('has-active-filter');
  } else {
    if (badge) badge.classList.add('hidden');
    if (clearBtn) clearBtn.classList.add('hidden');
    if (wrapper) wrapper.classList.remove('has-active-filter');
  }
}

function setVenueDisplayMode(mode) {
  venueDisplayMode = mode;
  const btnVenue = document.getElementById('btn-mode-venue');
  const btnTheme = document.getElementById('btn-mode-theme');
  if (btnVenue) btnVenue.classList.toggle('active', mode === 'venue');
  if (btnTheme) btnTheme.classList.toggle('active', mode === 'theme');
  renderThemes();
}

function getItemKey(g) {
  return (venueDisplayMode === 'venue') ? (g.venue || `venue_${g.panel_no}`) : g.theme;
}

function safeThemeDomId(themeName) {
  return 'th-' + encodeURIComponent(themeName || 'theme').replace(/[^a-zA-Z0-9]/g, '_');
}

function updateThemeStats() {
  const isVenueMode = (venueDisplayMode === 'venue');
  const sourceData = isVenueMode ? rawVenuesData : rawThemesData;
  const totalCount = sourceData.length;
  let assignedCount = 0;
  let totalTeams = 0;
  let totalScanned = 0;

  for (const g of sourceData) {
    if (g.venue && g.venue.trim()) assignedCount++;
    totalTeams += (g.total || 0);
    totalScanned += (g.scanned || 0);
  }

  const scannedRate = totalTeams > 0 ? Math.round((totalScanned / totalTeams) * 100) : 0;

  const elTotal = document.getElementById('theme-stat-total');
  const elVenues = document.getElementById('theme-stat-venues');
  const elTeams = document.getElementById('theme-stat-teams');
  const elScanned = document.getElementById('theme-stat-scanned');

  if (elTotal) elTotal.textContent = totalCount;
  if (elVenues) elVenues.textContent = `${assignedCount} / ${totalCount}`;
  if (elTeams) elTeams.textContent = totalTeams;
  if (elScanned) elScanned.textContent = `${scannedRate}%`;
}

async function loadThemes() {
  const list = document.getElementById('themes-grid');
  if (!list) return;
  list.innerHTML = '<div class="qr-loading">Loading venue allocations...</div>';

  try {
    const res = await fetch('/api/admin/themes', { headers: { Authorization: 'Bearer ' + adminToken } });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      list.innerHTML = '<div class="qr-loading">Failed to load venues.</div>';
      return;
    }
    const data = await res.json();
    rawVenuesData = data.venues || [];
    rawThemesData = data.themes || [];
    updateThemeStats();
    populateThemewiseFilter();
    renderThemes();
  } catch (err) {
    console.error('[ERROR] loadThemes:', err);
    list.innerHTML = '<div class="qr-loading">Connection error loading venues.</div>';
  }
}

function renderThemes() {
  const container = document.getElementById('themes-grid');
  if (!container) return;

  const isVenueMode = (venueDisplayMode === 'venue');
  const sourceData = isVenueMode ? rawVenuesData : rawThemesData;
  const query = currentThemeSearch.toLowerCase().trim();
  const filter = currentThemeFilter;

  const filtered = sourceData.filter(g => {
    const hasVenue = Boolean(g.venue && g.venue.trim());
    
    // Themewise filter check
    if (currentThemewiseFilter && currentThemewiseFilter !== 'all') {
      if (isVenueMode) {
        const matchesTheme = (g.themes || []).includes(currentThemewiseFilter);
        if (!matchesTheme) return false;
      } else {
        if (g.theme !== currentThemewiseFilter) return false;
      }
    }

    // Filter chip logic
    if (filter === 'venue_set' && !hasVenue) return false;
    if (filter === 'venue_missing' && hasVenue) return false;
    if (filter === 'scanned' && (!g.scanned || g.scanned === 0)) return false;

    // Search query logic
    // Search query logic (resilient multi-field token matching)
    if (query) {
      if (isVenueMode) {
        const matchVenue = matchesSearchQuery(query, g.venue);
        const matchThemes = (g.themes || []).some(t => matchesSearchQuery(query, t));
        const matchTeam = (g.teams || []).some(t => 
          matchesSearchQuery(query, t.team_code, t.team_name, t.leader_name, t.college_name, t.project_title, t.category, t.members)
        );
        if (!matchVenue && !matchThemes && !matchTeam) return false;
      } else {
        const matchTheme = matchesSearchQuery(query, g.theme);
        const matchVenue = matchesSearchQuery(query, g.venue);
        const matchTeam = (g.teams || []).some(t => 
          matchesSearchQuery(query, t.team_code, t.team_name, t.leader_name, t.college_name, t.project_title, t.category, t.members)
        );
        if (!matchTheme && !matchVenue && !matchTeam) return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="theme-empty-box glass-card">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="theme-empty-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        <div class="theme-empty-title">No matching ${isVenueMode ? 'venues' : 'themes'} found</div>
        <p class="theme-empty-desc">Try clearing your search query or selecting "All".</p>
        <button type="button" class="glass-btn glass-btn-secondary btn-sm" onclick="resetThemeFilters()">Clear Filters</button>
      </div>`;
    updateToggleAllButton(false);
    return;
  }

  // Auto-expand cards if searching to immediately reveal matched teams
  if (query) {
    filtered.forEach(g => expandedThemes.add(getItemKey(g)));
  }

  const allVisibleExpanded = filtered.every(g => expandedThemes.has(getItemKey(g)));
  updateToggleAllButton(allVisibleExpanded);

  container.innerHTML = filtered.map(g => {
    const itemKey = getItemKey(g);
    const domId = safeThemeDomId(itemKey);
    const isOpen = expandedThemes.has(itemKey);
    const hasVenue = Boolean(g.venue && g.venue.trim());
    const rate = g.total > 0 ? Math.round((g.scanned / g.total) * 100) : 0;

    const teamsToShow = (isVenueMode && currentThemewiseFilter && currentThemewiseFilter !== 'all')
      ? (g.teams || []).filter(t => t.category === currentThemewiseFilter)
      : (g.teams || []);
    const matchingScanned = teamsToShow.filter(t => t.is_present).length;

    if (isVenueMode) {
      // ─────────────────────────────────────────────
      // 15 VENUE TILES (DEFAULT) - NO PANEL NUMBER
      // ─────────────────────────────────────────────
      return `
      <div class="theme-card glass-card has-venue ${isOpen ? 'is-open' : ''}" id="${domId}">
        
        <!-- Venue Card Header -->
        <div class="theme-card-header">
          <div class="theme-card-title-group">
            <div class="theme-category-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Venue</span>
            </div>
            <h3 class="theme-card-title">${escapeHtml(g.venue || 'TBD')}</h3>
          </div>

          <div class="theme-card-badges">
            <span class="theme-metric-badge teams-count-badge">${g.total} ${g.total === 1 ? 'Team' : 'Teams'}</span>
            <span class="theme-metric-badge scan-count-badge ${g.scanned > 0 ? 'scanned-active' : ''}">${g.scanned}/${g.total} Scanned</span>
          </div>
        </div>

        <!-- Under Venue: List the Themes -->
        <div class="theme-venue-section">
          <div class="theme-venue-row">
            <div class="theme-venue-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              <span>Assigned Theme${(g.themes && g.themes.length > 1) ? 's' : ''}:</span>
            </div>
            <div class="theme-venue-value is-set">
              ${(g.themes || []).map(t => `<span class="theme-track-pill ${t === currentThemewiseFilter ? 'active-track-pill' : ''}">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Attendance Progress -->
        <div class="theme-progress-strip">
          <div class="theme-progress-track">
            <div class="theme-progress-fill" style="width: ${rate}%;"></div>
          </div>
          <span class="theme-progress-label">${rate}% Scanned</span>
        </div>

        <!-- Expand / Collapse Teams Button -->
        <button type="button" class="theme-card-expand-bar" data-key="${escapeHtml(itemKey)}" data-theme="${escapeHtml(itemKey)}" aria-expanded="${isOpen}">
          <span class="expand-bar-left">
            <svg class="chevron-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            <span class="expand-bar-title">${isOpen ? 'Hide' : 'Show'} ${currentThemewiseFilter !== 'all' ? `Teams for "${escapeHtml(currentThemewiseFilter)}" (${teamsToShow.length} of ${g.total})` : `Registered Teams (${g.total})`}</span>
          </span>
          <span class="expand-bar-summary">${matchingScanned} Present · ${teamsToShow.length - matchingScanned} Pending</span>
        </button>

        <!-- Expandable Teams Roster -->
        <div class="theme-teams-roster-box ${isOpen ? '' : 'hidden'}" id="roster-${domId}">
          <div class="theme-roster-table-wrap">
            <table class="theme-roster-table">
              <colgroup>
                <col style="width: 20%;">
                <col style="width: 26%;">
                <col style="width: 26%;">
                <col style="width: 16%;">
                <col style="width: 12%;">
              </colgroup>
              <thead>
                <tr>
                  <th>Team ID & Name</th>
                  <th>Project & Theme</th>
                  <th>Leader & Members</th>
                  <th>School Name</th>
                  <th style="text-align: center;">Attendance</th>
                </tr>
              </thead>
              <tbody>
                ${teamsToShow.map(t => {
                  const isPresent = Boolean(t.is_present);
                  const scannedAt = t.check_in_time
                    ? new Date(t.check_in_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                    : '';
                  const modeLabel = isPresent ? (t.marked_by === 'Admin' ? 'Present (Admin)' : 'Scanned (QR)') : 'Not Scanned';
                  const membersStr = t.members ? escapeHtml(t.members) : '—';
                  return `
                  <tr class="theme-roster-row ${isPresent ? 'is-present-row' : ''}">
                    <td class="theme-td-code">
                      <div class="theme-roster-team-id-badge">
                        <span class="mono theme-code-badge">${escapeHtml(t.team_code || '—')}</span>
                      </div>
                      <div class="theme-roster-team-name">${escapeHtml(t.team_name || '—')}</div>
                    </td>
                    <td class="theme-td-idea">
                      <div class="theme-roster-project-title">${escapeHtml(t.project_title || '—')}</div>
                      ${t.category ? `<div class="theme-roster-theme-tag">${escapeHtml(t.category)}</div>` : ''}
                    </td>
                    <td class="theme-td-members">
                      <div class="theme-roster-leader"><strong>Leader:</strong> ${escapeHtml(t.leader_name || '—')} ${t.mobile_no ? `(${escapeHtml(t.mobile_no)})` : ''}</div>
                      <div class="theme-roster-member-names"><strong>Members:</strong> ${membersStr}</div>
                    </td>
                    <td class="theme-td-school">
                      <span class="theme-roster-school">${escapeHtml(t.college_name || '—')}</span>
                    </td>
                    <td class="theme-td-attendance">
                      <div class="theme-roster-attend-cell">
                        <span class="status-pill-badge ${isPresent ? 'pill-present' : 'pill-absent'}">
                          ${modeLabel}
                        </span>
                        ${scannedAt ? `<div class="theme-roster-scanned-time">${scannedAt}</div>` : ''}
                        <button type="button" class="glass-btn glass-btn-secondary btn-xs btn-venue-toggle-attend" onclick="toggleAttendanceFromVenue(${t.id}, event)">
                          ${isPresent ? 'Unmark' : 'Mark'}
                        </button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>`;
    }

    // ─────────────────────────────────────────────
    // 12 THEMES MODE (ALTERNATIVE VIEW)
    // ─────────────────────────────────────────────
    return `
    <div class="theme-card glass-card ${hasVenue ? 'has-venue' : 'missing-venue'} ${isOpen ? 'is-open' : ''}" id="${domId}">
      
      <!-- Theme Card Header -->
      <div class="theme-card-header">
        <div class="theme-card-title-group">
          <div class="theme-category-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            <span>Theme Track</span>
          </div>
          <h3 class="theme-card-title">${escapeHtml(g.theme)}</h3>
        </div>

        <div class="theme-card-badges">
          <span class="theme-metric-badge teams-count-badge">${g.total} ${g.total === 1 ? 'Team' : 'Teams'}</span>
          <span class="theme-metric-badge scan-count-badge ${g.scanned > 0 ? 'scanned-active' : ''}">${g.scanned}/${g.total} Scanned</span>
        </div>
      </div>

      <!-- Sitting Place / Venue Section -->
      <div class="theme-venue-section">
        <div class="theme-venue-row" id="venue-row-${domId}">
          <div class="theme-venue-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>Sitting Place:</span>
          </div>
          <div class="theme-venue-value ${hasVenue ? 'is-set' : 'is-unset'}">
            ${hasVenue ? escapeHtml(g.venue) : 'Not assigned yet'}
          </div>
          <button type="button" class="btn-theme-venue-edit" data-theme="${escapeHtml(g.theme)}" title="${hasVenue ? 'Edit sitting place' : 'Assign sitting place'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span>${hasVenue ? 'Edit' : 'Assign'}</span>
          </button>
        </div>

        <!-- Inline Venue Editor -->
        <div class="theme-venue-editor hidden" id="venue-editor-${domId}">
          <div class="theme-venue-editor-inner">
            <input type="text" class="theme-venue-input" id="venue-input-${domId}" value="${escapeHtml(g.venue || '')}" placeholder="e.g. RJ Block - Idea Lab I" autocomplete="off" />
            <div class="theme-venue-editor-actions">
              <button type="button" class="glass-btn glass-btn-primary btn-xs btn-venue-save" data-theme="${escapeHtml(g.theme)}">Save</button>
              <button type="button" class="glass-btn glass-btn-secondary btn-xs btn-venue-cancel" data-theme="${escapeHtml(g.theme)}">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Attendance Progress -->
      <div class="theme-progress-strip">
        <div class="theme-progress-track">
          <div class="theme-progress-fill" style="width: ${rate}%;"></div>
        </div>
        <span class="theme-progress-label">${rate}% Scanned</span>
      </div>

      <!-- Expand / Collapse Teams Button -->
      <button type="button" class="theme-card-expand-bar" data-key="${escapeHtml(itemKey)}" data-theme="${escapeHtml(itemKey)}" aria-expanded="${isOpen}">
        <span class="expand-bar-left">
          <svg class="chevron-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          <span class="expand-bar-title">${isOpen ? 'Hide' : 'Show'} Registered Teams (${g.total})</span>
        </span>
        <span class="expand-bar-summary">${g.scanned} Present · ${g.total - g.scanned} Pending</span>
      </button>

      <!-- Expandable Teams Roster -->
      <div class="theme-teams-roster-box ${isOpen ? '' : 'hidden'}" id="roster-${domId}">
        <div class="theme-roster-table-wrap">
          <table class="theme-roster-table">
            <colgroup>
              <col style="width: 20%;">
              <col style="width: 26%;">
              <col style="width: 26%;">
              <col style="width: 16%;">
              <col style="width: 12%;">
            </colgroup>
            <thead>
              <tr>
                <th>Team ID & Name</th>
                <th>Project Title</th>
                <th>Leader & Members</th>
                <th>School Name</th>
                <th style="text-align: center;">Attendance</th>
              </tr>
            </thead>
            <tbody>
              ${(g.teams || []).map(t => {
                const isPresent = Boolean(t.is_present);
                const scannedAt = t.check_in_time
                  ? new Date(t.check_in_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                  : '';
                const modeLabel = isPresent ? (t.marked_by === 'Admin' ? 'Present (Admin)' : 'Scanned (QR)') : 'Not Scanned';
                const membersStr = t.members ? escapeHtml(t.members) : '—';
                return `
                <tr class="theme-roster-row ${isPresent ? 'is-present-row' : ''}">
                  <td class="theme-td-code">
                    <div class="theme-roster-team-id-badge">
                      <span class="mono theme-code-badge">${escapeHtml(t.team_code || '—')}</span>
                    </div>
                    <div class="theme-roster-team-name">${escapeHtml(t.team_name || '—')}</div>
                    ${t.venue ? `<div class="theme-roster-venue-hint">${escapeHtml(t.venue)}</div>` : ''}
                  </td>
                  <td class="theme-td-idea">
                    <div class="theme-roster-project-title">${escapeHtml(t.project_title || '—')}</div>
                  </td>
                  <td class="theme-td-members">
                    <div class="theme-roster-leader"><strong>Leader:</strong> ${escapeHtml(t.leader_name || '—')} ${t.mobile_no ? `(${escapeHtml(t.mobile_no)})` : ''}</div>
                    <div class="theme-roster-member-names"><strong>Members:</strong> ${membersStr}</div>
                  </td>
                  <td class="theme-td-school">
                    <span class="theme-roster-school">${escapeHtml(t.college_name || '—')}</span>
                  </td>
                  <td class="theme-td-attendance">
                    <div class="theme-roster-attend-cell">
                      <span class="status-pill-badge ${isPresent ? 'pill-present' : 'pill-absent'}">
                        ${modeLabel}
                      </span>
                      ${scannedAt ? `<div class="theme-roster-scanned-time">${scannedAt}</div>` : ''}
                      <button type="button" class="glass-btn glass-btn-secondary btn-xs btn-venue-toggle-attend" onclick="toggleAttendanceFromVenue(${t.id}, event)">
                        ${isPresent ? 'Unmark' : 'Mark'}
                      </button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>`;
  }).join('');
}

function handleThemeSearch() {
  const input = document.getElementById('theme-search-input');
  currentThemeSearch = input ? input.value : '';
  renderThemes();
}

function closeDropdowns() {
  document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'));
  const exportBtn = document.getElementById('btn-venue-export-dropdown');
  if (exportBtn) exportBtn.setAttribute('aria-expanded', 'false');
  const filterBtn = document.getElementById('btn-theme-filter-dropdown');
  if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false');
  const themeFilterBtn = document.getElementById('btn-theme-filter-trigger');
  if (themeFilterBtn) themeFilterBtn.setAttribute('aria-expanded', 'false');
  const allocPanelBtn = document.getElementById('btn-alloc-panel-trigger');
  if (allocPanelBtn) allocPanelBtn.setAttribute('aria-expanded', 'false');
}

function toggleAttendanceExportDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('dropdown-attendance-export');
  const menu = document.getElementById('menu-attendance-export');
  const wasOpen = dropdown ? dropdown.classList.contains('open') : false;
  closeDropdowns();
  if (dropdown && !wasOpen) {
    dropdown.classList.add('open');
    if (menu) menu.classList.add('show');
  }
}
window.toggleAttendanceExportDropdown = toggleAttendanceExportDropdown;

function toggleVenueExportDropdown(event) {
  if (event) {
    event.stopPropagation();
  }
  const dropdown = document.getElementById('dropdown-venue-export');
  const menu = document.getElementById('menu-venue-export');
  const btn = document.getElementById('btn-venue-export-dropdown');
  const wasOpen = dropdown ? dropdown.classList.contains('open') : false;
  closeDropdowns();
  if (dropdown && !wasOpen) {
    dropdown.classList.add('open');
    if (menu) menu.classList.add('show');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

function toggleThemeFilterDropdown(event) {
  if (event) {
    event.stopPropagation();
  }
  const dropdown = document.getElementById('dropdown-theme-filter');
  const menu = document.getElementById('menu-theme-filter');
  const btn = document.getElementById('btn-theme-filter-dropdown');
  const wasOpen = dropdown ? dropdown.classList.contains('open') : false;
  closeDropdowns();
  if (dropdown && !wasOpen) {
    dropdown.classList.add('open');
    if (menu) menu.classList.add('show');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

function selectThemeFilter(filterKey, label) {
  currentThemeFilter = filterKey;
  const filterLabels = {
    all: 'All',
    venue_set: 'Venue Set',
    venue_missing: 'Venue Missing',
    scanned: 'Scanned > 0'
  };
  const displayLabel = label || filterLabels[filterKey] || 'All';

  // Update button label to "Filter: <label>"
  const btnLabel = document.getElementById('theme-filter-btn-label');
  if (btnLabel) {
    btnLabel.textContent = `Filter: ${displayLabel}`;
  }

  // Update .active class on dropdown items
  const items = document.querySelectorAll('#menu-theme-filter .dropdown-item');
  items.forEach(item => {
    if (item.dataset.filter === filterKey) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Backward-compatibility with pill tabs if any exist
  const tabs = document.querySelectorAll('.theme-filter-pill .filter-tab');
  tabs.forEach(t => {
    if (t.dataset.themeFilter === filterKey) t.classList.add('active');
    else t.classList.remove('active');
  });

  closeDropdowns();
  renderThemes();
}

function setThemeFilter(filter, btn) {
  selectThemeFilter(filter);
}

function resetThemeFilters() {
  currentThemeFilter = 'all';
  currentThemeSearch = '';
  const searchInput = document.getElementById('theme-search-input');
  if (searchInput) searchInput.value = '';
  const tabs = document.querySelectorAll('.theme-filter-pill .filter-tab');
  tabs.forEach(t => {
    if (t.dataset.themeFilter === 'all') t.classList.add('active');
    else t.classList.remove('active');
  });
  renderThemes();
}

function updateToggleAllButton(allExpanded) {
  const btnText = document.getElementById('btn-toggle-all-themes-text');
  if (btnText) btnText.textContent = allExpanded ? 'Collapse All' : 'Expand All';
}

function toggleAllThemes() {
  const isVenueMode = (venueDisplayMode === 'venue');
  const sourceData = isVenueMode ? rawVenuesData : rawThemesData;
  const visibleKeys = sourceData.map(getItemKey);

  const allExpanded = visibleKeys.every(k => expandedThemes.has(k));

  if (allExpanded) {
    visibleKeys.forEach(k => expandedThemes.delete(k));
  } else {
    visibleKeys.forEach(k => expandedThemes.add(k));
  }
  renderThemes();
}

function showVenueEditor(themeName) {
  const domId = safeThemeDomId(themeName);
  const row = document.getElementById('venue-row-' + domId);
  const editor = document.getElementById('venue-editor-' + domId);
  const input = document.getElementById('venue-input-' + domId);

  if (row) row.classList.add('hidden');
  if (editor) editor.classList.remove('hidden');
  if (input) {
    input.focus();
    input.select();
  }
}

function cancelVenueEditor(themeName) {
  const domId = safeThemeDomId(themeName);
  const row = document.getElementById('venue-row-' + domId);
  const editor = document.getElementById('venue-editor-' + domId);
  const input = document.getElementById('venue-input-' + domId);

  // Restore previous value
  const item = rawThemesData.find(g => g.theme === themeName);
  if (input && item) input.value = item.venue || '';

  if (editor) editor.classList.add('hidden');
  if (row) row.classList.remove('hidden');
}

async function saveThemeVenue(themeName) {
  const domId = safeThemeDomId(themeName);
  const input = document.getElementById('venue-input-' + domId);
  const newVal = input ? input.value.trim() : '';

  try {
    const res = await fetch('/api/admin/themes/venue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({ theme: themeName, venue: newVal })
    });

    if (sessionExpired(res)) return;
    if (!res.ok) {
      showToast('Failed to update sitting place', 'error');
      return;
    }

    // Update in local data
    const item = rawThemesData.find(g => g.theme === themeName);
    if (item) item.venue = newVal || null;

    updateThemeStats();
    renderThemes();
    showToast(newVal ? `Sitting place saved for ${themeName}` : `Sitting place cleared for ${themeName}`, 'success');
  } catch (err) {
    console.error('[ERROR] saveThemeVenue:', err);
    showToast('Connection error updating sitting place', 'error');
  }
}

// Global delegated event listeners for Themes tab interactions
document.addEventListener('click', e => {
  // 1. Edit / Assign Venue button
  const editBtn = e.target.closest('.btn-theme-venue-edit');
  if (editBtn) {
    const theme = editBtn.dataset.theme;
    if (theme) showVenueEditor(theme);
    return;
  }

  // 2. Save Venue button
  const saveBtn = e.target.closest('.btn-venue-save');
  if (saveBtn) {
    const theme = saveBtn.dataset.theme;
    if (theme) saveThemeVenue(theme);
    return;
  }

  // 3. Cancel Venue button
  const cancelBtn = e.target.closest('.btn-venue-cancel');
  if (cancelBtn) {
    const theme = cancelBtn.dataset.theme;
    if (theme) cancelVenueEditor(theme);
    return;
  }

  // 4. Expand / Collapse Theme card button
  const expandBar = e.target.closest('.theme-card-expand-bar');
  if (expandBar) {
    const key = expandBar.dataset.key || expandBar.dataset.theme;
    if (key) {
      if (expandedThemes.has(key)) expandedThemes.delete(key);
      else expandedThemes.add(key);
      renderThemes();
    }
    return;
  }
});

// Support Enter and Escape key in venue input
document.addEventListener('keydown', e => {
  if (!e.target || !e.target.classList.contains('theme-venue-input')) return;
  const editor = e.target.closest('.theme-venue-editor');
  if (!editor) return;
  const saveBtn = editor.querySelector('.btn-venue-save');
  const cancelBtn = editor.querySelector('.btn-venue-cancel');
  const theme = saveBtn ? saveBtn.dataset.theme : null;
  if (!theme) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    saveThemeVenue(theme);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelVenueEditor(theme);
  }
});

async function exportExcel() {
  if (!adminToken) return;
  try {
    const res = await fetch('/api/admin/export', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      showToast('Export failed', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RMK_Junior_Hackathon_2026_Master_Attendance.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Excel downloaded', 'success');
  } catch {
    showToast('Download error', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// VENUE-WISE DOWNLOAD HANDLERS (ADMIN AUTHENTICATED)
// ─────────────────────────────────────────────────────────────
window.adminAuth = window.adminAuth || {
  get token() { return adminToken; }
};

async function exportVenueDoc() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  const btn = document.getElementById('btn-export-venue-doc');
  try {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    showToast('Preparing Word document...', 'info');
    const res = await fetch('/api/admin/export/venue-doc', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download venue Word document', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Venue-wise Word document downloaded', 'success');
  } catch (err) {
    console.error('exportVenueDoc error:', err);
    showToast('Download error. Please check connection.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

async function exportVenueExcel() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  const btn = document.getElementById('btn-export-venue-excel');
  try {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    showToast('Preparing Excel workbook...', 'info');
    const res = await fetch('/api/admin/export/venue-excel', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download venue Excel workbook', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Venue-wise Excel workbook downloaded', 'success');
  } catch (err) {
    console.error('exportVenueExcel error:', err);
    showToast('Download error. Please check connection.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}



async function exportVenuePdf() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  const btn = document.getElementById('btn-export-venue-pdf');
  try {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    showToast('Preparing PDF document...', 'info');
    const res = await fetch('/api/admin/export/venue-pdf', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download venue PDF document', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RMK_Junior_Hackathon_2026_Venue_Wise_Teams.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Venue-wise PDF document downloaded', 'success');
  } catch (err) {
    console.error('exportVenuePdf error:', err);
    showToast('Download error. Please check connection.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}
window.exportVenuePdf = exportVenuePdf;
window.exportVenueDoc = exportVenueDoc;
window.exportVenueExcel = exportVenueExcel;

// ─────────────────────────────────────────────────────────────
// MASTER ATTENDANCE DOWNLOAD HANDLERS (ADMIN AUTHENTICATED)
// ─────────────────────────────────────────────────────────────
async function exportMasterPdf() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  try {
    showToast('Preparing Master Attendance PDF...', 'info');
    const res = await fetch('/api/admin/export/master-pdf', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download Master Attendance PDF', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RMK_Junior_Hackathon_2026_Master_Attendance.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Master Attendance PDF downloaded', 'success');
  } catch (err) {
    console.error('exportMasterPdf error:', err);
    showToast('Download error. Please check connection.', 'error');
  }
}

async function exportMasterDoc() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  try {
    showToast('Preparing Master Attendance Word document...', 'info');
    const res = await fetch('/api/admin/export/master-doc', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download Master Attendance Word document', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RMK_Junior_Hackathon_2026_Master_Attendance.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Master Attendance Word document downloaded', 'success');
  } catch (err) {
    console.error('exportMasterDoc error:', err);
    showToast('Download error. Please check connection.', 'error');
  }
}
window.exportMasterPdf = exportMasterPdf;
window.exportMasterDoc = exportMasterDoc;

// ─────────────────────────────────────────────────────────────
// THEME-WISE DOWNLOAD HANDLERS (ADMIN AUTHENTICATED)
// ─────────────────────────────────────────────────────────────
async function exportThemePdf() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  const btn = document.getElementById('btn-export-theme-pdf');
  try {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    showToast('Preparing Themewise PDF document...', 'info');
    const res = await fetch('/api/admin/export/theme-pdf', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download theme PDF document', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Themewise PDF document downloaded', 'success');
  } catch (err) {
    console.error('exportThemePdf error:', err);
    showToast('Download error. Please check connection.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

async function exportThemeDoc() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  const btn = document.getElementById('btn-export-theme-doc');
  try {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    showToast('Preparing Themewise Word document...', 'info');
    const res = await fetch('/api/admin/export/theme-doc', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download theme Word document', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Themewise Word document downloaded', 'success');
  } catch (err) {
    console.error('exportThemeDoc error:', err);
    showToast('Download error. Please check connection.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

async function exportThemeExcel() {
  const token = (window.adminAuth && window.adminAuth.token) || adminToken;
  if (!token) {
    showToast('Please log in as admin', 'error');
    return;
  }
  const btn = document.getElementById('btn-export-theme-excel');
  try {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    const selectedTheme = (currentThemewiseFilter && currentThemewiseFilter !== 'all') ? currentThemewiseFilter : '';
    showToast(selectedTheme ? `Preparing Excel workbook for ${selectedTheme}...` : 'Preparing Themewise Excel workbook...', 'info');
    const queryUrl = selectedTheme
      ? `/api/admin/export/theme-excel?theme=${encodeURIComponent(selectedTheme)}`
      : '/api/admin/export/theme-excel';

    const res = await fetch(queryUrl, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to download theme Excel workbook', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedTheme 
      ? `RMK_Junior_Hackathon_2026_${selectedTheme.replace(/[^a-zA-Z0-9]/g, '_')}_Teams.xlsx`
      : 'RMK_Junior_Hackathon_2026_Theme_Wise_Teams.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Themewise Excel workbook downloaded', 'success');
  } catch (err) {
    console.error('exportThemeExcel error:', err);
    showToast('Download error. Please check connection.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

window.exportThemePdf = exportThemePdf;
window.exportThemeDoc = exportThemeDoc;
window.exportThemeExcel = exportThemeExcel;

// ─────────────────────────────────────────────────────────────
// PERMANENT HACKATHON DAY QR CODE
// ─────────────────────────────────────────────────────────────
async function loadPermanentVenueQR() {
  const container = document.getElementById('admin-qr-container');

  if (permanentQRCodeData) {
    container.innerHTML = `<img src="${permanentQRCodeData}" alt="Hackathon Day Presence QR Standee" />`;
    return;
  }

  try {
    const res = await fetch('/api/admin/qr-code', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (sessionExpired(res)) return;
    if (!res.ok) {
      container.innerHTML = '<div class="qr-loading">Failed to load Standee QR.</div>';
      return;
    }

    const data = await res.json();
    permanentQRCodeData = data.qr_code;

    container.innerHTML = `<img src="${permanentQRCodeData}" alt="Hackathon Day Presence QR Standee" />`;
  } catch {
    container.innerHTML = '<div class="qr-loading">Connection error loading Standee QR.</div>';
  }
}

function downloadQRCode() {
  if (!permanentQRCodeData) return;
  const a = document.createElement('a');
  a.href = permanentQRCodeData;
  a.download = 'RMK_Junior_Hackathon_2026_Venue_Standee_QR.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Standee QR downloaded successfully', 'success');
}

function printQRCode() {
  const printable = document.getElementById('standee-printable-card');
  if (!printable) return;

  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>RMK Jr. Hackathon 2026 Standee</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #ffffff;
            color: #0f172a;
          }
          .card {
            text-align: center;
            border: 2.5px solid #0f172a;
            border-radius: 24px;
            padding: 44px 36px 40px 36px;
            max-width: 580px;
            width: 100%;
            box-sizing: border-box;
            background: #ffffff;
          }
          .logos {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 18px;
            margin-bottom: 24px;
          }
          .logos img { height: 52px; object-fit: contain; }
          .pipe { width: 2px; height: 38px; background: #10b981; }
          h1 {
            margin: 0 0 24px 0;
            font-size: 27px;
            font-weight: 900;
            letter-spacing: -0.01em;
            color: #0f172a;
          }
          .qr {
            margin: 0 auto 18px auto;
          }
          .qr img {
            width: 320px;
            height: 320px;
            margin: 0 auto;
            display: block;
          }
          .portal-link-box {
            margin: 16px auto 18px auto;
            padding: 12px 24px;
            border: 2px solid #059669;
            border-radius: 12px;
            background: #f0fdf4;
            display: inline-block;
            max-width: 90%;
            box-sizing: border-box;
            text-align: center;
          }
          .portal-link-label {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #065f46;
            margin-bottom: 5px;
            display: block;
          }
          .portal-link-url {
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            font-size: 15.5px;
            font-weight: 800;
            color: #047857;
            letter-spacing: -0.01em;
            word-break: break-all;
            display: block;
          }
          .instruction {
            margin: 0;
            font-size: 14.5px;
            font-weight: 600;
            color: #475569;
            line-height: 1.5;
            max-width: 440px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logos">
            <img src="/assets/rmk_group_logo.png" alt="RMK Group" />
            <div class="pipe"></div>
            <img src="/assets/rmk_jr_hackathon_2026_logo.png" alt="RMK Jr. Hackathon 2026" />
          </div>
          <h1>RMK Junior Hackathon 2026</h1>
          <div class="qr"><img src="${permanentQRCodeData}" alt="Hackathon Presence QR Code" /></div>
          <div class="portal-link-box">
            <span class="portal-link-label">Website / Attendance Portal</span>
            <span class="portal-link-url">rmkjuniorhackathon2026.onrender.com</span>
          </div>
          <p class="instruction">Scan with any phone camera or log in to the portal above to mark team presence.</p>
        </div>
      </body>
    </html>
  `);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS & HELPERS
// ─────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast-notify');
  if (!toast) return;

  toast.textContent = msg;
  toast.className = 'glass-toast toast-' + type;
  toast.classList.remove('hidden');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');

  if (isLoading) {
    btn.disabled = true;
    if (text) text.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
  } else {
    btn.disabled = false;
    if (text) text.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Universal resilient search matching helper (case-insensitive, punctuation-agnostic, token-based)
function normalizeSearchText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .replace(/[.,\-_/\\#()\[\]{}:;'"!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSearchQuery(query, ...fields) {
  if (!query) return true;
  const qClean = normalizeSearchText(query);
  if (!qClean) return true;

  // Split query into individual word tokens
  const tokens = qClean.split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  // Build searchable text from all provided fields
  const haystack = normalizeSearchText(fields.filter(Boolean).join(' '));

  // Every token must be present somewhere in the haystack
  return tokens.every(token => haystack.includes(token));
}
window.normalizeSearchText = normalizeSearchText;
window.matchesSearchQuery = matchesSearchQuery;

// Wire document click to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-dropdown')) {
    closeDropdowns();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.keyCode === 27) {
    closeDropdowns();
    if (typeof closeRevisionHistoryModal === 'function') closeRevisionHistoryModal();
    if (typeof closeCreateDraftModal === 'function') closeCreateDraftModal();
    if (typeof closePublishModal === 'function') closePublishModal();
    if (typeof closeAdminEvalModal === 'function') closeAdminEvalModal();
    if (typeof closeEvaluationModal === 'function') closeEvaluationModal();
    if (typeof closeEvalConfirmModal === 'function') closeEvalConfirmModal();
    if (typeof closeJudgePasswordModal === 'function') closeJudgePasswordModal();
    if (typeof closeMapModal === 'function') closeMapModal();
  }
});

window.toggleVenueExportDropdown = toggleVenueExportDropdown;
window.toggleThemeFilterDropdown = toggleThemeFilterDropdown;
window.selectThemeFilter = selectThemeFilter;
window.closeDropdowns = closeDropdowns;

async function toggleAttendanceFromVenue(id, event) {
  if (event) event.stopPropagation();
  try {
    const res = await fetch(`/api/admin/teams/${id}/toggle-attendance`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to update attendance');
      return;
    }
    // Refresh themes data to reflect immediately in venue statistics and team rows
    await loadThemes();
  } catch (err) {
    console.error('Error toggling attendance from venue:', err);
    alert('Failed to update attendance due to connection error.');
  }
}


// ════════════════════════════════════════════════════════════════
//  JURY MANAGEMENT & EVALUATION PORTAL CLIENT LOGIC
// ════════════════════════════════════════════════════════════════

// ─── Jury Admin State ───
let rawJuryPanelsData = [];
let rawJuryEvalsData = [];
let currentJuryFilter = 'all';
let currentJurySearch = '';
let jurySearchDebounceTimer = null;
let juryEvalsDebounceTimer = null;

// ─── Judge State ───
let currentJudgeCriteria = [];
let currentJudgeProjects = [];
let currentEvalTeamId = null;
let currentEvalExisting = null;

// ─────────────────────────────────────────────────────────────
// JURY ADMINISTRATOR FLOW
// ─────────────────────────────────────────────────────────────

async function handleJuryAdminLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('jury-admin-username');
  const passwordInput = document.getElementById('jury-admin-password');
  const errBox = document.getElementById('jury-admin-login-error');
  const submitBtn = document.getElementById('btn-jury-admin-login');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');

  errBox.classList.add('hidden');
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/jury-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value
      })
    });

    const data = await res.json();
    if (!res.ok) {
      errBox.textContent = data.error || 'Authentication failed.';
      errBox.classList.remove('hidden');
      return;
    }

    juryAdminToken = data.token;
    localStorage.setItem('rmk_jury_admin_token', juryAdminToken);
    initJuryAdminDashboard();
    showView('view-jury-admin');
    showToast(`Welcome, ${data.name || 'Jury Administrator'}`, 'info');
  } catch (err) {
    console.error('[ERROR] handleJuryAdminLogin:', err);
    errBox.textContent = 'Network or server error. Please try again.';
    errBox.classList.remove('hidden');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

function logoutJuryAdmin() {
  juryAdminToken = null;
  localStorage.removeItem('rmk_jury_admin_token');
  showView('view-jury-admin-login');
  showToast('Logged out of Jury Admin portal', 'info');
}

function initJuryAdminDashboard() {
  loadJuryAdminStats();
  loadJuryAdminPanels();
  loadJuryAdminEvaluations();
}

function switchJuryAdminSection(secName) {
  const secPanels = document.getElementById('jury-admin-sec-panels');
  const secEvals = document.getElementById('jury-admin-sec-evals');
  const btnPanels = document.getElementById('jlink-panels');
  const btnEvals = document.getElementById('jlink-evals');

  if (secName === 'panels') {
    secPanels.classList.remove('hidden');
    secPanels.classList.add('active');
    secEvals.classList.add('hidden');
    secEvals.classList.remove('active');
    btnPanels.classList.add('active');
    btnEvals.classList.remove('active');
    loadJuryAdminStats();
    loadJuryAdminPanels();
  } else if (secName === 'evals') {
    secEvals.classList.remove('hidden');
    secEvals.classList.add('active');
    secPanels.classList.add('hidden');
    secPanels.classList.remove('active');
    btnEvals.classList.add('active');
    btnPanels.classList.remove('active');
    loadJuryAdminEvaluations();
  }
}

async function loadJuryAdminStats() {
  if (!juryAdminToken) return;
  try {
    const res = await fetch('/api/jury-admin/stats', {
      headers: { Authorization: 'Bearer ' + juryAdminToken }
    });
    if (res.status === 401) return logoutJuryAdmin();
    if (!res.ok) return;

    const data = await res.json();
    document.getElementById('jstat-panels').textContent = data.total_panels ?? 15;
    document.getElementById('jstat-judges').textContent = data.total_judges ?? 30;
    document.getElementById('jstat-registered').textContent = data.registered_judges ?? 0;
    document.getElementById('jstat-pending').textContent = data.pending_registrations ?? 0;
    document.getElementById('jstat-active').textContent = data.active_judges ?? 30;
    document.getElementById('jstat-evals').textContent = data.evaluations_completed ?? 0;
  } catch (err) {
    console.warn('[WARN] loadJuryAdminStats:', err);
  }
}

async function loadJuryAdminPanels() {
  if (!juryAdminToken) return;
  const grid = document.getElementById('jury-panels-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/jury-admin/panels', {
      headers: { Authorization: 'Bearer ' + juryAdminToken }
    });
    if (res.status === 401) return logoutJuryAdmin();
    if (!res.ok) {
      grid.innerHTML = '<div class="qr-loading">Failed to load judging panels.</div>';
      return;
    }

    const data = await res.json();
    rawJuryPanelsData = data.panels || [];
    renderJuryPanels();
  } catch (err) {
    console.error('[ERROR] loadJuryAdminPanels:', err);
    grid.innerHTML = '<div class="qr-loading">Connection error loading panels.</div>';
  }
}

function handleJuryAdminSearch() {
  clearTimeout(jurySearchDebounceTimer);
  jurySearchDebounceTimer = setTimeout(() => {
    currentJurySearch = document.getElementById('jury-admin-search-input').value.trim().toLowerCase();
    renderJuryPanels();
  }, 250);
}

function setJuryAdminFilter(filterVal, btn) {
  currentJuryFilter = filterVal;
  document.querySelectorAll('#jury-admin-sec-panels .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderJuryPanels();
}

function renderJuryPanels() {
  const grid = document.getElementById('jury-panels-grid');
  if (!grid) return;

  const query = currentJurySearch;
  const filter = currentJuryFilter;

  const filtered = rawJuryPanelsData.filter(panel => {
    const internal = panel.internal_judge;
    const external = panel.external_judge;

    // Filter chip logic
    if (filter === 'registered') {
      const anyRegistered = (internal && internal.is_registered) || (external && external.is_registered);
      if (!anyRegistered) return false;
    } else if (filter === 'pending') {
      const anyPending = (internal && !internal.is_registered) || (external && !external.is_registered);
      if (!anyPending) return false;
    }

    // Search query (resilient multi-field token matching)
    if (query) {
      return matchesSearchQuery(
        query,
        panel.panel_code,
        panel.panel_name,
        panel.venue,
        internal && internal.username,
        external && external.username,
        internal && internal.profile && internal.profile.full_name,
        external && external.profile && external.profile.full_name,
        internal && internal.profile && internal.profile.organization,
        external && external.profile && external.profile.organization
      );
    }

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="qr-loading">No judging panels match the search / filter.</div>';
    return;
  }

  grid.innerHTML = filtered.map(panel => {
    return `
      <div class="jury-panel-card">
        <div class="jury-panel-head">
          <div class="jury-panel-title-wrap">
            <span class="jury-panel-code-pill">${escapeHtml(panel.panel_code)}</span>
            <span class="jury-panel-name">${escapeHtml(panel.panel_name)}</span>
          </div>
          <span class="status-pill-badge ${panel.is_active ? 'pill-present' : 'pill-absent'}">
            ${panel.is_active ? 'Active' : 'Disabled'}
          </span>
        </div>

        <div class="jury-panel-judges">
          ${renderJudgeSubcard(panel.internal_judge, 'INTERNAL')}
          ${renderJudgeSubcard(panel.external_judge, 'EXTERNAL')}
        </div>
      </div>
    `;
  }).join('');
}

function renderJudgeSubcard(judge, type) {
  if (!judge) {
    return `<div class="jury-judge-subcard"><span class="judge-profile-pending">No account provisioned</span></div>`;
  }

  const isInternal = type === 'INTERNAL';
  const typeClass = isInternal ? 'type-internal' : 'type-external';
  const typeLabel = isInternal ? 'Internal Judge' : 'External Judge';

  let profileHtml = '';
  if (judge.is_registered && judge.profile) {
    profileHtml = `
      <div class="judge-profile-registered">${escapeHtml(judge.profile.full_name)}</div>
      <div class="judge-profile-meta-text">${escapeHtml(judge.profile.designation || '—')} • ${escapeHtml(judge.profile.organization || '—')}</div>
      <div class="judge-profile-meta-text mono">${escapeHtml(judge.profile.email)} | ${escapeHtml(judge.profile.phone_no)}</div>
    `;
  } else {
    profileHtml = `<div class="judge-profile-pending">Registration Pending (Not completed yet)</div>`;
  }

  return `
    <div class="jury-judge-subcard">
      <div class="judge-subcard-head">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="judge-type-pill ${typeClass}">${typeLabel}</span>
          <span class="judge-username-tag">${escapeHtml(judge.username)}</span>
        </div>
        <span class="status-pill-badge ${judge.is_active ? 'pill-present' : 'pill-absent'}" style="font-size:10px; padding:2px 6px;">
          ${judge.is_active ? 'Active' : 'Disabled'}
        </span>
      </div>

      <div class="judge-subcard-body">
        ${profileHtml}
      </div>

      <div class="judge-subcard-actions">
        <button type="button" class="btn-judge-action" onclick="resetJudgePassword(${judge.id}, '${escapeHtml(judge.username)}')">
          Reset Password
        </button>
        <button type="button" class="btn-judge-action ${judge.is_active ? 'btn-danger-action' : ''}" onclick="toggleJudgeStatus(${judge.id}, '${escapeHtml(judge.username)}')">
          ${judge.is_active ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  `;
}

async function resetJudgePassword(judgeId, username) {
  if (!confirm(`Are you sure you want to reset credentials for ${username} back to default convention (e.g. PanelX-IN)? The judge will be forced to change password on next login.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/jury-admin/judges/${judgeId}/reset-password`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + juryAdminToken }
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to reset password', 'error');
      return;
    }
    showToast(`${username} password reset to: ${data.default_password}`, 'info');
    loadJuryAdminPanels();
  } catch (err) {
    console.error('[ERROR] resetJudgePassword:', err);
    showToast('Failed to reset password due to network error', 'error');
  }
}

async function toggleJudgeStatus(judgeId, username) {
  try {
    const res = await fetch(`/api/jury-admin/judges/${judgeId}/toggle-status`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + juryAdminToken }
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to toggle account status', 'error');
      return;
    }
    showToast(`${username} is now ${data.is_active ? 'Enabled' : 'Disabled'}`, 'info');
    loadJuryAdminPanels();
    loadJuryAdminStats();
  } catch (err) {
    console.error('[ERROR] toggleJudgeStatus:', err);
    showToast('Failed to update status', 'error');
  }
}

async function loadJuryAdminEvaluations() {
  if (!juryAdminToken) return;
  const tbody = document.getElementById('jury-evals-table-body');
  if (!tbody) return;

  try {
    const res = await fetch('/api/jury-admin/evaluations', {
      headers: { Authorization: 'Bearer ' + juryAdminToken }
    });
    if (res.status === 401) return logoutJuryAdmin();
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load evaluations.</td></tr>';
      return;
    }

    const data = await res.json();
    rawJuryEvalsData = data.evaluations || [];
    renderJuryAdminEvaluations(rawJuryEvalsData);
  } catch (err) {
    console.error('[ERROR] loadJuryAdminEvaluations:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Network error loading evaluations.</td></tr>';
  }
}

function handleJuryEvalsSearch() {
  clearTimeout(juryEvalsDebounceTimer);
  juryEvalsDebounceTimer = setTimeout(() => {
    const q = document.getElementById('jury-evals-search-input').value;
    if (!q || !q.trim()) {
      renderJuryAdminEvaluations(rawJuryEvalsData);
      return;
    }
    const filtered = rawJuryEvalsData.filter(e => 
      matchesSearchQuery(q, e.team_code, e.team_name, e.project_title, e.panel_code, e.leader_name, e.category, e.judge_username, e.judge_name)
    );
    renderJuryAdminEvaluations(filtered);
  }, 250);
}

function renderJuryAdminEvaluations(evals) {
  const tbody = document.getElementById('jury-evals-table-body');
  if (!tbody) return;

  if (evals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No evaluations submitted yet. (Waiting for project allocations & judge scoring)</td></tr>';
    return;
  }

  tbody.innerHTML = evals.map(item => {
    const inScore = item.internal_eval ? `${item.internal_eval.score} / 50` : '<span class="text-muted">Pending</span>';
    const exScore = item.external_eval ? `${item.external_eval.score} / 50` : '<span class="text-muted">Pending</span>';
    
    // Combined score is ONLY shown when both are submitted; never coerced to zero
    let combinedHtml = '<span class="status-pill-badge pill-absent">Pending</span>';
    if (item.is_complete && item.combined_score !== null) {
      combinedHtml = `<span class="score-summary-val" style="font-size:16px;">${item.combined_score} / 100</span>`;
    }

    let statusBadge = '<span class="status-pill-badge pill-absent">Pending</span>';
    if (item.is_complete) {
      statusBadge = '<span class="status-pill-badge pill-present">Completed</span>';
    } else if (item.internal_eval || item.external_eval) {
      statusBadge = '<span class="status-pill-badge pill-amber">Partial</span>';
    }

    const hasAnyEval = (item.internal_eval && item.internal_eval.evaluation_id) || (item.external_eval && item.external_eval.evaluation_id);
    const evalIdToView = item.internal_eval ? item.internal_eval.evaluation_id : (item.external_eval ? item.external_eval.evaluation_id : null);

    return `
      <tr>
        <td data-label="Panel"><span class="table-team-id mono">${escapeHtml(item.panel_code)}</span></td>
        <td data-label="Team & Project">
          <div class="table-team-id mono">${escapeHtml(item.team_code)}</div>
          <div class="table-team-title">${escapeHtml(item.project_title || item.team_name)}</div>
          <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(item.school || '—')}</div>
        </td>
        <td data-label="Internal Score">${inScore}</td>
        <td data-label="External Score">${exScore}</td>
        <td data-label="Final Combined Score">${combinedHtml}</td>
        <td data-label="Status">${statusBadge}</td>
        <td data-label="Action">
          ${hasAnyEval ? `
            <button type="button" class="glass-btn glass-btn-secondary btn-sm" onclick="openAdminEvalDetail(${evalIdToView})">
              View Breakdown
            </button>
          ` : '—'}
        </td>
      </tr>
    `;
  }).join('');
}

async function openAdminEvalDetail(evalId) {
  const modal = document.getElementById('modal-jury-admin-eval-detail');
  const body = document.getElementById('admin-eval-modal-body');
  if (!modal || !body) return;

  body.innerHTML = '<div class="qr-loading">Loading breakdown...</div>';
  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  try {
    const res = await fetch(`/api/jury-admin/evaluations/${evalId}`, {
      headers: { Authorization: 'Bearer ' + juryAdminToken }
    });
    const data = await res.json();
    if (!res.ok) {
      body.innerHTML = `<div class="glass-alert-error">${escapeHtml(data.error || 'Failed to load details')}</div>`;
      return;
    }

    const ev = data.evaluation;
    const scores = data.criteria_scores || [];

    body.innerHTML = `
      <div class="admin-eval-detail-summary">
        <div class="admin-eval-badge-line">${escapeHtml(ev.panel_code)} • ${escapeHtml(ev.judge_type)} EVALUATION</div>
        <h3 class="admin-eval-team-title">${escapeHtml(ev.team_name)} (${escapeHtml(ev.team_code)})</h3>
        <p class="admin-eval-proj-desc">${escapeHtml(ev.project_title || '—')}</p>
        <div class="admin-eval-judge-score-row">
          <span>Judge: <strong>${escapeHtml(ev.judge_name || ev.judge_username)}</strong></span>
          <span class="score-summary-val">${ev.total_score} / 50</span>
        </div>
      </div>

      <div class="admin-eval-crit-list">
        <h4 class="admin-eval-section-title">Criteria marks breakdown</h4>
        ${scores.map(s => `
          <div class="admin-eval-crit-item">
            <div>
              <div class="admin-eval-crit-name">${escapeHtml(s.title)}</div>
              <div class="admin-eval-crit-meta">${escapeHtml(s.criterion_code)} • Max ${s.max_score} marks</div>
            </div>
            <div class="mono admin-eval-crit-score">${s.score}</div>
          </div>
        `).join('')}
      </div>

      <div class="admin-eval-remarks-section">
        <h4 class="admin-eval-section-title">Written remarks & feedback</h4>
        <div class="admin-eval-remarks-content">
          ${ev.remarks ? escapeHtml(ev.remarks) : '<span class="text-muted font-italic">No remarks submitted.</span>'}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('[ERROR] openAdminEvalDetail:', err);
    body.innerHTML = '<div class="glass-alert-error">Failed to load evaluation details.</div>';
  }
}

function closeAdminEvalModal() {
  const modal = document.getElementById('modal-jury-admin-eval-detail');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────
// JUDGE AUTHENTICATION, PASSWORD UPDATE & REGISTRATION FLOW
// ─────────────────────────────────────────────────────────────

async function handleJudgeLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('judge-username');
  const passwordInput = document.getElementById('judge-password');
  const errBox = document.getElementById('judge-login-error');
  const submitBtn = document.getElementById('btn-judge-login');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');

  errBox.classList.add('hidden');
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/jury/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value
      })
    });

    const data = await res.json();
    if (!res.ok) {
      errBox.textContent = data.error || 'Login failed.';
      errBox.classList.remove('hidden');
      return;
    }

    judgeToken = data.token;
    localStorage.setItem('rmk_judge_token', judgeToken);
    judgeMeData = data;

    // Check mandatory password change on first login
    if (data.must_change_password) {
      openJudgePasswordModal();
      return;
    }

    // Check profile registration
    if (!data.is_registered) {
      initJudgeRegistration(data);
      return;
    }

    // Otherwise straight to dashboard
    initJudgeDashboard();
  } catch (err) {
    console.error('[ERROR] handleJudgeLogin:', err);
    errBox.textContent = 'Server connection error. Please try again.';
    errBox.classList.remove('hidden');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

function logoutJudge() {
  judgeToken = null;
  judgeMeData = null;
  localStorage.removeItem('rmk_judge_token');
  showView('view-jury-login');
  closeJudgePasswordModal(true);
  closeEvaluationModal();
  showToast('Logged out of Jury portal', 'info');
}

async function refreshJudgeStatus() {
  if (!judgeToken) {
    showView('view-jury-login');
    return;
  }

  try {
    const res = await fetch('/api/jury/me', {
      headers: { Authorization: 'Bearer ' + judgeToken }
    });

    if (res.status === 401) {
      logoutJudge();
      return;
    }

    const data = await res.json();
    judgeMeData = data;

    if (data.must_change_password) {
      showView('view-jury-login');
      openJudgePasswordModal();
      return;
    }

    if (!data.is_registered) {
      initJudgeRegistration(data);
      return;
    }

    initJudgeDashboard();
  } catch (err) {
    console.error('[ERROR] refreshJudgeStatus:', err);
    showView('view-jury-login');
  }
}

function openJudgePasswordModal() {
  const modal = document.getElementById('modal-jury-password');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    const currentInput = document.getElementById('pwd-current');
    const loginPwd = document.getElementById('judge-password');
    if (currentInput) {
      if (loginPwd && loginPwd.value) {
        currentInput.value = loginPwd.value;
      } else if (!currentInput.value) {
        currentInput.value = 'rmkjrh2026';
      }
    }
    const newPwd = document.getElementById('pwd-new');
    if (newPwd) {
      setTimeout(() => newPwd.focus(), 100);
    }
  }
}

function closeJudgePasswordModal(force = false) {
  if (!force && judgeMeData && judgeMeData.must_change_password) {
    // Cannot close modal when password change is mandatory
    return;
  }
  const modal = document.getElementById('modal-jury-password');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

async function handleJudgeChangePassword(e) {
  e.preventDefault();
  const currentPwd = document.getElementById('pwd-current').value;
  const newPwd = document.getElementById('pwd-new').value;
  const confirmPwd = document.getElementById('pwd-confirm').value;
  const errBox = document.getElementById('pwd-error');
  const btn = document.getElementById('btn-save-pwd');
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  errBox.classList.add('hidden');

  if (newPwd.length < 8) {
    errBox.textContent = 'New password must be at least 8 characters long.';
    errBox.classList.remove('hidden');
    return;
  }

  if (newPwd === currentPwd || newPwd === 'rmkjrh2026' || newPwd === 'rmkjh2026') {
    errBox.textContent = 'New password cannot be the default password. Please choose a private password.';
    errBox.classList.remove('hidden');
    return;
  }

  if (newPwd !== confirmPwd) {
    errBox.textContent = 'New password and confirmation do not match.';
    errBox.classList.remove('hidden');
    return;
  }

  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  btn.disabled = true;

  try {
    const res = await fetch('/api/jury/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + judgeToken
      },
      body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
    });

    const data = await res.json();
    if (!res.ok) {
      errBox.textContent = data.error || 'Password update failed';
      errBox.classList.remove('hidden');
      return;
    }

    if (judgeMeData) judgeMeData.must_change_password = false;
    closeJudgePasswordModal(true);
    showToast('Password updated successfully!', 'info');

    // Refresh context and proceed to registration if pending
    await refreshJudgeStatus();
  } catch (err) {
    console.error('[ERROR] handleJudgeChangePassword:', err);
    errBox.textContent = 'Server connection error.';
    errBox.classList.remove('hidden');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
    btn.disabled = false;
  }
}

function initJudgeRegistration(context) {
  const ctx = context || judgeMeData;
  if (!ctx) return;

  showView('view-jury-register');
  document.getElementById('reg-badge-panel').textContent = `Panel ${ctx.panel_code}`;
  
  const isInternal = ctx.judge_type === 'INTERNAL';
  document.getElementById('reg-title').textContent = `${isInternal ? 'Internal' : 'External'} Judge Registration`;

  // Internal vs External field visibility
  document.getElementById('reg-group-institution').classList.toggle('hidden', !isInternal);
  document.getElementById('reg-group-company').classList.toggle('hidden', isInternal);

  // Reset steps
  document.getElementById('reg-step-form').classList.remove('hidden');
  document.getElementById('reg-step-review').classList.add('hidden');
}

function reviewJudgeRegistration() {
  const errBox = document.getElementById('reg-error');
  errBox.classList.add('hidden');

  const fullName = document.getElementById('reg-fullname').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const designation = document.getElementById('reg-designation').value.trim();
  const isInternal = judgeMeData && judgeMeData.judge_type === 'INTERNAL';
  const org = isInternal 
    ? document.getElementById('reg-institution').value.trim() 
    : document.getElementById('reg-company').value.trim();

  if (!fullName || fullName.length < 2) {
    errBox.textContent = 'Please enter your complete full name.';
    errBox.classList.remove('hidden');
    return;
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10) {
    errBox.textContent = 'Please enter a valid 10-digit mobile number.';
    errBox.classList.remove('hidden');
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errBox.textContent = 'Please enter a valid email address.';
    errBox.classList.remove('hidden');
    return;
  }

  if (!designation) {
    errBox.textContent = 'Please specify your designation.';
    errBox.classList.remove('hidden');
    return;
  }

  if (!org) {
    errBox.textContent = isInternal ? 'Please specify your College / Institution name.' : 'Please specify your Company name.';
    errBox.classList.remove('hidden');
    return;
  }

  // Populate review screen
  document.getElementById('rev-fullname').textContent = fullName;
  document.getElementById('rev-phone').textContent = '+91 ' + cleanPhone.slice(-10);
  document.getElementById('rev-email').textContent = email;
  document.getElementById('rev-designation').textContent = designation;
  document.getElementById('rev-org-label').textContent = isInternal ? 'College / Institution' : 'Company / Enterprise';
  document.getElementById('rev-org-val').textContent = org;

  // Switch to review step
  document.getElementById('reg-step-form').classList.add('hidden');
  document.getElementById('reg-step-review').classList.remove('hidden');
}

function editJudgeRegistration() {
  document.getElementById('reg-step-review').classList.add('hidden');
  document.getElementById('reg-step-form').classList.remove('hidden');
}

async function submitJudgeRegistration() {
  const btn = document.getElementById('btn-confirm-register');
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  btn.disabled = true;

  const isInternal = judgeMeData && judgeMeData.judge_type === 'INTERNAL';
  const payload = {
    full_name: document.getElementById('reg-fullname').value.trim(),
    phone_no: document.getElementById('reg-phone').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    designation: document.getElementById('reg-designation').value.trim(),
    institution_name: isInternal ? document.getElementById('reg-institution').value.trim() : null,
    company_name: !isInternal ? document.getElementById('reg-company').value.trim() : null
  };

  try {
    const res = await fetch('/api/jury/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + judgeToken
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Registration failed');
      return;
    }

    showToast('Registration profile saved successfully!', 'info');
    await refreshJudgeStatus();
  } catch (err) {
    console.error('[ERROR] submitJudgeRegistration:', err);
    alert('Server error registering profile.');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────
// JUDGE DASHBOARD & EVALUATION EXECUTION
// ─────────────────────────────────────────────────────────────

let judgeActiveFilter = 'all';
let judgeSearchQuery = '';

async function initJudgeDashboard() {
  showView('view-jury-dashboard');

  try {
    const res = await fetch('/api/jury/me', {
      headers: { Authorization: 'Bearer ' + judgeToken }
    });
    if (!res.ok) return;

    const me = await res.json();
    judgeMeData = me;

    const isInternal = me.judge_type === 'INTERNAL';
    const typeLabel = isInternal ? 'Internal Judge' : 'External Judge';

    const topPanel = document.getElementById('jdash-topbar-panel');
    if (topPanel) topPanel.textContent = `Panel ${me.panel_code}`;
    const topType = document.getElementById('jdash-topbar-type');
    if (topType) topType.textContent = typeLabel;

    const badgePanel = document.getElementById('jdash-badge-panel');
    if (badgePanel) badgePanel.textContent = `Panel ${me.panel_code}`;
    const badgeType = document.getElementById('jdash-badge-type');
    if (badgeType) {
      badgeType.textContent = typeLabel;
      badgeType.className = `status-pill-badge ${isInternal ? 'pill-blue' : 'pill-purple'}`;
    }

    const venueTextEl = document.getElementById('jdash-venue-text');
    if (venueTextEl) venueTextEl.textContent = me.panel_venue || 'Venue Pending';

    if (me.profile) {
      const nameEl = document.getElementById('jdash-name');
      if (nameEl) nameEl.textContent = me.profile.full_name || me.username;
      const avatarEl = document.getElementById('jdash-avatar');
      if (avatarEl) avatarEl.textContent = (me.profile.full_name || me.username).charAt(0).toUpperCase();
      const org = isInternal ? me.profile.institution_name : me.profile.company_name;
      const subEl = document.getElementById('jdash-sub');
      if (subEl) subEl.textContent = `${me.profile.designation || 'Judge'} • ${org || 'RMK Hackathon'}`;
      const emailEl = document.getElementById('jdash-email');
      if (emailEl) emailEl.textContent = me.profile.email || '—';
      const phoneEl = document.getElementById('jdash-phone');
      if (phoneEl) phoneEl.textContent = me.profile.phone_no || '—';
    }

    loadJudgeProjects();
  } catch (err) {
    console.error('[ERROR] initJudgeDashboard:', err);
  }
}

async function loadJudgeProjects() {
  if (!judgeToken) return;

  try {
    const res = await fetch('/api/jury/projects', {
      headers: { Authorization: 'Bearer ' + judgeToken }
    });
    if (!res.ok) return;

    const data = await res.json();
    currentJudgeProjects = data.projects || [];

    if (data.panel && data.panel.venue) {
      const venueTextEl = document.getElementById('jdash-venue-text');
      if (venueTextEl) venueTextEl.textContent = data.panel.venue;
    }

    const total = currentJudgeProjects.length;
    const completed = currentJudgeProjects.filter(p => p.evaluation && p.evaluation.status === 'SUBMITTED').length;
    const pending = total - completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('jdash-stat-total').textContent = total;
    document.getElementById('jdash-stat-completed').textContent = completed;
    document.getElementById('jdash-stat-pending').textContent = pending;
    document.getElementById('jdash-stat-progress').textContent = `${progress}%`;

    const progBar = document.getElementById('jdash-progress-bar');
    if (progBar) progBar.style.width = `${progress}%`;
    const progRatio = document.getElementById('jdash-progress-ratio');
    if (progRatio) progRatio.textContent = `${completed} of ${total} evaluated (${progress}%)`;

    const countAll = document.getElementById('jdash-count-all');
    if (countAll) countAll.textContent = total;
    const countPending = document.getElementById('jdash-count-pending');
    if (countPending) countPending.textContent = pending;
    const countCompleted = document.getElementById('jdash-count-completed');
    if (countCompleted) countCompleted.textContent = completed;

    const emptyBox = document.getElementById('jdash-empty-state');
    const tableContainer = document.getElementById('jdash-projects-container');
    const emptyMsg = document.getElementById('jdash-empty-msg');

    if (total === 0) {
      emptyBox.classList.remove('hidden');
      tableContainer.classList.add('hidden');
      if (judgeMeData) {
        emptyMsg.textContent = `Project allocations for Panel ${judgeMeData.panel_code} will be published by the hackathon coordinators. Once teams are assigned to your panel, your evaluation sheets will appear here automatically.`;
      }
    } else {
      emptyBox.classList.add('hidden');
      tableContainer.classList.remove('hidden');
      renderJudgeProjects();
    }
  } catch (err) {
    console.error('[ERROR] loadJudgeProjects:', err);
  }
}

function handleJudgeProjectSearch() {
  const input = document.getElementById('jdash-search-input');
  judgeSearchQuery = input ? input.value.trim().toLowerCase() : '';
  renderJudgeProjects();
}

function setJudgeProjectFilter(filterName, tabEl) {
  judgeActiveFilter = filterName;
  document.querySelectorAll('[data-jdash-filter]').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  renderJudgeProjects();
}

function renderJudgeProjects() {
  const tbody = document.getElementById('jdash-projects-table-body');
  const mobileList = document.getElementById('jdash-mobile-cards-list');
  if (!tbody || !mobileList) return;

  const query = judgeSearchQuery;
  let projects = currentJudgeProjects || [];

  // Filter by status
  if (judgeActiveFilter === 'completed') {
    projects = projects.filter(p => p.evaluation && p.evaluation.status === 'SUBMITTED');
  } else if (judgeActiveFilter === 'pending') {
    projects = projects.filter(p => !p.evaluation || p.evaluation.status !== 'SUBMITTED');
  }

  // Filter by search query (resilient multi-field token matching)
  if (query) {
    projects = projects.filter(p =>
      matchesSearchQuery(query, p.team_code, p.team_name, p.project_title, p.leader_name, p.category, p.college_name, p.members, p.notes)
    );
  }

  if (projects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center loading-cell">No projects match the current filter or search query.</td></tr>';
    mobileList.innerHTML = '<div class="text-center loading-cell" style="padding: 24px;">No projects match the current filter or search query.</div>';
    return;
  }

  // 1. Desktop Table View
  tbody.innerHTML = projects.map(p => {
    const isSubmitted = p.evaluation && p.evaluation.status === 'SUBMITTED';
    const isDraft = p.evaluation && p.evaluation.status === 'DRAFT';

    let statusPill = '<span class="status-pill-badge pill-absent">Not Evaluated</span>';
    if (isSubmitted) {
      statusPill = `<span class="status-pill-badge pill-present">✓ Evaluated (${p.evaluation.total_score} pts)</span>`;
    } else if (isDraft) {
      statusPill = `<span class="status-pill-badge pill-amber">Draft Saved (${p.evaluation.total_score} pts)</span>`;
    }

    return `
      <tr>
        <td data-label="Team">
          <div class="team-id-name-stacked">
            <span class="table-team-code-sub mono">${escapeHtml(p.team_code || '')}</span>
            <strong class="table-team-name-main">${escapeHtml(p.team_name || '—')}</strong>
          </div>
        </td>
        <td data-label="Project Title"><div class="table-project-title">${escapeHtml(p.project_title || '—')}</div></td>
        <td data-label="Leader Name"><div class="table-leader-name">${escapeHtml(p.leader_name || '—')}</div></td>
        <td data-label="Theme"><span class="status-pill-badge pill-blue">${escapeHtml(p.category || 'General')}</span></td>
        <td data-label="Evaluation Status" style="text-align: center;">${statusPill}</td>
        <td data-label="Action" style="text-align: center;">
          <button type="button" class="glass-btn ${isSubmitted ? 'glass-btn-secondary' : 'glass-btn-primary'} btn-sm btn-eval-compact" onclick="openEvaluationModal(${p.team_id})">
            ${isSubmitted ? 'View' : (isDraft ? 'Resume' : 'Evaluate')}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // 2. Mobile Touch Cards List (Touch target >= 48px, optimized for mobile judges)
  mobileList.innerHTML = projects.map(p => {
    const isSubmitted = p.evaluation && p.evaluation.status === 'SUBMITTED';
    const isDraft = p.evaluation && p.evaluation.status === 'DRAFT';

    let statusPill = '<span class="status-pill-badge pill-absent">Not Evaluated</span>';
    if (isSubmitted) {
      statusPill = `<span class="status-pill-badge pill-present">✓ Evaluated (${p.evaluation.total_score} pts)</span>`;
    } else if (isDraft) {
      statusPill = `<span class="status-pill-badge pill-amber">Draft Saved (${p.evaluation.total_score} pts)</span>`;
    }

    let btnLabel = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>Evaluate Team</span>
    `;
    let btnClass = 'glass-btn-primary';

    if (isSubmitted) {
      btnLabel = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>View Evaluation (Locked)</span>
      `;
      btnClass = 'glass-btn-secondary';
    } else if (isDraft) {
      btnLabel = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>Resume Evaluation (Draft)</span>
      `;
      btnClass = 'glass-btn-primary';
    }

    return `
      <div class="jdash-project-card ${isSubmitted ? 'card-evaluated' : ''}">
        <div class="jdash-card-top">
          <span class="jdash-card-id mono">${escapeHtml(p.team_code || '')}</span>
          ${statusPill}
        </div>
        <div class="jdash-card-content">
          <h4 class="jdash-card-teamname">${escapeHtml(p.team_name || '—')}</h4>
          <div class="jdash-card-detail-row">
            <span class="detail-label">Project:</span>
            <span class="detail-value">${escapeHtml(p.project_title || '—')}</span>
          </div>
          <div class="jdash-card-detail-row">
            <span class="detail-label">Leader:</span>
            <span class="detail-value">${escapeHtml(p.leader_name || '—')}</span>
          </div>
          <div class="jdash-card-detail-row">
            <span class="detail-label">Theme:</span>
            <span class="status-pill-badge pill-blue">${escapeHtml(p.category || 'General')}</span>
          </div>
        </div>
        <button type="button" class="glass-btn ${btnClass} jdash-touch-btn" onclick="openEvaluationModal(${p.team_id})">
          ${btnLabel}
        </button>
      </div>
    `;
  }).join('');
}

async function openEvaluationModal(teamId) {
  currentEvalTeamId = teamId;
  const project = currentJudgeProjects.find(p => p.team_id === teamId);
  if (!project) return;

  document.getElementById('eval-modal-team-code').textContent = project.team_code;
  document.getElementById('eval-modal-team-name').textContent = project.team_name;
  document.getElementById('eval-modal-proj-title').textContent = `${project.project_title || '—'} • ${project.category || 'Innovation'}`;

  const schoolEl = document.getElementById('eval-modal-school');
  if (schoolEl) schoolEl.textContent = project.college_name || 'Institution / School';

  const membersEl = document.getElementById('eval-modal-members');
  if (membersEl) {
    if (project.members) {
      membersEl.textContent = `Members: ${project.members}`;
      membersEl.classList.remove('hidden');
    } else {
      membersEl.classList.add('hidden');
    }
  }

  const criteriaBox = document.getElementById('eval-criteria-container');
  criteriaBox.innerHTML = '<div class="qr-loading">Loading scoring criteria...</div>';
  document.getElementById('eval-error').classList.add('hidden');
  const evalModal = document.getElementById('modal-jury-evaluation');
  if (evalModal) {
    evalModal.classList.remove('hidden');
    evalModal.style.display = 'flex';
  }

  try {
    // 1. Fetch Criteria
    const critRes = await fetch('/api/jury/criteria', { headers: { Authorization: 'Bearer ' + judgeToken } });
    const critData = await critRes.json();
    currentJudgeCriteria = critData.criteria || [];

    // 2. Fetch existing evaluation (if draft or submitted)
    const evalRes = await fetch(`/api/jury/evaluations/${teamId}`, { headers: { Authorization: 'Bearer ' + judgeToken } });
    const evalData = await evalRes.json();
    currentEvalExisting = evalData.evaluation;

    const existingScoresMap = new Map();
    if (evalData.scores) {
      evalData.scores.forEach(s => existingScoresMap.set(s.criterion_id, s.score));
    }

    const isSubmitted = currentEvalExisting && currentEvalExisting.status === 'SUBMITTED';

    // Status pill
    const statusPill = document.getElementById('eval-modal-status-pill');
    statusPill.textContent = isSubmitted ? 'Submitted (Locked)' : 'Draft';
    statusPill.className = `status-pill-badge ${isSubmitted ? 'pill-present' : 'pill-absent'}`;

    // Remarks
    document.getElementById('eval-remarks').value = currentEvalExisting ? (currentEvalExisting.remarks || '') : '';
    document.getElementById('eval-remarks').disabled = isSubmitted;

    // Action buttons
    document.getElementById('btn-eval-draft').classList.toggle('hidden', isSubmitted);
    const submitBtn = document.getElementById('btn-eval-submit');
    submitBtn.textContent = isSubmitted ? 'Already Final Submitted' : 'Submit Final Evaluation';
    submitBtn.disabled = isSubmitted;

    // Build Criteria HTML with mobile-friendly preset pills
    criteriaBox.innerHTML = currentJudgeCriteria.map(c => {
      const savedScore = existingScoresMap.has(c.id) ? existingScoresMap.get(c.id) : 0;
      const numScore = parseFloat(savedScore) || 0;
      return `
        <div class="eval-criterion-card" data-crit-id="${c.id}" data-max-score="${c.max_score}">
          <div class="criterion-card-head">
            <div class="criterion-title-wrap">
              <span class="criterion-code-tag">${escapeHtml(c.criterion_code)}</span>
              <span class="criterion-title">${escapeHtml(c.title)}</span>
            </div>
            <span class="criterion-max-tag">Max: ${c.max_score} pts</span>
          </div>

          <p class="criterion-desc">${escapeHtml(c.description || '')}</p>

          <div class="criterion-input-row">
            <input type="range" class="criterion-range-slider" min="0" max="${c.max_score}" step="0.5" value="${numScore}" 
                   oninput="syncCritInput(this, 'slider')" ${isSubmitted ? 'disabled' : ''} />
            <input type="number" class="criterion-number-input" min="0" max="${c.max_score}" step="0.5" value="${numScore}" 
                   oninput="syncCritInput(this, 'number')" ${isSubmitted ? 'disabled' : ''} />
          </div>

          <div class="criterion-score-presets">
            <span class="presets-label">Quick:</span>
            ${[0, 2.5, 5, 7.5, 10].map(val => `
              <button type="button" class="score-preset-pill ${numScore === val ? 'active' : ''}" 
                      onclick="setCritPreset(this, ${val})" ${isSubmitted ? 'disabled' : ''}>
                ${val}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    updateTotalScoreDisplay();
  } catch (err) {
    console.error('[ERROR] openEvaluationModal:', err);
    criteriaBox.innerHTML = '<div class="glass-alert-error">Failed to load criteria.</div>';
  }
}

function setCritPreset(btn, val) {
  const card = btn.closest('.eval-criterion-card');
  const slider = card.querySelector('.criterion-range-slider');
  const number = card.querySelector('.criterion-number-input');
  slider.value = val;
  number.value = val;
  card.querySelectorAll('.score-preset-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  updateTotalScoreDisplay();
}

function syncCritInput(elem, type) {
  const card = elem.closest('.eval-criterion-card');
  const slider = card.querySelector('.criterion-range-slider');
  const number = card.querySelector('.criterion-number-input');
  const max = parseFloat(card.dataset.maxScore) || 10;

  let val = parseFloat(elem.value);
  if (isNaN(val) || val < 0) val = 0;
  if (val > max) val = max;

  if (type === 'slider') {
    number.value = val;
  } else {
    slider.value = val;
  }

  // Update preset active state
  card.querySelectorAll('.score-preset-pill').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.textContent.trim()) === val);
  });

  updateTotalScoreDisplay();
}

function updateTotalScoreDisplay() {
  let total = 0;
  let maxPossible = 0;

  document.querySelectorAll('.eval-criterion-card').forEach(card => {
    const num = card.querySelector('.criterion-number-input');
    const max = parseFloat(card.dataset.maxScore) || 10;
    total += parseFloat(num.value) || 0;
    maxPossible += max;
  });

  const formattedTotal = Number(total.toFixed(2));
  document.getElementById('eval-modal-total-score').textContent = `${formattedTotal} / ${maxPossible || 50}`;
}

function closeEvaluationModal() {
  const modal = document.getElementById('modal-jury-evaluation');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  currentEvalTeamId = null;
  currentEvalExisting = null;
}

function collectEvaluationScores() {
  const scores = [];
  document.querySelectorAll('.eval-criterion-card').forEach(card => {
    const critId = parseInt(card.dataset.critId, 10);
    const num = card.querySelector('.criterion-number-input');
    scores.push({
      criterion_id: critId,
      score: parseFloat(num.value) || 0
    });
  });
  return scores;
}

async function saveEvaluationDraft() {
  if (!currentEvalTeamId) return;
  const scores = collectEvaluationScores();
  const remarks = document.getElementById('eval-remarks').value;
  const errBox = document.getElementById('eval-error');
  errBox.classList.add('hidden');

  try {
    const res = await fetch(`/api/jury/evaluations/${currentEvalTeamId}/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + judgeToken
      },
      body: JSON.stringify({ scores, remarks })
    });

    const data = await res.json();
    if (!res.ok) {
      errBox.textContent = data.error || 'Failed to save draft';
      errBox.classList.remove('hidden');
      return;
    }

    showToast('Evaluation draft saved successfully', 'info');
    loadJudgeProjects();
  } catch (err) {
    console.error('[ERROR] saveEvaluationDraft:', err);
    errBox.textContent = 'Server connection error';
    errBox.classList.remove('hidden');
  }
}

function submitEvaluationFinal() {
  if (!currentEvalTeamId) return;
  const errBox = document.getElementById('eval-error');
  if (errBox) errBox.classList.add('hidden');

  // Open dedicated in-app confirmation popup modal
  const confirmModal = document.getElementById('modal-eval-confirm');
  if (confirmModal) {
    confirmModal.classList.remove('hidden');
    confirmModal.style.display = 'flex';
  } else if (!confirm('Are you sure you want to final-submit this evaluation? Once submitted, your scores and feedback will be locked and cannot be edited.')) {
    return;
  } else {
    executeFinalEvaluationSubmit();
  }
}

function closeEvalConfirmModal() {
  const confirmModal = document.getElementById('modal-eval-confirm');
  if (confirmModal) {
    confirmModal.classList.add('hidden');
    confirmModal.style.display = 'none';
  }
}

async function executeFinalEvaluationSubmit() {
  closeEvalConfirmModal();
  if (!currentEvalTeamId) return;
  const errBox = document.getElementById('eval-error');
  if (errBox) errBox.classList.add('hidden');

  const remarks = (document.getElementById('eval-remarks').value || '').trim();
  const scores = collectEvaluationScores();
  const submitBtn = document.getElementById('btn-confirm-final-submit') || document.getElementById('btn-eval-submit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch(`/api/jury/evaluations/${currentEvalTeamId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + judgeToken
      },
      body: JSON.stringify({ scores, remarks })
    });

    const data = await res.json();
    if (!res.ok) {
      if (errBox) {
        errBox.textContent = data.error || 'Failed to submit evaluation';
        errBox.classList.remove('hidden');
      }
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    showToast('Final evaluation submitted and locked successfully!', 'success');
    closeEvaluationModal();
    loadJudgeProjects();
  } catch (err) {
    console.error('[ERROR] submitEvaluationFinal:', err);
    if (errBox) {
      errBox.textContent = 'Server connection error';
      errBox.classList.remove('hidden');
    }
    if (submitBtn) submitBtn.disabled = false;
  }
}
window.submitEvaluationFinal = submitEvaluationFinal;
window.closeEvalConfirmModal = closeEvalConfirmModal;
window.executeFinalEvaluationSubmit = executeFinalEvaluationSubmit;

function exportJuryEvaluationsCSV() {
  if (!rawJuryEvalsData || rawJuryEvalsData.length === 0) {
    showToast('No evaluations to export yet.', 'error');
    return;
  }
  const headers = ['Panel', 'Team Code', 'Team Name', 'Project Title', 'School/College', 'Internal Score (/50)', 'External Score (/50)', 'Combined Score (/100)', 'Status'];
  const rows = rawJuryEvalsData.map(e => [
    e.panel_code || '',
    e.team_code || '',
    `"${(e.team_name || '').replace(/"/g, '""')}"`,
    `"${(e.project_title || '').replace(/"/g, '""')}"`,
    `"${(e.school || '').replace(/"/g, '""')}"`,
    e.internal_eval ? e.internal_eval.score : '',
    e.external_eval ? e.external_eval.score : '',
    e.combined_score !== null ? e.combined_score : '',
    e.is_complete ? 'Completed' : (e.internal_eval || e.external_eval ? 'Partial' : 'Pending')
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `RMK_Jr_Hackathon_2026_Jury_Evaluations_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Evaluation CSV exported successfully', 'info');
}

// ─── Attach to global window scope for inline HTML handlers ───
window.switchJuryAdminSection = switchJuryAdminSection;
window.loadJuryAdminPanels = loadJuryAdminPanels;
window.loadJuryAdminStats = loadJuryAdminStats;
window.setJuryAdminFilter = setJuryAdminFilter;
window.handleJuryAdminSearch = handleJuryAdminSearch;
window.resetJudgePassword = resetJudgePassword;
window.toggleJudgeStatus = toggleJudgeStatus;
window.logoutJuryAdmin = logoutJuryAdmin;
window.loadJuryAdminEvaluations = loadJuryAdminEvaluations;
window.handleJuryEvalsSearch = handleJuryEvalsSearch;
window.exportJuryEvaluationsCSV = exportJuryEvaluationsCSV;
window.openAdminEvalDetail = openAdminEvalDetail;
window.closeAdminEvalModal = closeAdminEvalModal;

window.logoutJudge = logoutJudge;
window.reviewJudgeRegistration = reviewJudgeRegistration;
window.editJudgeRegistration = editJudgeRegistration;
window.submitJudgeRegistration = submitJudgeRegistration;
window.loadJudgeProjects = loadJudgeProjects;
window.openEvaluationModal = openEvaluationModal;
window.setCritPreset = setCritPreset;
window.syncCritInput = syncCritInput;
window.closeEvaluationModal = closeEvaluationModal;
window.syncCritInput = syncCritInput;
window.saveEvaluationDraft = saveEvaluationDraft;
window.submitEvaluationFinal = submitEvaluationFinal;


// ════════════════════════════════════════════════════════════════
//  ADMIN PANEL ALLOCATION MANAGEMENT (Milestone 2)
// ════════════════════════════════════════════════════════════════


const OFFICIAL_PANEL_JURY = {
  1: {
    panel: 'Panel 1',
    external: { name: 'Mr S. Gowtham', designation: 'Deputy Manager', organisation: 'Ashok Leyland' },
    internal: { name: 'Dr. T. Suresh', designation: 'HoD/ECE', organisation: 'RMKEC' },
    assistance: { name: 'Ms.M.Naveena', designation: 'Assistant Professor / ECE', organisation: 'RMKEC' },
    committee: { name: 'Dr.T D Subha / ECE, Dr.Deepa D / CSE', organisation: 'RMKEC' }
  },
  2: {
    panel: 'Panel 2',
    external: { name: 'Mr. Kumar Krishnamoorthy', designation: 'Technical Lead', organisation: 'DXC Technology' },
    internal: { name: 'Dr. B.Prathushalaxmi', designation: 'HoD/AIDS', organisation: 'RMKCET' },
    assistance: { name: 'Mr. D. Senthil Kumar', designation: 'Assistant Professor / CSE (CS)', organisation: 'RMKCET' },
    committee: { name: 'Dr.Hema Jyothi, Dr.Sesha Vidhya S', organisation: 'RMKCET' }
  },
  3: {
    panel: 'Panel 3',
    external: { name: 'Ms. Aparna Karthik', designation: 'Associate Test Manager', organisation: 'EY-GDS' },
    internal: { name: 'Dr.K. Helen Prabha', designation: 'HoD/ECE', organisation: 'RMDEC' },
    assistance: { name: 'Ms. P. Illampirai', designation: 'Assistant Professor / CSE', organisation: 'RMKEC' },
    committee: { name: 'Dr.D Abithakumari Prof/CSE, Ms.Latha AP/CSE', organisation: 'RMKEC' }
  },
  4: {
    panel: 'Panel 4',
    external: { name: 'Mr. R. Harish', designation: 'Technical Lead', organisation: 'HCL Technologies Limited' },
    internal: { name: 'Dr. R. Raja Guru', designation: 'HoD / CSE', organisation: 'RMKCET' },
    assistance: { name: 'Ms.C. Vimala Roshni', designation: 'Assistant Professor / AIDS', organisation: 'RMKEC' },
    committee: { name: 'Dr.R.Poornima / IT, Dr.G.Nagarajan / IT', organisation: 'RMKEC' }
  },
  5: {
    panel: 'Panel 5',
    external: { name: 'Mr. G.K. Bhaskar', designation: 'Security Analyst', organisation: 'Securin' },
    internal: { name: 'Dr. J. Jasmine Hephzipa', designation: 'HoD/ECA', organisation: 'RMKEC' },
    assistance: { name: 'Ms.Renuga Devi', designation: 'Assistant Professor / IT', organisation: 'RMKEC' },
    committee: { name: 'Mr.S.Vijayakumar / CSE', organisation: 'RMKEC' }
  },
  6: {
    panel: 'Panel 6',
    external: { name: 'Mr. Raj Kisan Sathiyan', designation: 'AI Vision Team Lead', organisation: 'Intech Systems Pvt Ltd' },
    internal: { name: 'Dr. Subadra Murugan', designation: 'HoD/EEE', organisation: 'RMKCET' },
    assistance: { name: 'Mr.AnandRaj', designation: 'Assistant Professor / CSBS', organisation: 'RMKEC' },
    committee: { name: 'Mrs.Gayathri Priya S, Mr. Bharathi Dhasan D', organisation: 'RMDEC' }
  },
  7: {
    panel: 'Panel 7',
    external: { name: 'Mr. T. Dellibabu', designation: 'Principal Technical Professional', organisation: 'Kellogg Brown and Root Engineering' },
    internal: { name: 'Dr.Gangatharan', designation: 'HoD/ECE', organisation: 'RMKCET' },
    assistance: { name: 'Ms.V.Haritha', designation: 'Assistant Professor / CSE', organisation: 'RMKEC' },
    committee: { name: 'Ms. M. Rekha / IT, Mr. S.Nagarajan / IT', organisation: 'RMKEC' }
  },
  8: {
    panel: 'Panel 8',
    external: { name: 'Mr. C. Shivarajkumar', designation: 'Principal Technical Professional', organisation: 'Kellogg Brown and Root Engineering' },
    internal: { name: 'Dr. A. Swarnalatha', designation: 'HoD/EEE', organisation: 'RMKEC' },
    assistance: { name: 'Ms. Jhansi Ida', designation: 'Associate Professor / CSBS', organisation: 'RMKEC' },
    committee: { name: 'Dr.V.Kali Raj, Mr.Karthick Murugan S', organisation: 'RMDEC' }
  },
  9: {
    panel: 'Panel 9',
    external: { name: 'Mr. J. Veeramani', designation: 'Engineering Manager', organisation: 'Honeywell Automation India Ltd' },
    internal: { name: 'Dr. G. Amudha', designation: 'HoD/CSBS', organisation: 'RMDEC' },
    assistance: { name: 'Dr.R.Sheeja', designation: 'Associate Professor / CSE', organisation: 'RMKEC' },
    committee: { name: 'Dr.Devan P K', organisation: 'RMKCET' }
  },
  10: {
    panel: 'Panel 10',
    external: { name: 'Ms. Nithya Chandrashekar', designation: 'Assistant Manager', organisation: 'QX Global Ltd' },
    internal: { name: 'Dr.Sandra Johnson', designation: 'HoD/AIDS', organisation: 'RMKEC' },
    assistance: { name: 'Ms.T.Kanmani', designation: 'Assistant Professor / IT', organisation: 'RMKEC' },
    committee: { name: 'Dr.K.B. Aruna, Ms. Anandhi K', organisation: 'RMDEC' }
  },
  11: {
    panel: 'Panel 11',
    external: { name: 'Mr. Frederick Swartz', designation: 'Software Architect', organisation: 'Squad Software Inc' },
    internal: { name: 'Dr.G.Anandha Mala', designation: 'Professor / IT', organisation: 'RMKEC' },
    assistance: { name: 'Ms. Nandhini', designation: 'Assistant Professor / IT', organisation: 'RMKEC' },
    committee: { name: 'Dr.A.Anna Lakshmi / IT (RMKEC), Ms.L.Sudha (RMKDEC)', organisation: 'RMKEC / RMDEC' }
  },
  12: {
    panel: 'Panel 12',
    external: { name: 'Ms. Monisha Rajendran', designation: 'Team Lead', organisation: 'QX Global Ltd' },
    internal: { name: 'Dr. C.S. Anita', designation: 'HoD/AIML', organisation: 'RMDEC' },
    assistance: { name: 'Ms. S. Deepa', designation: 'Assistant Professor / CSBS', organisation: 'RMDEC' },
    committee: { name: 'Mr.M.Vengateswaran / CSE', organisation: 'RMKEC' }
  },
  13: {
    panel: 'Panel 13',
    external: { name: 'Mr. R. Harish', designation: 'Technical Lead', organisation: 'HCL Technologies Limited' },
    internal: { name: 'Dr. K. Balasubadra', designation: 'HoD / IT', organisation: 'RMDEC' },
    assistance: { name: 'Ms. T. Akila', designation: 'Assistant Professor / IT', organisation: 'RMKEC' },
    committee: { name: 'Dr A. Nivas Ahamed / EEE, Ms.M.Kanniga Parameshwari / IT', organisation: 'RMKEC' }
  },
  14: {
    panel: 'Panel 14',
    external: { name: 'Mr.P. Dhilip Kumar', designation: 'Consultant', organisation: 'Deloitte' },
    internal: { name: 'Dr. P. Valarmathie', designation: 'HoD / CSE', organisation: 'RMDEC' },
    assistance: { name: 'Ms.J.Divya', designation: 'Assistant Professor / IT', organisation: 'RMKEC' },
    committee: { name: 'Ms.K.Selvi / IT, Mr.L.Vinoth Kumar / IT', organisation: 'RMKEC' }
  },
  15: {
    panel: 'Panel 15',
    external: { name: 'Mr. S.S Venkatasubramanian', designation: 'Founder & CEO', organisation: 'LabnBox (Steam Troops Innovation)' },
    internal: { name: 'Dr.Y. Sukhi', designation: 'HoD/EEE', organisation: 'RMKEC' },
    assistance: { name: 'Dr. K. Naresh Kumar', designation: 'Assistant Professor / EEE', organisation: 'RMKEC' },
    committee: { name: 'Dr.Vendhan D, Dr.Arun Manicka Raja M', organisation: 'RMKCET' }
  }
};

let allocState = {
  activeRevision: null,
  draftRevision: null,
  currentRevision: null,
  panels: [],
  assigned: [],
  unassigned: [],
  activeFilter: 'all',
  panelFilter: 'all',
  searchQuery: ''
};

let expandedAllocPanels = new Set();

function toggleAllocPanel(panelId) {
  if (expandedAllocPanels.has(panelId)) {
    expandedAllocPanels.delete(panelId);
  } else {
    expandedAllocPanels.add(panelId);
  }
  renderAllocationWorkspace();
}

function toggleAllAllocPanels() {
  const allIds = allocState.panels.map(p => p.id);
  const allExpanded = allIds.length > 0 && allIds.every(id => expandedAllocPanels.has(id));
  if (allExpanded) {
    expandedAllocPanels.clear();
  } else {
    allIds.forEach(id => expandedAllocPanels.add(id));
  }
  renderAllocationWorkspace();
}
window.toggleAllocPanel = toggleAllocPanel;
window.toggleAllAllocPanels = toggleAllAllocPanels;

async function loadAdminAllocations() {
  if (!adminToken) return;

  try {
    const sumRes = await fetch('/api/admin/allocations/summary', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (sessionExpired(sumRes)) return;
    if (!sumRes.ok) {
      showToast('Failed to load allocation summary', 'error');
      return;
    }

    const sumData = await sumRes.json();
    allocState.activeRevision = sumData.active_revision;
    allocState.draftRevision = sumData.draft_revision;

    // View draft if one is in progress, otherwise view active published revision
    const targetRevId = allocState.draftRevision
      ? allocState.draftRevision.id
      : (allocState.activeRevision ? allocState.activeRevision.id : null);

    if (!targetRevId) {
      showToast('No allocation revisions found', 'error');
      return;
    }

    const detRes = await fetch('/api/admin/allocations/revisions/' + targetRevId, {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (sessionExpired(detRes)) return;
    if (!detRes.ok) {
      showToast('Failed to load allocation details', 'error');
      return;
    }

    const detData = await detRes.json();
    allocState.currentRevision = detData.revision;
    allocState.panels = detData.panels || [];
    allocState.assigned = detData.assigned || [];
    allocState.unassigned = detData.unassigned || [];

    updateAllocBanner();
    updateAllocStats(detData.stats);
    populateAllocPanelFilter();
    renderAllocationWorkspace();

  } catch (err) {
    console.error('[ERROR] loadAdminAllocations:', err);
    showToast('Network error loading allocations', 'error');
  }
}

function updateAllocBanner() {
  const activeRevTitle = document.getElementById('alloc-active-rev-title');
  const activeRevMeta = document.getElementById('alloc-active-rev-meta');
  const btnCreateDraft = document.getElementById('btn-create-draft');
  const draftAlert = document.getElementById('alloc-draft-alert');
  const draftTitle = document.getElementById('alloc-draft-title');
  const draftMeta = document.getElementById('alloc-draft-meta');

  if (allocState.activeRevision) {
    const act = allocState.activeRevision;
    const pubDate = act.published_at
      ? new Date(act.published_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Initial release';
    activeRevTitle.textContent = `Active Allocation: Revision #${act.revision_number} (${act.status})`;
    activeRevMeta.textContent = `Published on ${pubDate} • ${allocState.assigned.length} teams assigned`;
  } else {
    activeRevTitle.textContent = 'Active Allocation: None Published';
    activeRevMeta.textContent = 'Create a revision and publish it to assign teams to panels.';
  }

  if (allocState.draftRevision) {
    const draft = allocState.draftRevision;
    const createDate = draft.created_at
      ? new Date(draft.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    draftTitle.textContent = `Draft Revision #${draft.revision_number} in Progress`;
    draftMeta.textContent = `— Created by ${draft.created_by || 'admin'} on ${createDate} (Isolated from published allocations)`;
    draftAlert.classList.remove('hidden');
    if (btnCreateDraft) btnCreateDraft.classList.add('hidden');
  } else {
    draftAlert.classList.add('hidden');
    if (btnCreateDraft) btnCreateDraft.classList.remove('hidden');
  }
}

function updateAllocStats(stats) {
  if (!stats) return;

  const totalEl = document.getElementById('stat-alloc-total');
  const assignedEl = document.getElementById('stat-alloc-assigned');
  const unassignedEl = document.getElementById('stat-alloc-unassigned');
  const pillUnassigned = document.getElementById('pill-unassigned-count');
  const panelsEl = document.getElementById('stat-alloc-panels');
  const unassignedCardStat = document.getElementById('card-stat-unassigned');

  if (totalEl) totalEl.textContent = stats.total_teams;
  if (assignedEl) assignedEl.textContent = stats.assigned_count;
  if (unassignedEl) unassignedEl.textContent = stats.unassigned_count;
  if (pillUnassigned) pillUnassigned.textContent = stats.unassigned_count;
  if (panelsEl) panelsEl.textContent = allocState.panels.length + ' Panels';

  if (unassignedCardStat) {
    if (stats.unassigned_count > 0) unassignedCardStat.classList.add('has-unassigned');
    else unassignedCardStat.classList.remove('has-unassigned');
  }
}

function toggleAllocPanelCustomDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('dropdown-alloc-panel-custom');
  const menu = document.getElementById('menu-alloc-panel-custom');
  const btn = document.getElementById('btn-alloc-panel-trigger');
  const wasOpen = dropdown ? dropdown.classList.contains('open') : false;
  closeDropdowns();
  if (dropdown && !wasOpen) {
    dropdown.classList.add('open');
    if (menu) menu.classList.add('show');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}
window.toggleAllocPanelCustomDropdown = toggleAllocPanelCustomDropdown;

function selectAllocPanelCustomFilter(val, label) {
  const labelEl = document.getElementById('alloc-panel-selected-label');
  if (labelEl) labelEl.textContent = label;

  const select = document.getElementById('alloc-panel-filter');
  if (select) select.value = val;

  const items = document.querySelectorAll('#menu-alloc-panel-custom .dropdown-item');
  items.forEach(item => {
    if (item.dataset.panelId === String(val)) item.classList.add('active');
    else item.classList.remove('active');
  });

  handleAllocPanelFilterChange(val);
  closeDropdowns();
}
window.selectAllocPanelCustomFilter = selectAllocPanelCustomFilter;

function populateAllocPanelFilter() {
  const select = document.getElementById('alloc-panel-filter');
  const menu = document.getElementById('menu-alloc-panel-custom');
  if (!allocState || !allocState.panels) return;

  const currentVal = select ? (select.value || 'all') : 'all';

  if (select) {
    select.innerHTML = '<option value="all">All Panels (' + allocState.panels.length + ')</option>';
    allocState.panels.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.panel_code} — ${p.panel_name} (${p.count || (p.teams ? p.teams.length : 0)})`;
      select.appendChild(opt);
    });
    select.value = currentVal;
  }

  if (menu) {
    let itemsHtml = `
      <div class="dropdown-group-header">FILTER BY PANEL</div>
      <button type="button" class="dropdown-item ${currentVal === 'all' ? 'active' : ''}" data-panel-id="all" onclick="selectAllocPanelCustomFilter('all', 'All Panels (${allocState.panels.length})')">
        <span class="dropdown-item-label">All Panels</span>
        <span class="file-tag tag-xlsx" style="background:#f1f5f9; color:#475569; border-color:#cbd5e1;">${allocState.panels.length}</span>
      </button>
    `;
    allocState.panels.forEach(p => {
      const count = p.count || (p.teams ? p.teams.length : 0);
      const isAct = String(currentVal) === String(p.id);
      const safeLabel = `${p.panel_code} — ${p.panel_name} (${count})`.replace(/'/g, "\\'");
      itemsHtml += `
        <button type="button" class="dropdown-item ${isAct ? 'active' : ''}" data-panel-id="${p.id}" onclick="selectAllocPanelCustomFilter('${p.id}', '${safeLabel}')">
          <span class="dropdown-item-label">${escapeHtml(p.panel_code)} — ${escapeHtml(p.panel_name)}</span>
          <span class="file-tag tag-xlsx" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">${count}</span>
        </button>
      `;
    });
    menu.innerHTML = itemsHtml;
  }

  const labelEl = document.getElementById('alloc-panel-selected-label');
  if (labelEl) {
    if (currentVal === 'all') {
      labelEl.textContent = `All Panels (${allocState.panels.length})`;
    } else {
      const found = allocState.panels.find(p => String(p.id) === String(currentVal));
      if (found) {
        labelEl.textContent = `${found.panel_code} — ${found.panel_name} (${found.count || (found.teams ? found.teams.length : 0)})`;
      }
    }
  }
}

function renderAllocationWorkspace() {
  const query = allocState.searchQuery.toLowerCase().trim();
  const isDraft = Boolean(allocState.draftRevision);

  // 1. Render Unassigned Teams Pool
  const unassignedCard = document.getElementById('alloc-unassigned-card');
  const unassignedGrid = document.getElementById('alloc-unassigned-grid');
  const unassignedHeaderCount = document.getElementById('unassigned-header-count');

  let filteredUnassigned = allocState.unassigned;
  if (query) {
    filteredUnassigned = allocState.unassigned.filter(t =>
      matchesSearchQuery(query, t.team_code, t.team_name, t.theme, t.leader_name, t.college_name, t.project_title, t.members)
    );
  }

  if (allocState.activeFilter === 'assigned') {
    unassignedCard.classList.add('hidden');
  } else if (allocState.unassigned.length > 0) {
    unassignedCard.classList.remove('hidden');
    unassignedHeaderCount.textContent = allocState.unassigned.length + ' team(s)';

    if (filteredUnassigned.length === 0) {
      unassignedGrid.innerHTML = '<div class="text-muted" style="grid-column: 1 / -1; padding: 12px;">No unassigned teams match the search criteria.</div>';
    } else {
      unassignedGrid.innerHTML = filteredUnassigned.map(t => {
        const teamId = Number(t.team_id || t.id);
        const panelOptions = allocState.panels.map(p =>
          `<option value="${p.id}">${escapeHtml(p.panel_code)}: ${escapeHtml(p.panel_name)}</option>`
        ).join('');

        return `
          <div class="unassigned-team-card">
            <div class="unassigned-team-top">
              <span class="alloc-team-id-pill">${escapeHtml(t.team_code || '')}</span>
              <span class="alloc-theme-tag" title="${escapeHtml(t.theme || '')}">${escapeHtml(t.theme || '')}</span>
            </div>
            <div class="unassigned-team-title">${escapeHtml(t.team_name || '—')}</div>
            <div class="unassigned-team-meta">
              <span>Leader: ${escapeHtml(t.leader_name || '—')}</span> • <span>${escapeHtml(t.college_name || '—')}</span>
            </div>
            <div class="unassigned-team-actions">
              ${isDraft
                ? `<select class="alloc-quick-assign-select" onchange="handleAssignTeam(this, ${teamId})">
                     <option value="">Assign to Panel...</option>
                     ${panelOptions}
                   </select>`
                : `<span class="unassigned-hint-text" style="font-size: 11.5px;">Create a draft revision to assign</span>`
              }
            </div>
          </div>
        `;
      }).join('');
    }
  } else {
    // 0 unassigned teams
    if (allocState.activeFilter === 'unassigned') {
      unassignedCard.classList.remove('hidden');
      unassignedHeaderCount.textContent = '0 teams';
      unassignedGrid.innerHTML = '<div class="text-muted" style="grid-column: 1 / -1; padding: 16px;">All teams are currently assigned to panels.</div>';
    } else {
      unassignedCard.classList.add('hidden');
    }
  }

  // 2. Render Panels Grid
  const panelsGrid = document.getElementById('alloc-panels-grid');
  if (allocState.activeFilter === 'unassigned') {
    panelsGrid.parentElement.classList.add('hidden');
    return;
  }
  panelsGrid.parentElement.classList.remove('hidden');

  let displayPanels = allocState.panels;
  if (allocState.panelFilter !== 'all') {
    const pid = Number(allocState.panelFilter);
    displayPanels = allocState.panels.filter(p => p.id === pid);
  }

  if (displayPanels.length === 0) {
    panelsGrid.innerHTML = '<div class="text-center loading-cell" style="grid-column: 1 / -1;">No panels match the selected filter.</div>';
    return;
  }

  const allIds = displayPanels.map(p => p.id);
  const isAllExpanded = allIds.length > 0 && allIds.every(id => expandedAllocPanels.has(id));
  const toggleBtnText = document.getElementById('btn-toggle-all-alloc-text');
  if (toggleBtnText) toggleBtnText.textContent = isAllExpanded ? 'Collapse All' : 'Expand All';

  panelsGrid.innerHTML = displayPanels.map(p => {
    let teams = p.teams || [];
    if (query) {
      teams = teams.filter(t =>
        matchesSearchQuery(query, t.team_code, t.team_name, t.theme, t.leader_name, t.college_name, t.project_title, t.members)
      );
    }

    const count = (p.teams || []).length;
    let badgeClass = 'count-badge-optimal';
    if (count === 0) badgeClass = 'count-badge-empty';
    else if (count < 12) badgeClass = 'count-badge-low';

    // Auto-expand if active query matches teams in this panel
    const isExpanded = query ? (teams.length > 0) : expandedAllocPanels.has(p.id);

    const panelOptions = allocState.panels.filter(other => other.id !== p.id).map(other =>
      `<option value="${other.id}">${escapeHtml(other.panel_code)} (${escapeHtml(other.panel_name)})</option>`
    ).join('');

    const teamsHtml = teams.length === 0
      ? `<div class="alloc-panel-empty-text">${query ? 'No matching teams in this panel' : 'No teams assigned yet'}</div>`
      : teams.map(t => {
          const teamId = Number(t.team_id || t.id);
          return `
            <div class="alloc-team-item">
              <div class="alloc-team-header">
                <span class="alloc-team-id-pill">${escapeHtml(t.team_code || '')}</span>
                <span class="alloc-theme-tag" title="${escapeHtml(t.theme || '')}">${escapeHtml(t.theme || '')}</span>
              </div>
              <div class="alloc-team-title">${escapeHtml(t.team_name || '—')}</div>
              <div class="alloc-team-sub">
                <span>Leader: ${escapeHtml(t.leader_name || '—')}</span>
              </div>
              ${isDraft ? `
                <div class="alloc-team-controls">
                  <select class="alloc-move-select" onchange="handleMoveTeam(this, ${teamId})" title="Move team to another panel">
                    <option value="">Move to...</option>
                    ${panelOptions}
                  </select>
                  <button type="button" class="alloc-remove-btn" onclick="handleRemoveTeam(${teamId})" title="Unassign team (move to unassigned pool)" aria-label="Remove assignment">
                    ✕
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

    const panelNum = parseInt(String(p.panel_code || '').replace(/[^0-9]/g, ''), 10) || 1;
    const juryInfo = (typeof OFFICIAL_PANEL_JURY !== 'undefined') ? OFFICIAL_PANEL_JURY[panelNum] : null;

    return `
      <div class="alloc-panel-row-card ${isExpanded ? 'expanded' : ''}" id="alloc-panel-${p.id}">
        <div class="alloc-panel-row-header" onclick="toggleAllocPanel(${p.id})">
          <div class="alloc-panel-row-left">
            <span class="alloc-panel-code-badge">${escapeHtml(p.panel_code)}</span>
            <div class="alloc-panel-info">
              <h4 class="alloc-panel-name">${escapeHtml(p.panel_name)}</h4>
              <div class="alloc-panel-venue-pill" title="${escapeHtml(p.venue || 'No venue configured')}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>${escapeHtml(p.venue || 'Venue pending')}</span>
              </div>
            </div>
          </div>
          <div class="alloc-panel-row-right">
            <span class="alloc-panel-count-badge ${badgeClass}">${count} Teams</span>
            <button type="button" class="glass-btn btn-xs alloc-expand-btn" onclick="event.stopPropagation(); toggleAllocPanel(${p.id});" aria-label="Toggle Panel">
              <span class="expand-btn-text">${isExpanded ? 'Collapse' : 'Expand'}</span>
              <svg class="chevron-icon ${isExpanded ? 'rotate-180' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
        ${juryInfo ? `
          <div class="alloc-panel-jury-box">
            <div class="alloc-panel-jury-grid">
              <div class="pjury-cell">
                <span class="pjury-tag tag-external">External Jury</span>
                <span class="pjury-name">${escapeHtml(juryInfo.external.name)}</span>
                <span class="pjury-meta">${escapeHtml(juryInfo.external.designation)} • ${escapeHtml(juryInfo.external.organisation)}</span>
              </div>
              <div class="pjury-cell">
                <span class="pjury-tag tag-internal">Internal Jury</span>
                <span class="pjury-name">${escapeHtml(juryInfo.internal.name)}</span>
                <span class="pjury-meta">${escapeHtml(juryInfo.internal.designation)} • ${escapeHtml(juryInfo.internal.organisation)}</span>
              </div>
              <div class="pjury-cell">
                <span class="pjury-tag tag-assistance">Panel Assistance</span>
                <span class="pjury-name">${escapeHtml(juryInfo.assistance.name)}</span>
                <span class="pjury-meta">${escapeHtml(juryInfo.assistance.designation)} • ${escapeHtml(juryInfo.assistance.organisation)}</span>
              </div>
              <div class="pjury-cell">
                <span class="pjury-tag tag-committee">Committee Incharge</span>
                <span class="pjury-name">${escapeHtml(juryInfo.committee.name)}</span>
                <span class="pjury-meta">${escapeHtml(juryInfo.committee.organisation)}</span>
              </div>
            </div>
          </div>
        ` : ''}
        ${isExpanded ? `
          <div class="alloc-panel-row-body">
            <div class="alloc-panel-teams-grid">
              ${teamsHtml}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function handleAllocFilterSearch() {
  const input = document.getElementById('alloc-search-input');
  allocState.searchQuery = input ? input.value : '';
  renderAllocationWorkspace();
}

function setAllocFilter(filterName, tabEl) {
  allocState.activeFilter = filterName;
  document.querySelectorAll('[data-alloc-filter]').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  renderAllocationWorkspace();
}

function handleAllocPanelFilterChange(val) {
  allocState.panelFilter = val;
  renderAllocationWorkspace();
}

// ─── Draft Management Actions ───

function handleCreateDraftModal() {
  const modal = document.getElementById('modal-alloc-create-draft');
  const notesInput = document.getElementById('alloc-draft-notes');
  const errBox = document.getElementById('alloc-create-draft-error');

  if (notesInput) notesInput.value = '';
  if (errBox) {
    errBox.textContent = '';
    errBox.classList.add('hidden');
  }
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

function closeCreateDraftModal() {
  const modal = document.getElementById('modal-alloc-create-draft');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

async function submitCreateDraft() {
  const btn = document.getElementById('btn-submit-create-draft');
  const errBox = document.getElementById('alloc-create-draft-error');
  const notes = (document.getElementById('alloc-draft-notes')?.value || '').trim();

  try {
    if (btn) btn.disabled = true;
    const res = await fetch('/api/admin/allocations/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({ notes })
    });

    const data = await res.json();
    if (!res.ok) {
      if (errBox) {
        errBox.textContent = data.error || 'Failed to create draft revision';
        errBox.classList.remove('hidden');
      }
      return;
    }

    closeCreateDraftModal();
    showToast(`Draft Revision #${data.draft.revision_number} started successfully!`, 'info');
    await loadAdminAllocations();

  } catch (err) {
    console.error('[ERROR] submitCreateDraft:', err);
    if (errBox) {
      errBox.textContent = 'Server connection error';
      errBox.classList.remove('hidden');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleAssignTeam(selectEl, teamId) {
  const panelId = Number(selectEl.value);
  if (!panelId) return;

  if (!allocState.draftRevision) {
    showToast('Please create a draft revision first to make changes.', 'error');
    selectEl.value = '';
    return;
  }

  try {
    const res = await fetch('/api/admin/allocations/draft/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({
        draft_id: allocState.draftRevision.id,
        team_id: teamId,
        panel_id: panelId
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to assign team', 'error');
      return;
    }

    showToast('Team assigned to panel successfully', 'info');
    await loadAdminAllocations();

  } catch (err) {
    console.error('[ERROR] handleAssignTeam:', err);
    showToast('Failed to assign team', 'error');
  }
}

async function handleMoveTeam(selectEl, teamId) {
  const panelId = Number(selectEl.value);
  if (!panelId) return;

  if (!allocState.draftRevision) {
    showToast('Please create a draft revision first to make changes.', 'error');
    selectEl.value = '';
    return;
  }

  try {
    const res = await fetch('/api/admin/allocations/draft/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({
        draft_id: allocState.draftRevision.id,
        team_id: teamId,
        panel_id: panelId
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to move team', 'error');
      return;
    }

    showToast('Team moved to new panel successfully', 'info');
    await loadAdminAllocations();

  } catch (err) {
    console.error('[ERROR] handleMoveTeam:', err);
    showToast('Failed to move team', 'error');
  }
}

async function handleRemoveTeam(teamId) {
  if (!allocState.draftRevision) {
    showToast('Please create a draft revision first to make changes.', 'error');
    return;
  }

  if (!confirm('Remove this team from its panel? The team will move to the unassigned pool.')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/allocations/draft/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({
        draft_id: allocState.draftRevision.id,
        team_id: teamId
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to remove team', 'error');
      return;
    }

    showToast('Team unassigned and moved to pool', 'info');
    await loadAdminAllocations();

  } catch (err) {
    console.error('[ERROR] handleRemoveTeam:', err);
    showToast('Failed to remove team', 'error');
  }
}

async function handleDiscardDraft() {
  if (!allocState.draftRevision) return;

  const revNum = allocState.draftRevision.revision_number;
  if (!confirm(`Are you sure you want to discard Draft Revision #${revNum}? All uncommitted assignment changes will be discarded.`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/allocations/draft/discard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({
        draft_id: allocState.draftRevision.id
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to discard draft', 'error');
      return;
    }

    showToast(`Draft Revision #${revNum} has been discarded.`, 'info');
    await loadAdminAllocations();

  } catch (err) {
    console.error('[ERROR] handleDiscardDraft:', err);
    showToast('Failed to discard draft', 'error');
  }
}

// ─── Publish Validation & Confirmation Modal ───

async function handleValidateAndOpenPublishModal() {
  if (!allocState.draftRevision) return;

  const modal = document.getElementById('modal-alloc-publish');
  const body = document.getElementById('publish-modal-body');
  const chkConfirm = document.getElementById('chk-alloc-confirm');
  const btnPublish = document.getElementById('btn-confirm-publish');
  const subtitle = document.getElementById('publish-modal-subtitle');

  if (chkConfirm) chkConfirm.checked = false;
  if (btnPublish) btnPublish.disabled = true;
  if (subtitle) {
    subtitle.textContent = `Review Draft Revision #${allocState.draftRevision.revision_number} before making it active for all attendees`;
  }

  body.innerHTML = '<div class="text-center loading-cell" style="padding: 30px;">Validating draft revision...</div>';
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  try {
    const res = await fetch(`/api/admin/allocations/draft/${allocState.draftRevision.id}/validate`, {
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (!res.ok) {
      body.innerHTML = '<div class="glass-alert-error">Failed to validate draft. Please try again.</div>';
      return;
    }

    const val = await res.json();

    let warningsHtml = '';
    if (val.warnings && val.warnings.length > 0) {
      warningsHtml = `
        <div class="glass-alert-error" style="background: #fffbeb; border-color: #fde68a; color: #92400e; margin-bottom: 14px;">
          <div style="font-weight: 700; margin-bottom: 4px;">Validation Warnings:</div>
          <ul style="padding-left: 20px; font-size: 12.5px;">
            ${val.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    let changesHtml = '';
    const changes = val.changes || { moved_count: 0, added_count: 0, removed_count: 0, details: [] };
    if (changes.details && changes.details.length > 0) {
      changesHtml = `
        <div class="alloc-change-card">
          <div class="alloc-change-header">
            Summary of Changes vs Active Published Revision (${changes.details.length} total changes)
          </div>
          <div class="alloc-change-list">
            ${changes.details.map(d => {
              let tag = `<span class="alloc-change-tag tag-moved">MOVED</span>`;
              let desc = `${escapeHtml(d.team_code)} (${escapeHtml(d.team_name)}) moved from <strong>${escapeHtml(d.from_panel)}</strong> to <strong>${escapeHtml(d.to_panel)}</strong>`;
              if (d.type === 'added') {
                tag = `<span class="alloc-change-tag tag-added">ASSIGNED</span>`;
                desc = `${escapeHtml(d.team_code)} (${escapeHtml(d.team_name)}) assigned to <strong>${escapeHtml(d.to_panel)}</strong>`;
              } else if (d.type === 'removed') {
                tag = `<span class="alloc-change-tag tag-removed">UNASSIGNED</span>`;
                desc = `${escapeHtml(d.team_code)} (${escapeHtml(d.team_name)}) unassigned from <strong>${escapeHtml(d.from_panel)}</strong>`;
              }
              return `
                <div class="alloc-change-row">
                  <div>${tag} <span style="margin-left: 6px;">${desc}</span></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      changesHtml = `
        <div class="alloc-change-card">
          <div class="alloc-change-header">Summary of Changes vs Active Published Revision</div>
          <div style="padding: 12px 14px; font-size: 12.5px; color: var(--text-muted);">
            No changes detected compared to the currently active revision.
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <div class="alloc-validation-summary-grid">
        <div class="alloc-val-stat">
          <div class="alloc-val-stat-num">${val.stats ? val.stats.total_teams : 0}</div>
          <div class="alloc-val-stat-lbl">Total Registered</div>
        </div>
        <div class="alloc-val-stat">
          <div class="alloc-val-stat-num" style="color: #047857;">${val.stats ? val.stats.assigned_count : 0}</div>
          <div class="alloc-val-stat-lbl">Assigned</div>
        </div>
        <div class="alloc-val-stat">
          <div class="alloc-val-stat-num" style="${(val.stats && val.stats.unassigned_count > 0) ? 'color: #b91c1c;' : 'color: #64748b;'}">${val.stats ? val.stats.unassigned_count : 0}</div>
          <div class="alloc-val-stat-lbl">Unassigned</div>
        </div>
      </div>

      ${warningsHtml}
      ${changesHtml}
    `;

  } catch (err) {
    console.error('[ERROR] handleValidateAndOpenPublishModal:', err);
    body.innerHTML = '<div class="glass-alert-error">Server connection error during validation.</div>';
  }
}

function closePublishModal() {
  const modal = document.getElementById('modal-alloc-publish');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function togglePublishConfirmBtn() {
  const chk = document.getElementById('chk-alloc-confirm');
  const btn = document.getElementById('btn-confirm-publish');
  if (btn && chk) {
    btn.disabled = !chk.checked;
  }
}

async function submitPublishDraft() {
  if (!allocState.draftRevision) return;

  const btn = document.getElementById('btn-confirm-publish');
  const chk = document.getElementById('chk-alloc-confirm');

  if (!chk || !chk.checked) {
    showToast('Please confirm the checkbox to publish.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    const res = await fetch('/api/admin/allocations/draft/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({
        draft_id: allocState.draftRevision.id,
        confirmed: true
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to publish allocation revision', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    closePublishModal();
    showToast(`Revision #${data.published_revision.revision_number} published successfully! All judges and attendee QR passes updated.`, 'info');
    await loadAdminAllocations();
    if (typeof loadTeamsTable === 'function') loadTeamsTable();

  } catch (err) {
    console.error('[ERROR] submitPublishDraft:', err);
    showToast('Failed to publish allocation revision', 'error');
    if (btn) btn.disabled = false;
  }
}

// ─── Revision History Modal ───

async function handleOpenRevisionHistory() {
  const modal = document.getElementById('modal-alloc-history');
  const tbody = document.getElementById('alloc-history-tbody');

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 36px 16px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #64748b; font-weight: 500;">
            <div class="btn-spinner" style="border: 2px solid #cbd5e1; border-top-color: #059669; border-radius: 50%; width: 20px; height: 20px; animation: spin 0.8s linear infinite;"></div>
            <span>Loading revision history...</span>
          </div>
        </td>
      </tr>
    `;
  }

  const activeToken = adminToken || localStorage.getItem('rmk_admin_token') ||
                      juryAdminToken || localStorage.getItem('rmk_jury_admin_token') ||
                      judgeToken || localStorage.getItem('rmk_judge_token') || null;

  try {
    const fetchHeaders = {};
    if (activeToken) {
      fetchHeaders['Authorization'] = 'Bearer ' + activeToken;
    }

    let res = await fetch('/api/admin/allocations/revisions', { headers: fetchHeaders });
    if (!res.ok && res.status === 404) {
      res = await fetch('/api/allocations/revisions', { headers: fetchHeaders });
    }

    // Do NOT call sessionExpired(res) which silently aborts and leaves modal stuck!
    if (!res.ok) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center" style="padding: 28px 16px;">
              <div style="color: #ef4444; font-weight: 600; margin-bottom: 8px;">
                Failed to load revision history (Status ${res.status}).
              </div>
              <div style="color: #64748b; font-size: 13px; margin-bottom: 14px;">
                ${res.status === 401 ? 'Authentication required or session expired.' : 'An error occurred while connecting to the server.'}
              </div>
              <button type="button" class="glass-btn glass-btn-secondary btn-xs" onclick="handleOpenRevisionHistory()">
                Retry
              </button>
            </td>
          </tr>
        `;
      }
      return;
    }

    const data = await res.json();
    const revisions = data.revisions || [];

    if (!tbody) return;

    if (revisions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="padding: 32px 16px;">
            No revision history available.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = revisions.map(r => {
      let statusPill = `<span class="status-pill-badge pill-absent">${escapeHtml(r.status || 'UNKNOWN')}</span>`;
      if (r.status === 'PUBLISHED' && (r.is_active === 1 || r.is_active === true)) {
        statusPill = `<span class="status-pill-badge pill-present" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 700; padding: 4px 10px; border-radius: 9999px;">ACTIVE</span>`;
      } else if (r.status === 'PUBLISHED') {
        statusPill = `<span class="status-pill-badge" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">ARCHIVED</span>`;
      } else if (r.status === 'DRAFT') {
        statusPill = `<span class="status-pill-badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700; padding: 4px 10px; border-radius: 9999px;">DRAFT</span>`;
      }

      let dateStr = '—';
      const rawDate = r.published_at || r.created_at;
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        } catch (e) {
          dateStr = String(rawDate);
        }
      }

      const teamCount = r.assigned_count != null ? `${r.assigned_count} teams` : '—';
      const author = r.published_by || r.created_by || 'Admin';
      const notes = r.notes ? escapeHtml(r.notes) : '<span style="color: #94a3b8; font-style: italic;">No notes provided</span>';

      return `
        <tr>
          <td class="mono"><strong style="color: #0f172a; font-size: 13.5px;">Rev #${escapeHtml(String(r.revision_number))}</strong></td>
          <td>${statusPill}</td>
          <td style="color: #334155; font-size: 12.5px; white-space: nowrap;">${escapeHtml(dateStr)}</td>
          <td style="color: #475569; font-weight: 500;">${escapeHtml(author)}</td>
          <td><strong style="color: #059669; font-size: 13px;">${escapeHtml(teamCount)}</strong></td>
          <td style="font-size: 12.5px; color: #475569; line-height: 1.4;">${notes}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('[ERROR] handleOpenRevisionHistory:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center" style="padding: 28px 16px;">
            <div style="color: #ef4444; font-weight: 600; margin-bottom: 8px;">
              Server connection error while loading history.
            </div>
            <div style="color: #64748b; font-size: 13px; margin-bottom: 14px;">
              ${escapeHtml(err.message || 'Unable to connect to the server.')}
            </div>
            <button type="button" class="glass-btn glass-btn-secondary btn-xs" onclick="handleOpenRevisionHistory()">
              Retry
            </button>
          </td>
        </tr>
      `;
    }
  }
}

function closeRevisionHistoryModal() {
  const modal = document.getElementById('modal-alloc-history');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// ─── Attach Allocation handlers to global window scope ───
window.loadAdminAllocations = loadAdminAllocations;
window.handleAllocFilterSearch = handleAllocFilterSearch;
window.setAllocFilter = setAllocFilter;
window.handleAllocPanelFilterChange = handleAllocPanelFilterChange;
window.handleCreateDraftModal = handleCreateDraftModal;
window.closeCreateDraftModal = closeCreateDraftModal;
window.submitCreateDraft = submitCreateDraft;
window.handleAssignTeam = handleAssignTeam;
window.handleMoveTeam = handleMoveTeam;
window.handleRemoveTeam = handleRemoveTeam;
window.handleDiscardDraft = handleDiscardDraft;
window.handleValidateAndOpenPublishModal = handleValidateAndOpenPublishModal;
window.closePublishModal = closePublishModal;
window.togglePublishConfirmBtn = togglePublishConfirmBtn;
window.submitPublishDraft = submitPublishDraft;
window.handleOpenRevisionHistory = handleOpenRevisionHistory;
window.closeRevisionHistoryModal = closeRevisionHistoryModal;

window.handleJudgeProjectSearch = handleJudgeProjectSearch;
window.setJudgeProjectFilter = setJudgeProjectFilter;
