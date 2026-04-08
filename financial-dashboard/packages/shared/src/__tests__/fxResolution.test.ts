import { describe, expect, it } from 'vitest';
import { buildFxRateMap, findApplicableRate } from '../utils/fx.js';

function snap(effectiveDate: string, rate: number) {
  return { effectiveDate: new Date(effectiveDate), rate };
}

function fullSnap(
  effectiveDate: string,
  rate: number,
  fromCurrency: string,
  toCurrency = 'ARS',
) {
  return { effectiveDate: new Date(effectiveDate), rate, fromCurrency, toCurrency };
}

describe('findApplicableRate', () => {
  it('returns null when snapshots array is empty', () => {
    expect(findApplicableRate([], new Date('2026-04-01'))).toBeNull();
  });

  it('returns null when all snapshots are after the target date', () => {
    const snapshots = [snap('2026-07-01', 1200)];
    expect(findApplicableRate(snapshots, new Date('2026-04-01'))).toBeNull();
  });

  it('returns the single snapshot when target date is after effectiveDate', () => {
    const s = snap('2026-01-01', 1000);
    expect(findApplicableRate([s], new Date('2026-04-15'))?.rate).toBe(1000);
  });

  it('returns the snapshot when target date equals effectiveDate exactly', () => {
    const s = snap('2026-04-15', 1100);
    expect(findApplicableRate([s], new Date('2026-04-15'))?.rate).toBe(1100);
  });

  it('returns the latest applicable snapshot among multiple', () => {
    const snapshots = [
      snap('2026-01-01', 1000),
      snap('2026-03-01', 1100), // applicable
      snap('2026-07-01', 1300), // future — not applicable
    ];
    expect(findApplicableRate(snapshots, new Date('2026-04-15'))?.rate).toBe(1100);
  });

  it('handles unsorted input correctly', () => {
    const snapshots = [
      snap('2026-07-01', 1300),
      snap('2026-01-01', 1000),
      snap('2026-03-01', 1100),
    ];
    expect(findApplicableRate(snapshots, new Date('2026-04-15'))?.rate).toBe(1100);
  });

  it('returns the most recent snapshot when target equals the latest effectiveDate', () => {
    const snapshots = [snap('2026-01-01', 1000), snap('2026-04-15', 1150)];
    expect(findApplicableRate(snapshots, new Date('2026-04-15'))?.rate).toBe(1150);
  });

  it('preserves extra fields on the generic T type', () => {
    const snapshots = [
      { effectiveDate: new Date('2026-01-01'), rate: 1000, snapshotId: 'abc' },
    ];
    const result = findApplicableRate(snapshots, new Date('2026-06-01'));
    expect(result?.snapshotId).toBe('abc');
  });
});

describe('buildFxRateMap', () => {
  it('always includes ARS with rate 1', () => {
    const map = buildFxRateMap([], new Date('2026-04-15'));
    expect(map.get('ARS')).toBe(1);
  });

  it('resolves USD and USDT rates for a given date', () => {
    const snapshots = [
      fullSnap('2026-01-01', 1000, 'USD'),
      fullSnap('2026-03-01', 1100, 'USD'),
      fullSnap('2026-01-01', 995, 'USDT'),
    ];
    const map = buildFxRateMap(snapshots, new Date('2026-04-15'));
    expect(map.get('USD')).toBe(1100); // latest applicable
    expect(map.get('USDT')).toBe(995);
    expect(map.get('ARS')).toBe(1);
  });

  it('excludes snapshots where toCurrency is not ARS', () => {
    const snapshots = [fullSnap('2026-01-01', 500, 'USD', 'EUR')];
    const map = buildFxRateMap(snapshots, new Date('2026-04-15'));
    // USD→EUR snapshot should be ignored; USD entry should not be set
    expect(map.has('USD')).toBe(false);
  });

  it('does not include a currency with no applicable snapshot', () => {
    const snapshots = [fullSnap('2026-07-01', 1300, 'USD')]; // future
    const map = buildFxRateMap(snapshots, new Date('2026-04-15'));
    expect(map.has('USD')).toBe(false);
  });
});
