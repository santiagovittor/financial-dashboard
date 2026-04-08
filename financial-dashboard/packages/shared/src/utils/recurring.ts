/**
 * Effective-date resolution for recurring commitment versions.
 *
 * A commitment can have its amount changed over time. Each change is recorded
 * as a new version with an effectiveFrom date. This module provides the
 * function to resolve "which version is active for a given date?"
 */

export interface VersionedAmount {
  effectiveFrom: Date;
  originalAmount: number;
  originalCurrency: string;
}

/**
 * Find the version active on `targetDate`.
 *
 * Returns the version with the latest effectiveFrom that is ≤ targetDate.
 * Returns null if no version has started by targetDate.
 *
 * Input versions may be in any order; the function handles sorting internally.
 */
export function resolveEffectiveVersion<T extends VersionedAmount>(
  versions: T[],
  targetDate: Date,
): T | null {
  // Normalize to midnight UTC for date-only comparison
  const target = startOfDay(targetDate);
  const eligible = versions.filter((v) => startOfDay(v.effectiveFrom) <= target);
  if (eligible.length === 0) return null;
  return eligible.reduce((latest, v) =>
    startOfDay(v.effectiveFrom) > startOfDay(latest.effectiveFrom) ? v : latest,
  );
}

/**
 * Return all versions that are active within the given date range [from, to].
 * Useful for computing how much a commitment cost over a time window where
 * the amount may have changed mid-period.
 */
export function versionsActiveInRange<T extends VersionedAmount>(
  versions: T[],
  from: Date,
  to: Date,
): T[] {
  if (from > to) throw new Error('from must be ≤ to');
  const sorted = [...versions].sort(
    (a, b) => startOfDay(a.effectiveFrom).getTime() - startOfDay(b.effectiveFrom).getTime(),
  );

  const result: T[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1];
    const versionStart = startOfDay(current.effectiveFrom);
    const versionEnd = next ? startOfDay(next.effectiveFrom) : null;

    // Version overlaps the range if it started before `to` and ended (or is open) after `from`
    const startedBeforeTo = versionStart <= startOfDay(to);
    const endedAfterFrom = versionEnd === null || versionEnd > startOfDay(from);

    if (startedBeforeTo && endedAfterFrom) {
      result.push(current);
    }
  }
  return result;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
