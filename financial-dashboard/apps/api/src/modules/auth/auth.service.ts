import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import type { AuthenticatedUser } from './auth.types.js';

export function configurePassport(): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        state: true,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            console.error('[auth] verify: Google profile returned no email; googleId present:', !!profile.id);
            return done(new Error('No email returned from Google'));
          }

          // Owner-only allowlist check
          if (email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) {
            console.warn('[auth] verify: non-owner login attempt blocked');
            return done(null, false);
          }

          console.log('[auth] verify: upserting user by email');

          // Upsert by email, not googleId — the seed (and any manual user creation)
          // may have created the owner record without a googleId. Upserting by
          // googleId would fail with a P2002 unique constraint on email because it
          // can't find the existing row and tries to INSERT a duplicate email.
          const user = await prisma.user.upsert({
            where: { email },
            update: {
              googleId: profile.id,
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value ?? null,
            },
            create: {
              email,
              googleId: profile.id,
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value ?? null,
            },
          });

          console.log('[auth] verify: upsert succeeded, user id:', user.id);

          const sessionUser: AuthenticatedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          };

          return done(null, sessionUser);
        } catch (err) {
          console.error('[auth] verify: unexpected error:', err instanceof Error ? err.stack : String(err));
          return done(err instanceof Error ? err : new Error(String(err)));
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    const id = (user as AuthenticatedUser).id;
    console.log('[auth] serializeUser: id present:', !!id);
    done(null, id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        console.warn('[auth] deserializeUser: no user found for id:', id);
        return done(null, false);
      }
      const sessionUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
      done(null, sessionUser);
    } catch (err) {
      console.error('[auth] deserializeUser error:', err instanceof Error ? err.stack : String(err));
      done(err);
    }
  });
}
