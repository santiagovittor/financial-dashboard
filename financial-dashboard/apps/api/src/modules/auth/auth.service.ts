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
            return done(new Error('No email returned from Google'));
          }

          // Owner-only allowlist check
          if (email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) {
            return done(null, false);
          }

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: {
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

          const sessionUser: AuthenticatedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          };

          return done(null, sessionUser);
        } catch (err) {
          return done(err instanceof Error ? err : new Error(String(err)));
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as AuthenticatedUser).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return done(null, false);
      const sessionUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
      done(null, sessionUser);
    } catch (err) {
      done(err);
    }
  });
}
