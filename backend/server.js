// Runs the app as a long-lived server (local development, Render). On Vercel, api/index.js is used instead.
const app = require('./app');
const { testConnection } = require('./db');

const PORT = process.env.PORT || 3000;

// Render's free plan sleeps after 15 min without visits, and the next visit then takes ~1 min.
// In the run-up to the hackathon (15 Nov 2026) the server visits its own public URL every 10 min
// during the day (IST) to stay awake; outside that window it may sleep to save the account's free
// instance hours. A GitHub Action wakes it each morning on the same dates.
// Overrides: KEEP_AWAKE_DATES_IST="2026-11-10..2026-11-15", KEEP_AWAKE_HOURS_IST="6-21", KEEP_AWAKE=off.
const KEEP_AWAKE_URL = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || 'https://rmkjuniorhackathon2026.onrender.com').replace(/\/+$/, '');
const [AWAKE_FROM_DATE, AWAKE_TO_DATE] = (process.env.KEEP_AWAKE_DATES_IST || '2026-11-10..2026-11-15').split('..');
const [AWAKE_FROM, AWAKE_TO] = (process.env.KEEP_AWAKE_HOURS_IST || '6-21').split('-').map(Number);
const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const istHour = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' });

function inKeepAwakeWindow(now = new Date()) {
  const day = istDate.format(now);
  const hour = Number(istHour.format(now));
  return day >= AWAKE_FROM_DATE && day <= AWAKE_TO_DATE && hour >= AWAKE_FROM && hour < AWAKE_TO;
}

function keepAwake() {
  if (!inKeepAwakeWindow()) return;
  fetch(`${KEEP_AWAKE_URL}/api/health`).catch(err => console.warn('[WARN] Keep-awake ping failed:', err.message));
}

app.listen(PORT, async () => {
  console.log(`\n[INFO] RMK Jr. Hackathon Server running on http://localhost:${PORT}`);
  await testConnection();
  if (KEEP_AWAKE_URL && process.env.KEEP_AWAKE !== 'off') {
    keepAwake(); setInterval(keepAwake, 8 * 60 * 1000);
    console.log(`[INFO] Keep-awake on: ${KEEP_AWAKE_URL} every 10 min, ${AWAKE_FROM}:00-${AWAKE_TO}:00 IST, ${AWAKE_FROM_DATE} to ${AWAKE_TO_DATE}`);
  }
});
