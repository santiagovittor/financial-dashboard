/**
 * Pure FX snapshot resolution.
 *
 * These functions operate on plain data arrays so they can be tested without
 * any database dependency. The DB-backed resolver lives in apps/api/src/lib/fx.ts.
 */

export interface FxSnapshotLike {
  effectiveDate: Date;
  rate: number;
}

/**
 * Find the FX snapshot applicable on `targetDate`.
 *
 * Returns the snapshot with the latest effectiveDate ≤ targetDate.
 * Returns null if no snapshot qualifies (i.e. no rate has been set yet for
 * any date before or on the target).
 *
 * Input order does not matter.
 */
export function findApplicableRate<T extends FxSnapshotLike>(
  snapshots: T[],
  targetDate: Date,
): T | null {
  const target = toDateOnly(targetDate);
  const eligible = snapshots.filter((s) => toDateOnly(s.effectiveDate) <= target);
  if (eligible.length === 0) return null;
  return eligible.reduce((latest, s) =>
    toDateOnly(s.effectiveDate) > toDateOnly(latest.effectiveDate) ? s : latest,
  );
}

/**
 * Build a lookup map of currency → rate from a collection of snapshots,
 * resolving each currency to the rate applicable on `targetDate`.
 *
 * The caller typically passes all snapshots loaded for a user; this function
 * deduplicates by fromCurrency and returns only the most recent applicable rate.
 */
export function buildFxRateMap(
  snapshots: Array<FxSnapshotLike & { fromCurrency: string; toCurrency: string }>,
  targetDate: Date,
): Map<string, number> {
  // Group by fromCurrency, then resolve the applicable rate for each
  const byCurrency = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    if (snap.toCurrency !== 'ARS') continue; // we only care about → ARS for now
    const group = byCurrency.get(snap.fromCurrency) ?? [];
    group.push(snap);
    byCurrency.set(snap.fromCurrency, group);
  }

  const result = new Map<string, number>();
  for (const [currency, group] of byCurrency) {
    const applicable = findApplicableRate(group, targetDate);
    if (applicable) result.set(currency, applicable.rate);
  }
  // ARS → ARS is always 1
  result.set('ARS', 1);
  return result;
}

function toDateOnly(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
