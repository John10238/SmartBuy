# SmartBuy — Render / Railway Deployment Guide

## Architecture

On Render / Railway the entire app runs as **one service**:
- Express serves the compiled frontend from `artifacts/pos/dist/public/`
- All API routes are available at `/api/*`
- Database migrations run automatically at every server startup (idempotent)

---

## Quick Start — Render

### 1. Connect your repo

Push this repository to GitHub and connect it in the Render dashboard.

### 2. Create a PostgreSQL database

In Render → New → PostgreSQL. Note the **Internal Database URL**.

### 3. Create a Web Service

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `pnpm install --frozen-lockfile && pnpm run build` |
| Start Command | `pnpm run start` |
| Health Check Path | `/api/healthz` |
| Auto-Deploy | Yes |

> **Tip:** The included `render.yaml` file automates all of the above. Just click **"New → Blueprint"** in Render and point it at this repo.

### 4. Set Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | Set to `production` |
| `DATABASE_URL` | ✅ | Postgres connection string (Render provides this automatically via render.yaml) |
| `SESSION_SECRET` | ✅ | A long random string — Render can auto-generate this |
| `MPESA_CONSUMER_KEY` | ✅ | Safaricom Daraja consumer key |
| `MPESA_CONSUMER_SECRET` | ✅ | Safaricom Daraja consumer secret |
| `MPESA_SHORTCODE` | ✅ | Your paybill / till number |
| `MPESA_PASSKEY` | ✅ | Daraja passkey |
| `MPESA_CALLBACK_URL` | ✅ | Full HTTPS URL Safaricom will POST callbacks to, e.g. `https://your-app.onrender.com/api/mpesa/callback` |
| `MPESA_ENVIRONMENT` | ✅ | `production` or `sandbox` |

`PORT` is set automatically by Render and does **not** need to be specified.

---

## Quick Start — Railway

### 1. Create a new project

```
railway init
railway up
```

### 2. Add a PostgreSQL plugin

In the Railway dashboard → New Plugin → PostgreSQL. Railway will inject `DATABASE_URL` automatically.

### 3. Set Environment Variables (same table as above)

### 4. Build & Start settings (railway.toml or dashboard)

| Setting | Value |
|---|---|
| Build Command | `pnpm install --frozen-lockfile && pnpm run build` |
| Start Command | `pnpm run start` |

---

## How Migrations Work

`runMigrations()` is called **before** the HTTP server starts on every boot.
All `CREATE TABLE` and `CREATE INDEX` statements use `IF NOT EXISTS`, so they are safe to run multiple times.

On the very first boot a default admin account is created:
- **username:** `admin`
- **password:** `admin`

**Change this password immediately** from the Settings → Staff panel after first login.

---

## M-Pesa Callback URL

Safaricom requires the callback URL to be a **publicly accessible HTTPS endpoint**.
Set `MPESA_CALLBACK_URL` to:

```
https://<your-render-domain>.onrender.com/api/mpesa/callback
```

The callback endpoint (`/api/mpesa/callback`) is always **public** — it is explicitly excluded from session/auth middleware.

---

## pnpm Workspaces on Render

Render and Railway both support pnpm natively. `pnpm install --frozen-lockfile` installs **all** dependencies (including devDependencies needed for the Vite build). Do **not** use `--prod` for the install step — the frontend build requires dev packages.

---

## Useful Commands

```bash
# Full production build locally
pnpm run build

# Start the production server locally (requires env vars)
NODE_ENV=production DATABASE_URL=... SESSION_SECRET=... pnpm run start

# Type-check the whole monorepo
pnpm run typecheck
```
