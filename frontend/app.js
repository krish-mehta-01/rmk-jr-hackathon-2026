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
let autoScanTried = false;   // the camera opens by itself once per login; after "Close Camera" it stays closed

// ─────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  restoreSession();
});

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
    autoOpenScanner();
    refreshTeamStatus();
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

  // Team IDs are RMKJH2610 + two digits; leaders type only the digits ("5" means "05")
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
      body: JSON.stringify({ team_id: 'RMKJH2610' + idDigits.padStart(2, '0'), phone })
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
    autoOpenScanner();

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
}

function renderTeamDetails(team) {
  if (!team) return;

  document.getElementById('pass-team-name').textContent = team.team_name || 'Team';
  document.getElementById('pass-project-title').textContent = team.project_title || team.team_name || '—';
  document.getElementById('pass-school-name').textContent = team.college_name || '—';
  document.getElementById('pass-mentor-name').textContent = team.mentor_name || '—';

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

  if (isPresent) {
    timeSub.textContent = checkInTime
      ? new Date(checkInTime).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
      : '';
    closeScanner();
  }
}

async function refreshTeamStatus() {
  if (!teamToken) return;
  try {
    const res = await fetch('/api/team/status', {
      headers: { Authorization: 'Bearer ' + teamToken }
    });
    if (sessionExpired(res) || !res.ok) return;

    const updated = await res.json();
    teamData = { ...teamData, ...updated };
    localStorage.setItem('rmk_team_data', JSON.stringify(teamData));
    initTeamDashboard();
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// STUDENT QR SCANNER (SCANS VENUE STANDEE)
// ─────────────────────────────────────────────────────────────
// Right after login the camera opens by itself, so the leader just points it at the venue QR. If the browser
// blocks or the leader denies the camera, the "Scan QR Code" button is still there to try again.
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
        submitAttendance(code.data.trim());
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
  const alinkQR = document.getElementById('alink-qr');

  const secTable = document.getElementById('admin-sec-table');
  const secQR = document.getElementById('admin-sec-qr');

  [alinkTable, alinkQR].forEach(btn => btn && btn.classList.remove('active'));
  [secTable, secQR].forEach(pane => {
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

  let url = '/api/admin/teams?limit=200';
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
          <span class="status-pill-badge ${isPresent ? 'pill-present' : 'pill-absent'}">${isPresent ? 'Scanned' : 'Not Scanned'}</span>
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
            <div><dt>Idea Title</dt><dd>${escapeHtml(t.project_title || '—')}</dd></div>
            <div><dt>Team Members</dt><dd>${membersListItems(t, false) ? `<ol class="members-ol">${membersListItems(t, false)}</ol>` : '—'}</dd></div>
            <div><dt>Leader Contact</dt><dd class="mono">${escapeHtml(t.mobile_no || '—')}</dd></div>
            <div><dt>Scanned Time</dt><dd>${scannedAt}</dd></div>
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
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #ffffff; color: #0f172a; }
          .card { text-align: center; border: 2.5px solid #0f172a; border-radius: 20px; padding: 40px 30px; max-width: 480px; width: 100%; box-sizing: border-box; }
          .logos { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 24px; }
          .logos img { height: 50px; object-fit: contain; }
          .pipe { width: 2px; height: 36px; background: #10b981; }
          h1 { margin: 0 0 24px 0; font-size: 26px; font-weight: 900; }
          .qr img { width: 300px; height: 300px; margin: 0 auto 24px auto; display: block; }
          p { margin: 0; font-size: 14px; font-weight: 600; color: #475569; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logos">
            <img src="/assets/rmk_group_logo.png" />
            <div class="pipe"></div>
            <img src="/assets/rmk_jr_hackathon_2026_logo.png" />
          </div>
          <h1>RMK Junior Hackathon 2026</h1>
          <div class="qr"><img src="${permanentQRCodeData}" /></div>
          <p>Scan this QR code from your team login to mark your team's presence.</p>
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
