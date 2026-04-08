# Financial Dashboard

Personal finance management webapp. Single-owner, Google sign-in, ARS canonical currency.

## Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker + Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and fill in:
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (from [Google Cloud Console](https://console.cloud.google.com/))
- `OWNER_EMAIL` — your Google account email
- `SESSION_SECRET` — a long random string

### 3. Start the database

```bash
docker compose up -d
```

### 4. Run migrations

```bash
pnpm db:migrate:dev
```

### 5. Start development servers

```bash
pnpm dev
```

This starts:
- **Web** → http://localhost:5173
- **API** → http://localhost:3001
- **Prisma Studio** → `pnpm db:studio` (separate)

---

## Project Structure

```
financial-dashboard/
├── apps/
│   ├── web/          # React + Vite + Tailwind frontend
│   └── api/          # Express + TypeScript backend
├── packages/
│   └── shared/       # Shared types and Zod schemas
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm format` | Format all files with Prettier |
| `pnpm db:migrate:dev` | Run Prisma migrations (dev) |
| `pnpm db:migrate:deploy` | Run Prisma migrations (production) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:reset` | Reset database (dev only) |

## Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript, Tailwind CSS 4, React Router 7
- **Backend**: Node.js 20, Express 5, TypeScript, Prisma 6, express-session
- **Database**: PostgreSQL 16
- **Monorepo**: pnpm workspaces + Turborepo
- **Auth**: Google OAuth 2.0 (owner-only allowlist), backend session cookies

---

## Production Deployment

Target architecture: **Vercel** (frontend) + **Railway** (API + Postgres).

> **Custom domain recommended.** Session cookies require a shared registrable
> domain (e.g. `app.yourdomain.com` → Vercel, `api.yourdomain.com` → Railway).
> Random platform preview URLs will not work for cookie-based auth.

### 1. Google Cloud Console setup

1. Go to **APIs & Services → Credentials** and create an OAuth 2.0 Client ID.
2. Add an **Authorized redirect URI** for production:
   ```
   https://api.yourdomain.com/api/v1/auth/google/callback
   ```
   Keep the dev URI (`http://localhost:3001/api/v1/auth/google/callback`) as well.

### 2. Deploy the API on Railway

1. Create a new Railway project and add a **PostgreSQL** service.
2. Add a second service from this GitHub repo. Set:
   - **Root directory**: *(leave blank — repo root is the Docker build context)*
   - **Dockerfile path**: `apps/api/Dockerfile`
3. Set all required environment variables (see table below).
4. Attach a custom domain `api.yourdomain.com` to the API service.
5. Run migrations as a one-time command (Railway → Service → Settings → Deploy → Pre-deploy command, or run manually):
   ```bash
   pnpm --filter @fin/api db:migrate:deploy
   ```

### 3. Deploy the frontend on Vercel

1. Import the repo. Set:
   - **Framework preset**: Vite
   - **Root directory**: `apps/web`
   - **Build command**: `cd ../.. && pnpm build --filter @fin/web`
   - **Output directory**: `dist`
   - **Install command**: `cd ../.. && pnpm install`
2. Add environment variable:
   ```
   VITE_API_URL=https://api.yourdomain.com
   ```
3. Attach custom domain `app.yourdomain.com`.

### 4. Required environment variables

#### API (`apps/api/.env` / Railway service vars)

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | PostgreSQL connection string (Railway provides this) |
| `SESSION_SECRET` | yes | Random secret ≥ 32 chars. Generate: `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | yes | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | yes | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | yes | `https://api.yourdomain.com/api/v1/auth/google/callback` |
| `OWNER_EMAIL` | yes | Your Google account email (owner-only allowlist) |
| `CORS_ORIGIN` | yes | `https://app.yourdomain.com` |
| `FRONTEND_URL` | yes | `https://app.yourdomain.com` (post-OAuth redirect target) |
| `SESSION_COOKIE_DOMAIN` | no | `.yourdomain.com` — only needed to share cookies across subdomains |

#### Frontend (`apps/web/.env` / Vercel env vars)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | yes | `https://api.yourdomain.com` |

### 5. Deployment sequence

```
1. Provision Railway Postgres
2. Set all API env vars on Railway
3. Deploy API → run migrations (pre-deploy command)
4. Set VITE_API_URL on Vercel
5. Deploy frontend
6. Point DNS: app.yourdomain.com → Vercel, api.yourdomain.com → Railway
7. Add production redirect URI to Google Cloud Console
```

### 6. Post-deploy checklist

- [ ] `GET https://api.yourdomain.com/api/v1/health` returns `{ ok: true }`
- [ ] Visiting `https://app.yourdomain.com` redirects to `/login`
- [ ] Clicking "Sign in with Google" completes the OAuth flow and lands on the dashboard
- [ ] Browser DevTools → Application → Cookies shows `__fin_sid` with `Secure` and `HttpOnly` flags
- [ ] Hard-refreshing any deep route (e.g. `/expenses`) does not return a 404
