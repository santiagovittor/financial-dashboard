# Security Review

Review the backend for common finance-app security issues. Report findings grouped by severity (critical / high / low). Fix only issues I explicitly approve.

## Areas to check

### Auth & session
- `apps/api/src/middleware/requireAuth.ts` — applied to all routes except `/auth/*` and `/health`?
- `apps/api/src/config/session.ts` — `httpOnly`, `secure` (in prod), `sameSite`, `maxAge` set?
- `apps/api/src/modules/auth/` — OAuth callback validates state? Only `OWNER_EMAIL` allowed?
- Session secret sourced from env, never hardcoded?

### Input validation
- Every route handler calls a Zod schema before DB access?
- No `req.body` fields passed raw to Prisma queries?
- Numeric fields (amounts, rates) validated as positive finite numbers?
- `fxSnapshotId` references validated to belong to the authenticated user?

### Upload & document boundary
- `apps/api/src/modules/documents/documents.router.ts` — MIME type whitelist and size limit enforced via multer?
- `rawExtractedJson` never used to derive `arsAmount` or create canonical entries without APPROVED review?
- Checksum stored on upload (`SourceDocument.checksum`)?

### Sensitive logging
- No `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`, or user PII in logs?
- `apps/api/src/middleware/requestLogger.ts` — request body logged? Auth headers stripped?

### HTTP hardening
- `helmet` applied before routes?
- `cors` restricted to `CORS_ORIGIN` env var only?
- No stack traces in production error responses?

## Output format
For each finding: file path, line reference, issue description, recommended fix.
