import type { SessionOptions } from 'express-session';
import type { Pool } from 'pg';
import { env } from './env.js';

export function buildSessionOptions(pgPool: Pool): SessionOptions {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PgSession = require('connect-pg-simple')(require('express-session'));

  return {
    store: new PgSession({
      pool: pgPool,
      tableName: 'sessions',
      createTableIfMissing: true,
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: '__fin_sid',
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      // In production the frontend (Vercel) and API (Railway) are on different
      // eTLD+1 domains. SameSite=Lax would block the cookie on cross-site fetch()
      // calls (e.g. /auth/me from JS), even with credentials: 'include'. We need
      // SameSite=None so the browser attaches the cookie on cross-origin fetches.
      // SameSite=None requires Secure=true, which is already enforced in production.
      // In dev we stay on 'lax' because localhost requests are same-site.
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      // Set to '.yourdomain.com' via SESSION_COOKIE_DOMAIN to share the cookie
      // across subdomains (e.g. app.yourdomain.com ↔ api.yourdomain.com).
      domain: env.SESSION_COOKIE_DOMAIN,
    },
  };
}
