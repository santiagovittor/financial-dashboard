import { describe, expect, it } from 'vitest';
import {
  computeDailyBudget,
  computeDisposableIncome,
  computeRemainingBudget,
  daysInMonth,
} from '../utils/budget.js';

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it('returns 30 for April', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('throws for invalid month 0', () => {
    expect(() => daysInMonth(2026, 0)).toThrow('Invalid month');
  });

  it('throws for invalid month 13', () => {
    expect(() => daysInMonth(2026, 13)).toThrow('Invalid month');
  });
});

describe('computeDailyBudget', () => {
  it('divides monthly income by days in month', () => {
    // 310_000 ARS / 31 days = 10_000 exactly
    expect(computeDailyBudget(310_000, 2026, 1)).toBe(10_000);
  });

  it('rounds to 2 decimal places', () => {
    // 100 / 30 = 3.333... → 3.33
    expect(computeDailyBudget(100, 2026, 4)).toBe(3.33);
  });

  it('handles February in a leap year correctly', () => {
    // 290_000 / 29 = 10_000 exactly
    expect(computeDailyBudget(290_000, 2024, 2)).toBe(10_000);
  });

  it('throws for negative income', () => {
    expect(() => computeDailyBudget(-1, 2026, 1)).toThrow('non-negative');
  });

  it('returns 0 for zero income', () => {
    expect(computeDailyBudget(0, 2026, 1)).toBe(0);
  });
});

describe('computeRemainingBudget', () => {
  it('returns positive value when under budget', () => {
    expect(computeRemainingBudget(10_000, 6_000)).toBe(4_000);
  });

  it('returns zero when exactly at budget', () => {
    expect(computeRemainingBudget(10_000, 10_000)).toBe(0);
  });

  it('returns negative when over budget', () => {
    expect(computeRemainingBudget(10_000, 12_500)).toBe(-2_500);
  });
});

describe('computeDisposableIncome', () => {
  it('subtracts all commitment amounts from income', () => {
    // 1_000_000 - (200_000 + 150_000 + 50_000) = 600_000
    expect(computeDisposableIncome(1_000_000, [200_000, 150_000, 50_000])).toBe(600_000);
  });

  it('handles empty commitments array', () => {
    expect(computeDisposableIncome(500_000, [])).toBe(500_000);
  });

  it('returns negative if commitments exceed income', () => {
    expect(computeDisposableIncome(100, [200])).toBe(-100);
  });
});
