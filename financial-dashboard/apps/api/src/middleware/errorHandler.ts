import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: { message: err.message, code: err.code },
    });
    return;
  }

  if (env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(500).json({
    ok: false,
    error: { message: 'Internal server error' },
  });
};
