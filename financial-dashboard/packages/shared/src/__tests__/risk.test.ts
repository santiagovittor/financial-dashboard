import { describe, expect, it } from 'vitest';
import {
  buildThreshold,
  evaluateDebtBurden,
  evaluateDailySpend,
  evaluateRiskLevel,
} from '../utils/risk.js';

describe('evaluateRiskLevel', () => {
  const threshold = { warning: 0.8, danger: 1.0 };

  it('returns SAFE below the warning threshold', () => {
    expect(evaluateRiskLevel(0.5, threshold)).toBe('SAFE');
    expect(evaluateRiskLevel(0.79, threshold)).toBe('SAFE');
  });

  it('returns WARNING at the warning threshold', () => {
    expect(evaluateRiskLevel(0.8, threshold)).toBe('WARNING');
  });

  it('returns WARNING between warning and danger', () => {
    expect(evaluateRiskLevel(0.9, threshold)).toBe('WARNING');
    expect(evaluateRiskLevel(0.99, threshold)).toBe('WARNING');
  });

  it('returns DANGER at the danger threshold', () => {
    expect(evaluateRiskLevel(1.0, threshold)).toBe('DANGER');
  });

  it('returns DANGER above the danger threshold', () => {
    expect(evaluateRiskLevel(1.5, threshold)).toBe('DANGER');
  });

  it('throws when warning >= danger', () => {
    expect(() => evaluateRiskLevel(0.5, { warning: 1.0, danger: 0.8 })).toThrow(
      'warning threshold must be less than danger threshold',
    );
    expect(() => evaluateRiskLevel(0.5, { warning: 0.8, danger: 0.8 })).toThrow(
      'warning threshold must be less than danger threshold',
    );
  });
});

describe('buildThreshold', () => {
  it('builds a valid threshold', () => {
    expect(buildThreshold(0.8, 1.0)).toEqual({ warning: 0.8, danger: 1.0 });
  });

  it('throws when warning >= danger', () => {
    expect(() => buildThreshold(1.0, 0.5)).toThrow('warning must be less than danger');
  });

  it('throws for non-positive values', () => {
    expect(() => buildThreshold(0, 1.0)).toThrow('must be positive');
    expect(() => buildThreshold(0.8, 0)).toThrow('must be positive');
  });
});

describe('evaluateDailySpend', () => {
  const threshold = { warning: 0.8, danger: 1.0 };

  it('returns SAFE when spent is under 80% of budget', () => {
    expect(evaluateDailySpend(7_000, 10_000, threshold)).toBe('SAFE');
  });

  it('returns WARNING at 80% spend', () => {
    expect(evaluateDailySpend(8_000, 10_000, threshold)).toBe('WARNING');
  });

  it('returns DANGER when over budget', () => {
    expect(evaluateDailySpend(11_000, 10_000, threshold)).toBe('DANGER');
  });

  it('returns SAFE when dailyBudget is 0 (no budget configured)', () => {
    expect(evaluateDailySpend(5_000, 0, threshold)).toBe('SAFE');
  });
});

describe('evaluateDebtBurden', () => {
  const threshold = { warning: 0.3, danger: 0.5 };

  it('returns SAFE when debt payments are under 30% of income', () => {
    expect(evaluateDebtBurden(200_000, 1_000_000, threshold)).toBe('SAFE');
  });

  it('returns WARNING at 30% debt-to-income', () => {
    expect(evaluateDebtBurden(300_000, 1_000_000, threshold)).toBe('WARNING');
  });

  it('returns DANGER at 50% debt-to-income', () => {
    expect(evaluateDebtBurden(500_000, 1_000_000, threshold)).toBe('DANGER');
  });

  it('returns SAFE when income is 0 (no income configured)', () => {
    expect(evaluateDebtBurden(100_000, 0, threshold)).toBe('SAFE');
  });
});
