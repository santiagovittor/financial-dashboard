import type { RequestHandler } from 'express';

/**
 * Auth guard for all protected finance endpoints.
 *
 * All /api/v1/* routes except /auth and /health are protected.
 * Since this is a single-owner app, any authenticated session IS the owner.
 * If multi-user support is added, insert an owner-role check here.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({
      ok: false,
      error: { message: 'Authentication required', code: 'UNAUTHENTICATED' },
    });
    return;
  }
  next();
};
