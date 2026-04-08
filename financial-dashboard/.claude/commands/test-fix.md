# Test & Fix

Run the full test suite, summarize failures, and apply minimal safe fixes.

## Steps

1. Run all tests:
   ```bash
   pnpm test
   ```

2. For each failing test, identify:
   - Which package (`@fin/shared`, `@fin/api`, `@fin/web`)
   - The failing assertion and the actual vs expected value
   - Whether the failure is in production code or the test itself

3. Fix only issues that are:
   - Type errors or typos in the implementation
   - Off-by-one or wrong constant in a pure utility function
   - Missing Zod field that matches an already-agreed schema

4. Do NOT:
   - Change domain rules to make a test pass
   - Alter financial math (money.ts, fx.ts, budget.ts, recurring.ts) without explicit approval
   - Broaden Zod schemas to accept previously-invalid input
   - Refactor surrounding code that isn't failing

5. After fixes, re-run:
   ```bash
   pnpm test
   pnpm typecheck
   ```

6. Report: tests fixed, tests still failing (with reason), any changes that need my review before applying.
