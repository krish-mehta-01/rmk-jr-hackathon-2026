// ════════════════════════════════════════════════════════════════
//  RMK JR. HACKATHON 2026 — OFFICIAL CLIENT APPLICATION
//  Dual Cryptographic Verification · Responsive Workspace
//  Team Details with Mentor · Real-time Attendance Check-in
// ════════════════════════════════════════════════════════════════

// Team leaders use the site root; admins use /rmkjrhackathon2026-adminlogin (flag set in index.html)
const IS_ADMIN_PAGE = document.documentElement.classList.contains('admin-page');

let teamToken = null;
let adminToken = null;
let teamData = null;

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
  if (IS_ADMIN_PAGE) return;
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
  document.getElementById('form-team-login').addEventListener('submit', handleTeamLogin);
  document.getElementById('form-admin-login').addEventListener('submit', handleAdminLogin);
}

// ─────────────────────────────────────────────────────────────
// SESSION RESTORATION
// ─────────────────────────────────────────────────────────────
function restoreSession() {
  if (IS_ADMIN_PAGE) {
    document.title = 'RMK Jr. Hackathon 2026 — Admin';
    adminToken = localStorage.getItem('rmk_admin_token');
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

  document.querySelectorAll('.pass-block-card').forEach(c => c.classList.remove('block-highlight'));
  if (activeBlockId) {
    const activeEl = document.getElementById(activeBlockId);
    if (activeEl) activeEl.classList.add('block-highlight');
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

  // Sitting place and Panel for the team
  const venueRow = document.getElementById('pass-venue-row');
  if (venueRow) {
    venueRow.classList.toggle('hidden', !team.venue && !team.panel_no);
    const venueEl = document.getElementById('pass-venue');
    if (venueEl) {
      if (team.panel_no) {
        venueEl.innerHTML = `<span class="panel-badge-pill">Panel ${team.panel_no}</span> <span>${escapeHtml(team.venue || '')}</span>`;
      } else {
        venueEl.textContent = team.venue || '';
      }
    }
    const themeEl = document.getElementById('pass-venue-theme');
    if (themeEl) {
      themeEl.textContent = team.theme ? `Theme: ${team.theme}` : '';
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

  const secTable = document.getElementById('admin-sec-table');
  const secThemes = document.getElementById('admin-sec-themes');
  const secQR = document.getElementById('admin-sec-qr');

  [alinkTable, alinkThemes, alinkQR].forEach(btn => btn && btn.classList.remove('active'));
  [secTable, secThemes, secQR].forEach(pane => {
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
    alinkThemes.classList.add('active');
    secThemes.classList.remove('hidden');
    secThemes.classList.add('active');
    loadThemes();
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
let currentThemeSearch = '';
const expandedThemes = new Set();

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
    
    // Filter chip logic
    if (filter === 'venue_set' && !hasVenue) return false;
    if (filter === 'venue_missing' && hasVenue) return false;
    if (filter === 'scanned' && (!g.scanned || g.scanned === 0)) return false;

    // Search query logic
    if (query) {
      if (isVenueMode) {
        const matchVenue = (g.venue || '').toLowerCase().includes(query);
        const matchThemes = (g.themes || []).some(t => (t || '').toLowerCase().includes(query));
        const matchTeam = (g.teams || []).some(t => 
          (t.team_code || '').toLowerCase().includes(query) ||
          (t.team_name || '').toLowerCase().includes(query) ||
          (t.leader_name || '').toLowerCase().includes(query) ||
          (t.college_name || '').toLowerCase().includes(query) ||
          (t.project_title || '').toLowerCase().includes(query) ||
          (t.category || '').toLowerCase().includes(query)
        );
        if (!matchVenue && !matchThemes && !matchTeam) return false;
      } else {
        const matchTheme = (g.theme || '').toLowerCase().includes(query);
        const matchVenue = (g.venue || '').toLowerCase().includes(query);
        const matchTeam = (g.teams || []).some(t => 
          (t.team_code || '').toLowerCase().includes(query) ||
          (t.team_name || '').toLowerCase().includes(query) ||
          (t.leader_name || '').toLowerCase().includes(query) ||
          (t.college_name || '').toLowerCase().includes(query) ||
          (t.project_title || '').toLowerCase().includes(query)
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
              ${(g.themes || []).map(t => `<span class="theme-track-pill">${escapeHtml(t)}</span>`).join('')}
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
                  <th>Project & Theme</th>
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
}

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
    a.download = `RMK_Jr_Hackathon_2026_Presence_${Date.now()}.xlsx`;
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

// Wire document click to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-dropdown')) {
    closeDropdowns();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDropdowns();
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
