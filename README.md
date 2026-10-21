# RMK Jr. Hackathon 2026 — Presence Portal

Team leaders log in on their phones and scan the venue QR code to mark their team present. Admins see who has and hasn't scanned.

## Structure

```
backend/    Express API + TiDB Cloud (server.js, db.js, import-excel.js, schema.sql, .env)
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

Rows are matched by team leader contact number; re-importing updates details without touching scan status.

## Team leader login

Registered contact number, or the leader's full name as registered (initials optional, e.g. `Janani` for `S. Janani`).

## Hosting for hackathon day

Phone cameras only work on **https://** pages, so the portal must be reachable over HTTPS (e.g. a cloud host with HTTPS, or an HTTPS tunnel to this machine). `http://<laptop-ip>:3000` will not be able to open the camera.

## Before the event

Reset any test scans:

```sql
UPDATE teams SET is_present = FALSE, check_in_time = NULL, qr_verification_token = NULL;
DELETE FROM attendance_log;
```
