# Financial Dashboard — Claude Code Context

Personal finance webapp. Single-owner, Google OAuth, ARS canonical currency.

## Key References
- Domain rules: [docs/domain-model.md](docs/domain-model.md) — read before touching financial logic
- Data model: [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)
- Shared utilities: [packages/shared/src/utils/](packages/shared/src/utils/)
- Shared types/schemas: [packages/shared/src/](packages/shared/src/)
- API entry: [apps/api/src/app.ts](apps/api/src/app.ts)
- Frontend entry: [apps/web/src/router.tsx](apps/web/src/router.tsx)

## Commands

```bash
pnpm install                  # install all workspaces
pnpm dev                      # start web + api (Turbo)
pnpm test                     # run all tests (Vitest)
pnpm typecheck                # TS check all packages
pnpm lint                     # ESLint all packages
pnpm db:migrate:dev           # apply Prisma migrations (dev)
pnpm db:seed                  # seed dev data (apps/api)
pnpm db:studio                # open Prisma Studio
docker compose up -d          # start PostgreSQL 16
```

## Architecture
- **Monorepo**: pnpm workspaces + Turborepo (`apps/api`, `apps/web`, `packages/shared`)
- **Backend**: Express 5 + Prisma 6 + PostgreSQL 16, port 3001
- **Frontend**: React 19 + Vite 6 + Tailwind CSS 4 + React Router 7, port 5173
- **Shared**: Zod schemas + Decimal.js utilities — imported by both sides
- **Auth**: Google OAuth via Passport; owner-only allowlist via `OWNER_EMAIL`; sessions in PG via `connect-pg-simple`

## Domain Rules (never violate)
1. **ARS is canonical.** All reporting in ARS. Supported currencies: ARS, USD, USDT.
2. **Financial facts are immutable.** `IncomeEntry`, `ExpenseEntry`, `DebtPayment` have no update endpoints. Corrections use new entries.
3. **FX provenance required.** Every monetary record must store `originalAmount`, `originalCurrency`, `fxRate`, `arsAmount`, `fxSnapshotId`. Use `toArs()` from `@fin/shared/utils/fx.ts`.
4. **Recurring commitments use append-only versioning.** Amount changes = new `RecurringCommitmentVersion` row, never update existing.
5. **Document extraction review boundary.** Extracted data never enters canonical tables without explicit APPROVED review + user confirmation per item. `rawExtractedJson` is untrusted input.
6. **Historical accuracy.** Never recalculate past `arsAmount` with current rates. Preserve the original `fxSnapshotId`.

## Security Expectations
- All routes behind `requireAuth` middleware except `/auth/*` and `/health`
- Validate all request bodies with Zod before touching the DB
- No sensitive values (session secret, OAuth secrets) in logs
- Uploaded files treated as untrusted; checksummed on receipt
- `helmet` + `cors` configured in `src/middleware/security.ts`

## Testing Expectations
- Tests live in `__tests__/` directories, run with Vitest
- `packages/shared` has the most critical tests — all pure financial logic must be covered
- `apps/api` tests cover Zod validation schemas
- Never mock the database in integration tests that touch financial calculations
- Run `pnpm test` from root; or per-package with `pnpm --filter @fin/shared test`

## UI Work
- **Always use the `frontend-design` skill** for any non-trivial UI implementation: `/frontend-design`
- UI lives entirely in `apps/web/src/` — no backend changes from UI tasks unless explicitly requested
- Tailwind CSS 4 only — no component library
- Prefer the existing layout shell: `AppShell.tsx`, `Header.tsx`, `Sidebar.tsx`

## What Is Deferred (don't add)
Live FX quotes, projection/forecasting, OCR/CSV parsing, background jobs, multi-user, per-transaction FX override, achievement system. See `docs/domain-model.md` for full list.
