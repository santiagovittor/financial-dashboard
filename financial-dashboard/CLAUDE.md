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
5. **Document extraction review boundary.** Extracted data never enters canonical tables without explicit APPROVED review + user confirmation per item. `rawExtractedJson` is untrusted input — treat it like user-supplied data.
6. **Historical accuracy.** Never recalculate past `arsAmount` with current rates. Preserve the original `fxSnapshotId`.

## Document Extraction Pipeline
The heuristic (regex) extractor has been removed. The active extraction strategy uses the Claude API directly with the raw PDF buffer — no separate text extraction step needed.

- Upload → `SourceDocument` → `DocumentExtraction.rawExtractedJson` (untrusted)
- Extraction provider interface: `apps/api/src/modules/documents/extraction/types.ts`
- `ExtractionProvider` accepts `(buffer: Buffer, mimeType: string, docType: string)`
- Extraction result stored as `rawExtractedJson`; never auto-imported
- See domain rule 5 for the review gate requirement

When implementing the Claude-based provider:
- Use the `statement-analysis-design` skill: `/statement-analysis-design`
- Model: `claude-haiku-4-5-20251001` for cost; upgrade to Sonnet if accuracy is insufficient
- Validate Claude's JSON response with Zod before storing — it is untrusted input

## Security Expectations
- All routes behind `requireAuth` middleware except `/auth/*` and `/health`
- Validate all request bodies with Zod before touching the DB
- No sensitive values (session secret, OAuth secrets) in logs
- Uploaded files treated as untrusted; checksummed on receipt; stored at `env.UPLOADS_DIR`
- `helmet` + `cors` configured in `src/middleware/security.ts`
- Upload boundary + MIME type enforcement in `src/modules/documents/documents.router.ts`

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

## Code Quality
- No dead code or commented-out paths — delete, don't comment out
- No new production dependencies without a concrete, immediate justification
- Every new monetary field must carry full FX provenance (rule 3)
- After editing `apps/api/` run `pnpm --filter @fin/api typecheck`
- After editing `apps/web/` run `pnpm --filter @fin/web typecheck`
- After editing `packages/shared/` run `pnpm --filter @fin/shared typecheck`

## Commit Style
- Describe the change in imperative mood: `feat(documents): add Claude extraction provider`
- No Claude attribution, co-author lines, "Generated with" footers, or AI signatures
- Scope to the affected package or feature: `fix(api)`, `feat(web)`, `chore(repo)`

## What Is Deferred (don't add)
Live FX quotes, projection/forecasting, OCR/CSV parsing, background jobs, multi-user, per-transaction FX override, achievement system. See `docs/domain-model.md` for full list.
