import cors from 'cors';
import helmet from 'helmet';
import type { Express } from 'express';
import { env } from '../config/env.js';

export function applySecurityMiddleware(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === 'production'
          ? true // enforce strict default CSP in production
          : { useDefaults: true, reportOnly: true }, // report-only in dev — preserves the signal without blocking
    }),
  );

  app.use(
    cors({
      // CORS_ORIGIN is validated at startup: required in production, defaults to
      // localhost in development. See config/env.ts.
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
}
