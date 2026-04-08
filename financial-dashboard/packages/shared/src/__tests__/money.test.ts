import { describe, expect, it } from 'vitest';
import { arsOnly, roundMoney, sumArs, toArs } from '../utils/money.js';

describe('toArs', () => {
  it('converts USD to ARS at a given rate', () => {
    const result = toArs(100, 'USD', 1000);
    expect(result.arsAmount).toBe(100_000);
    expect(result.originalAmount).toBe(100);
    expect(result.originalCurrency).toBe('USD');
    expect(result.fxRate).toBe(1000);
  });

  it('correctly handles fractional amounts that trip up floating-point arithmetic', () => {
    // 0.1 * 1000 = 100 exactly — but floating-point naively gives 100.00000000000001
    const result = toArs(0.1, 'USD', 1000);
    expect(result.arsAmount).toBe(100);
  });

  it('correctly handles USDT amounts', () => {
    const result = toArs(1.5, 'USDT', 1000.5);
    expect(result.arsAmount).toBe(1500.75);
  });

  it('rounds to 4 decimal places', () => {
    // 1 / 3 * 3 should not accumulate error
    const result = toArs(1, 'USD', 3.33335);
    expect(result.arsAmount).toBe(3.3334); // round half-up
  });

  it('allows zero amount', () => {
    const result = toArs(0, 'ARS', 1);
    expect(result.arsAmount).toBe(0);
  });

  it('throws for non-positive fxRate', () => {
    expect(() => toArs(100, 'USD', 0)).toThrow('must be positive');
    expect(() => toArs(100, 'USD', -1)).toThrow('must be positive');
  });

  it('throws for negative originalAmount', () => {
    expect(() => toArs(-1, 'USD', 1000)).toThrow('must be non-negative');
  });
});

describe('arsOnly', () => {
  it('wraps an ARS amount with fxRate=1', () => {
    const result = arsOnly(50_000);
    expect(result).toEqual({
      originalAmount: 50_000,
      originalCurrency: 'ARS',
      fxRate: 1,
      arsAmount: 50_000,
    });
  });

  it('throws for negative amounts', () => {
    expect(() => arsOnly(-1)).toThrow('must be non-negative');
  });
});

describe('sumArs', () => {
  it('sums an array of ARS amounts precisely', () => {
    // 0.1 + 0.2 + 0.3 in plain JS = 0.6000000000000001 — Decimal handles this
    expect(sumArs([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it('returns 0 for an empty array', () => {
    expect(sumArs([])).toBe(0);
  });

  it('handles large ARS amounts', () => {
    // 1_500_000 + 250_000.5 + 99_999.9999 = 1_850_000.4999
    expect(sumArs([1_500_000, 250_000.5, 99_999.9999])).toBe(1_850_000.4999);
  });
});

describe('roundMoney', () => {
  it('rounds to 4 decimal places using ROUND_HALF_UP', () => {
    expect(roundMoney(1.23456)).toBe(1.2346);
    expect(roundMoney(1.23454)).toBe(1.2345);
    expect(roundMoney(1.23455)).toBe(1.2346); // half-up
  });
});
