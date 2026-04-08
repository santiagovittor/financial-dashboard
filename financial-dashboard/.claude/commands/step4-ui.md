# Step 4 — First Frontend Implementation Pass

Use the `frontend-design` skill for all visual and component work in this session.

## Scope
- Work exclusively in `apps/web/src/`
- Do not modify `apps/api/`, `packages/shared/`, or Prisma schema
- Do not change domain rules or FX logic

## Before starting
1. Read `apps/web/src/router.tsx` — understand existing routes
2. Read `apps/web/src/components/layout/` — use the existing shell (AppShell, Header, Sidebar)
3. Read `apps/web/src/pages/` — understand what pages exist and their current state
4. Check `packages/shared/src/types/` for types the UI should use

## Implementation approach
- Invoke `/frontend-design` for each new page or major component
- Use Tailwind CSS 4 utility classes only — no new dependencies
- Consume the API at `VITE_API_URL` (from `import.meta.env.VITE_API_URL`)
- All currency display: show ARS as canonical, with original currency as secondary label
- Immutable data: no edit/delete UI for IncomeEntry, ExpenseEntry, DebtPayment
- Document review items: show extracted data as "pending review" — never auto-import

## Quality checks (run after each page)
```bash
pnpm --filter @fin/web typecheck
pnpm lint
```
