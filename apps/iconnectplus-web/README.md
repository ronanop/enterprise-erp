# iconnectplus.in website

React (Vite) marketing + legal site for **iConnect Plus**, ready to deploy on
**Hostinger Node.js**.

## Routes (also used by the Employee App)

| Path | Purpose |
|------|---------|
| `/` | Marketing home |
| `/app` | Employee app / store marketing page |
| `/support` | Support |
| `/legal/privacy` | Privacy Policy |
| `/legal/terms` | Terms of Use |
| `/legal/data-deletion` | Account / data deletion web form |

## Local development

```bash
cd apps/iconnectplus-web
npm install
npm run dev
```

## Production (Hostinger Node.js)

**Node.js version: 20** (set in hPanel → Node.js → Node version, or via `.nvmrc` / `engines.node`).

1. Connect GitHub repo `ronanop/iconnect` (or upload this folder as the app root).
2. Node version: **20.x**
3. Build command: `npm install && npm run build`
4. Start command: `npm start` (runs `node server.js`)
5. Hostinger sets `PORT` — `server.js` listens on `0.0.0.0:$PORT` and serves `dist/` with SPA fallback.
6. Health check: `GET /health` → `ok`

```bash
npm install
npm run build
npm start
```

If the site returns **503**, the Node process usually failed to start — confirm Node **20**, rebuild, and check logs for `Missing dist/index.html` or Express errors.

Point the domain **iconnectplus.in** (and `www`) at this Node app.

## After deploy — mark checklist done

When these URLs return the real pages (not the old SPA catch-all):

- https://iconnectplus.in/legal/privacy
- https://iconnectplus.in/legal/terms
- https://iconnectplus.in/legal/data-deletion
- https://iconnectplus.in/support

Tell Cursor to mark legal checklist items done.
