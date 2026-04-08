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
// Use passport's callback form (3rd arg to authenticate) so that each step in
// the flow — strategy verification, req.logIn, session save — has an explicit
// log and error handler. The middleware-wrapping pattern merges all of those
// into one opaque error path, making Railway logs useless for diagnosis.
router.get('/google/callback', (req, res, next) => {
  console.log('[auth/callback] entered');

  passport.authenticate(
    'google',
    (err: unknown, user: AuthenticatedUser | false, _info: unknown) => {
      // Strategy-level error: state mismatch, token exchange failure, DB error
      // in verify callback, etc.
      if (err) {
        console.error(
          '[auth/callback] strategy error:',
          err instanceof Error ? err.stack : String(err),
        );
        res.redirect(`${env.FRONTEND_URL}/login?error=server`);
        return;
      }

      // Strategy returned false: owner allowlist check failed or no email
      if (!user) {
        console.warn('[auth/callback] strategy returned no user — unauthorized');
        res.redirect(`${env.FRONTEND_URL}/login?error=unauthorized`);
        return;
      }

      console.log('[auth/callback] strategy returned user:', user.id);

      // Explicitly establish the session. In passport's callback form this is
      // our responsibility. req.logIn serializes the user and saves the session.
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error(
            '[auth/callback] req.logIn error:',
            loginErr instanceof Error ? loginErr.stack : String(loginErr),
          );
          res.redirect(`${env.FRONTEND_URL}/login?error=server`);
          return;
        }

        console.log('[auth/callback] session established, redirecting to frontend');
        res.redirect(env.FRONTEND_URL);
      });
    },
  )(req, res, next);
});

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
