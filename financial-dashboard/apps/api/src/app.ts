import express, { type Express } from 'express';
import session from 'express-session';
import passport from 'passport';
import { env } from './config/env.js';
import { buildSessionOptions } from './config/session.js';
import { pgPool } from './lib/pgPool.js';
import { applyRequestLogger } from './middleware/requestLogger.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { configurePassport } from './modules/auth/auth.service.js';
import type { AuthenticatedUser } from './modules/auth/auth.types.js';
import { v1 } from './routes/v1/index.js';

export function createApp(): Express {
  const app = express();

  // Railway (and most PaaS) terminate TLS at the proxy layer. Trust the first
  // hop so req.ip / req.protocol are correct and secure cookies are set.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Security and logging
  applySecurityMiddleware(app);
  applyRequestLogger(app);

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session
  app.use(session(buildSessionOptions(pgPool)));

  // Passport
  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport puts the deserialized user in req.user; route handlers read
  // req.session.user, so bridge the two here once after session hydration.
  app.use((req, _res, next) => {
    if (req.user) req.session.user = req.user as AuthenticatedUser;
    next();
  });

  // Routes
  app.use('/api/v1', v1);

  // Central error handler (must be last)
  app.use(errorHandler);

  return app;
}
