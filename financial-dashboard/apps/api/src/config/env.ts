import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    // Post-OAuth redirect target. Defaults to localhost in dev.
    // Must be set explicitly in production (e.g. https://app.yourdomain.com).
    FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').default('http://localhost:5173'),
    // Optional: set to .yourdomain.com to share the session cookie across
    // subdomains (e.g. app.yourdomain.com ↔ api.yourdomain.com).
    SESSION_COOKIE_DOMAIN: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    GOOGLE_CALLBACK_URL: z.string().url('GOOGLE_CALLBACK_URL must be a valid URL'),
    OWNER_EMAIL: z.string().email('OWNER_EMAIL must be a valid email'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    // Directory for uploaded document files. Defaults to ./uploads relative to
    // the process working directory. In production, set to an absolute path or
    // replace the file storage layer with S3 / object storage.
    UPLOADS_DIR: z.string().default('./uploads'),
    // ─── AI extraction ────────────────────────────────────────────────────────
    // Optional. When set, PDF documents are analyzed by Gemini.
    // Get a key at https://aistudio.google.com/app/apikey
    GEMINI_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.NODE_ENV === 'production' &&
      data.CORS_ORIGIN === 'http://localhost:5173'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN must be set explicitly in production (localhost default is not allowed)',
      });
    }
    if (
      data.NODE_ENV === 'production' &&
      data.FRONTEND_URL === 'http://localhost:5173'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FRONTEND_URL'],
        message: 'FRONTEND_URL must be set explicitly in production (localhost default is not allowed)',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
