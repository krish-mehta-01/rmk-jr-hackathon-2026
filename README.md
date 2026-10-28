# RMK Jr. Hackathon 2026 — Presence Portal

Team leaders log in on their phones and scan the venue QR code to mark their team present. Admins see who has and hasn't scanned.

## Structure

```
backend/    Express API + TiDB Cloud (server.js, db.js, import-excel.js, .env)
frontend/   Static site served by the backend (index.html, app.js, style.css, assets/)
```

There is one copy of each frontend file — edit `frontend/` directly.

## Configure `backend/.env`

| Key | Purpose |
|-----|---------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | TiDB Cloud connection |
| `JWT_SECRET` | Signs login sessions (required) |
| `QR_PRESENCE_CODE_64` | The 64-digit code inside the venue QR (required). Changing it invalidates printed QRs. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin login. The database is updated to match on every server start. |

## Run

```bash
cd backend && npm install     # first time only
npm start                     # from the project root or backend/
```

Open http://localhost:3000. The server creates/updates the tables on start.

## Import teams from the Google Form Excel

```bash
cd backend
npm run import -- "C:\path\to\Junior Hackathon 2026 (Responses).xlsx"
```

Rows are matched by the sheet's **TEAM ID** column; re-importing a newer sheet adds new teams and updates details without touching scan status. Teams in the database that are missing from the sheet are listed, never deleted. The file path is required.

## Team leader login

**Team ID + team leader phone number.** The Team ID box shows the fixed `RMKJH2610` prefix, so leaders type only the last two digits (`49` → `RMKJH261049`); the phone box shows `+91`. Some schools registered several teams under one phone number, so the Team ID picks the team and the phone number confirms it.

## Live site (Render)

- Team leaders: https://rmkjuniorhackathon2026.onrender.com
- Admins: https://rmkjuniorhackathon2026.onrender.com/rmkjrhackathon2026-adminlogin

Render free web service `rmkjuniorhackathon2026` (Singapore) on the rmkec.ac.in Render account, built from the `main` branch of the private GitHub repo `krish-mehta-01/rmk-jr-hackathon-2026`.

- Service settings: root `backend`, build `npm ci`, start `node server.js`, health check `/api/health`.
- Secrets are set as Render environment variables (same keys as `backend/.env`, plus `NODE_VERSION=22`). `.env` is never committed.
- Free instances sleep after 15 minutes without visitors (the next visit then takes about a minute). To avoid that:
  - from 27 Oct to 1 Nov 2026 (hackathon day), 6 AM to 9 PM IST, the server pings its own `/api/health` every 10 minutes (`backend/server.js`; change with the `KEEP_AWAKE_DATES_IST` env var, e.g. `2026-10-27..2026-11-02`, and `KEEP_AWAKE_HOURS_IST`, e.g. `5-23`, or turn it off with `KEEP_AWAKE=off`);
  - on the same dates the GitHub Action `.github/workflows/wake-render.yml` wakes it at about 6:10 AM IST (run it by hand from the repo's Actions tab if needed).
  - The window keeps usage inside Render's 750 free instance-hours per month, which are shared with any other free Render services on the account.
- Pushes to `main` sometimes deploy automatically and sometimes don't: after pushing, check the Render dashboard and use **Manual Deploy → Deploy latest commit** if no new deploy started.

Phone cameras only work on **https://** pages, so always share the onrender.com link, not `http://<laptop-ip>:3000`.

## Before the event

Reset any test scans:

```sql
UPDATE teams SET is_present = FALSE, check_in_time = NULL, qr_verification_token = NULL;
DELETE FROM attendance_log;
```
