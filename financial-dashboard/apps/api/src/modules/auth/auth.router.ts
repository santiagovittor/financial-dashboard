import { Router, type IRouter } from 'express';
import passport from 'passport';
import { env } from '../../config/env.js';
import type { AuthenticatedUser } from './auth.types.js';

const router: IRouter = Router();

// Initiates Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  }),
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    // Redirect to frontend login page on failure (works for both dev and prod).
    failureRedirect: `${env.FRONTEND_URL}/login?error=unauthorized`,
    session: true,
  }),
  (_req, res) => {
    // Redirect to frontend root after successful login.
    res.redirect(env.FRONTEND_URL);
  },
);

// Current session user
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ ok: false, error: { message: 'Not authenticated' } });
    return;
  }
  res.json({ ok: true, data: req.user as AuthenticatedUser });
});

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('__fin_sid');
      res.json({ ok: true, data: null });
    });
  });
});

export { router as authRouter };
