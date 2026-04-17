# IT2 Attendance Tracker

## Backend
```bash
cd server
npm install express cors bcryptjs jsonwebtoken uuid
node index.js
```
Runs on http://localhost:5000

## Frontend
```bash
cd client
npm install
npm run dev
```
Runs on http://localhost:5173

## Deploy Frontend To GitHub Pages
GitHub Pages can host the React frontend only.

1. Push your repository to GitHub.
2. Host backend separately (Render, Railway, VPS, etc.).
3. In `client`, create a production env file:
```bash
cp .env.production.example .env.production
```
4. Edit `.env.production` and set your backend URL:
```env
VITE_API_BASE=https://your-backend-domain.com
```
5. Deploy:
```bash
cd client
npm run deploy
```
6. In GitHub repo settings, set Pages source to the `gh-pages` branch.

After deploy, app URLs use hash routes (for example `#/reports`) so page refresh works on GitHub Pages.

## Deploy Backend To Render
1. Push the repo to GitHub.
2. Create a new Render Web Service from the repo root using `render.yaml`, or create one manually with `server` as the root directory.
3. Set `CORS_ORIGIN` to your GitHub Pages URL.
4. Keep `DB_FILE_PATH` pointed at Render's mounted disk path so `db.json` persists between restarts.
5. Deploy the backend and copy its HTTPS URL into `client/.env.production` as `VITE_API_BASE`.

The backend stores data in `db.json` on the mounted disk, so you do not need an external database.

## First run
1. Open http://localhost:5173/signup
2. Sign up with batch = IT2 and you become admin automatically.
3. Add students, mark attendance, and review reports.

## Notes
- The app uses a local `server/db.json` file for persistence and it is ignored by git.
- All protected API calls send `Authorization: Bearer <token>` automatically.
- Only IT2 registrations are accepted.
- Geolocation requires HTTPS in production browsers; deploy behind HTTPS for student self-mark to work.
- GitHub Pages does not run Node.js. The Express backend must be deployed to a separate server.
