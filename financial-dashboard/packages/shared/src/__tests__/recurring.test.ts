import { describe, expect, it } from 'vitest';
import {
  resolveEffectiveVersion,
  versionsActiveInRange,
  type VersionedAmount,
} from '../utils/recurring.js';

function makeVersion(
  effectiveFrom: string,
  originalAmount: number,
  originalCurrency = 'USD',
): VersionedAmount {
  return { effectiveFrom: new Date(effectiveFrom), originalAmount, originalCurrency };
}

describe('resolveEffectiveVersion', () => {
  it('returns null when no versions exist', () => {
    expect(resolveEffectiveVersion([], new Date('2026-06-15'))).toBeNull();
  });

  it('returns null when target date is before the first version', () => {
    const versions = [makeVersion('2026-07-01', 100)];
    expect(resolveEffectiveVersion(versions, new Date('2026-06-15'))).toBeNull();
  });

  it('returns the only version when target date is after effectiveFrom', () => {
    const v = makeVersion('2026-01-01', 100);
    const result = resolveEffectiveVersion([v], new Date('2026-06-15'));
    expect(result?.originalAmount).toBe(100);
  });

  it('returns the version when target date equals effectiveFrom', () => {
    const v = makeVersion('2026-06-15', 100);
    const result = resolveEffectiveVersion([v], new Date('2026-06-15'));
    expect(result?.originalAmount).toBe(100);
  });

  it('returns the latest effective version when there are multiple', () => {
    const versions = [makeVersion('2026-01-01', 20), makeVersion('2026-07-01', 25)];
    // Date in June → first version applies
    expect(resolveEffectiveVersion(versions, new Date('2026-06-30'))?.originalAmount).toBe(20);
    // Date in July → second version applies
    expect(resolveEffectiveVersion(versions, new Date('2026-07-01'))?.originalAmount).toBe(25);
    // Date in August → still second version
    expect(resolveEffectiveVersion(versions, new Date('2026-08-15'))?.originalAmount).toBe(25);
  });

  it('handles unsorted input correctly', () => {
    // Provide versions in reverse order — result must still be correct
    const versions = [makeVersion('2026-07-01', 25), makeVersion('2026-01-01', 20)];
    expect(resolveEffectiveVersion(versions, new Date('2026-06-15'))?.originalAmount).toBe(20);
    expect(resolveEffectiveVersion(versions, new Date('2026-09-01'))?.originalAmount).toBe(25);
  });

  it('works with three versions', () => {
    const versions = [
      makeVersion('2025-01-01', 10),
      makeVersion('2025-07-01', 15),
      makeVersion('2026-01-01', 20),
    ];
    expect(resolveEffectiveVersion(versions, new Date('2025-03-15'))?.originalAmount).toBe(10);
    expect(resolveEffectiveVersion(versions, new Date('2025-09-01'))?.originalAmount).toBe(15);
    expect(resolveEffectiveVersion(versions, new Date('2026-06-01'))?.originalAmount).toBe(20);
  });

  it('preserves the full version object (generic T)', () => {
    const versions = [{ effectiveFrom: new Date('2026-01-01'), originalAmount: 99, originalCurrency: 'USD', extraField: 'hello' }];
    const result = resolveEffectiveVersion(versions, new Date('2026-06-01'));
    expect(result?.extraField).toBe('hello');
  });
});

describe('versionsActiveInRange', () => {
  it('returns the single version that covers the entire range', () => {
    const versions = [makeVersion('2026-01-01', 20)];
    const result = versionsActiveInRange(versions, new Date('2026-03-01'), new Date('2026-05-31'));
    expect(result).toHaveLength(1);
    expect(result[0]?.originalAmount).toBe(20);
  });

  it('returns both versions when an amount change falls within the range', () => {
    const versions = [makeVersion('2026-01-01', 20), makeVersion('2026-04-01', 25)];
    const result = versionsActiveInRange(versions, new Date('2026-03-01'), new Date('2026-05-31'));
    expect(result).toHaveLength(2);
  });

  it('returns only the first version when range is before the second effectiveFrom', () => {
    const versions = [makeVersion('2026-01-01', 20), makeVersion('2026-07-01', 25)];
    const result = versionsActiveInRange(versions, new Date('2026-02-01'), new Date('2026-04-30'));
    expect(result).toHaveLength(1);
    expect(result[0]?.originalAmount).toBe(20);
  });

  it('throws when from > to', () => {
    expect(() =>
      versionsActiveInRange([], new Date('2026-06-01'), new Date('2026-01-01')),
    ).toThrow('from must be ≤ to');
  });
});
