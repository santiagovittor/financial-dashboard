import type { AuthenticatedUser } from '../modules/auth/auth.types.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: AuthenticatedUser;
  }
}
