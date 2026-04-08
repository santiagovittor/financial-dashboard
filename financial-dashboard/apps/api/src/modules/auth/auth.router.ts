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
//
// passport.authenticate's failureRedirect only fires for done(null, false).
// When done(err) is called (e.g. DB error in verify callback), passport calls
// next(err) which would reach the global JSON error handler — wrong for a
// browser OAuth redirect. We intercept the next call here and redirect instead.
const googleCallbackAuth = passport.authenticate('google', {
  failureRedirect: `${env.FRONTEND_URL}/login?error=unauthorized`,
  session: true,
});

router.get(
  '/google/callback',
  (req, res, next) => {
    console.log('[auth/callback] received Google callback');
    googleCallbackAuth(req, res, (err: unknown) => {
      if (err) {
        console.error('[auth/callback] error during authenticate:', err instanceof Error ? err.stack : String(err));
        res.redirect(`${env.FRONTEND_URL}/login?error=server`);
        return;
      }
      next();
    });
  },
  (req, res) => {
    console.log('[auth/callback] success, user present:', !!req.user);
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
