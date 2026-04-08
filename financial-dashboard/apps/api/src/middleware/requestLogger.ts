import morgan from 'morgan';
import type { Express } from 'express';
import { env } from '../config/env.js';

export function applyRequestLogger(app: Express): void {
  // 'combined' includes Referer/User-Agent which can leak URL tokens.
  // 'common' logs the same useful fields (IP, method, path, status) without them.
  const format = env.NODE_ENV === 'production' ? 'common' : 'dev';
  app.use(morgan(format));
}
