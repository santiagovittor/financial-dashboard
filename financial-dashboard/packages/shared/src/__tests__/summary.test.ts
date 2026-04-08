import { describe, expect, it } from 'vitest';
import { computeMonthlySummary, type MonthlySummaryInput } from '../utils/summary.js';
import { RISK_KEYS } from '../types/domain.js';

const DEFAULT_RISK = new Map<string, number>([
  [RISK_KEYS.DAILY_SPEND_WARNING_RATIO, 0.8],
  [RISK_KEYS.DAILY_SPEND_DANGER_RATIO, 1.0],
  [RISK_KEYS.DEBT_TO_INCOME_WARNING_RATIO, 0.3],
  [RISK_KEYS.DEBT_TO_INCOME_DANGER_RATIO, 0.5],
]);

const DEFAULT_FX = new Map<string, number>([
  ['USD', 1200],
  ['USDT', 1200],
  ['ARS', 1],
]);

function makeInput(overrides: Partial<MonthlySummaryInput> = {}): MonthlySummaryInput {
  return {
    year: 2026,
    month: 4, // April
    today: new Date(2026, 3, 15),
    plannedIncomeArs: 1_800_000,
    incomeEntriesArs: [900_000],
    expenseEntriesArs: [50_000, 30_000, 20_000],
    debtPaymentsArs: [100_000],
    activeCommitments: [],
    fxRates: DEFAULT_FX,
    riskSettings: DEFAULT_RISK,
    ...overrides,
  };
}

describe('computeMonthlySummary — basic totals', () => {
  it('sums income entries correctly', () => {
    const r = computeMonthlySummary(makeInput({ incomeEntriesArs: [600_000, 300_000] }));
    expect(r.income.actualArs).toBe(900_000);
  });

  it('sums expense entries correctly', () => {
    const r = computeMonthlySummary(makeInput({ expenseEntriesArs: [50_000, 30_000, 20_000] }));
    expect(r.expenses.totalArs).toBe(100_000);
    expect(r.expenses.entryCount).toBe(3);
  });

  it('sums debt payments correctly', () => {
    const r = computeMonthlySummary(makeInput({ debtPaymentsArs: [60_000, 40_000] }));
    expect(r.debts.paymentsTotalArs).toBe(100_000);
  });

  it('computes income variance against plan', () => {
    const r = computeMonthlySummary(makeInput({ plannedIncomeArs: 1_800_000, incomeEntriesArs: [900_000] }));
    expect(r.income.varianceArs).toBe(-900_000); // 900k - 1800k
  });

  it('returns null variance when no plan set', () => {
    const r = computeMonthlySummary(makeInput({ plannedIncomeArs: null, incomeEntriesArs: [900_000] }));
    expect(r.income.varianceArs).toBeNull();
  });
});

describe('computeMonthlySummary — balance', () => {
  it('computes remaining balance from plan', () => {
    const r = computeMonthlySummary(makeInput({
      plannedIncomeArs: 1_000_000,
      expenseEntriesArs: [200_000],
      debtPaymentsArs: [100_000],
      activeCommitments: [],
    }));
    // referenceIncome=1M, outflow=300k, remaining=700k
    expect(r.balance.referenceIncomeArs).toBe(1_000_000);
    expect(r.balance.totalOutflowArs).toBe(300_000);
    expect(r.balance.remainingArs).toBe(700_000);
    expect(r.balance.isOverBudget).toBe(false);
  });

  it('flags over-budget when outflow exceeds income', () => {
    const r = computeMonthlySummary(makeInput({
      plannedIncomeArs: 500_000,
      expenseEntriesArs: [400_000],
      debtPaymentsArs: [200_000],
    }));
    expect(r.balance.isOverBudget).toBe(true);
    expect(r.balance.remainingArs).toBe(-100_000);
  });

  it('uses actual income as reference when no plan', () => {
    const r = computeMonthlySummary(makeInput({
      plannedIncomeArs: null,
      incomeEntriesArs: [1_200_000],
      expenseEntriesArs: [200_000],
    }));
    expect(r.balance.referenceIncomeArs).toBe(1_200_000);
  });

  it('computes daily available from remaining and remaining days', () => {
    // April 15 → remaining days = 30 - 15 + 1 = 16
    const r = computeMonthlySummary(makeInput({
      plannedIncomeArs: 1_600_000,
      expenseEntriesArs: [],
      debtPaymentsArs: [],
      activeCommitments: [],
    }));
    expect(r.remainingDays).toBe(16);
    expect(r.balance.dailyAvailableArs).toBe(100_000); // 1_600_000 / 16
  });

  it('returns null dailyAvailable for a past month', () => {
    const r = computeMonthlySummary(makeInput({ year: 2026, month: 2, today: new Date(2026, 3, 15) }));
    expect(r.balance.dailyAvailableArs).toBeNull();
    expect(r.remainingDays).toBe(0);
  });
});

describe('computeMonthlySummary — commitments', () => {
  it('includes ARS commitments directly', () => {
    const r = computeMonthlySummary(makeInput({
      activeCommitments: [{
        id: 'c1',
        name: 'Rent',
        versions: [{ effectiveFrom: new Date('2026-01-01'), originalAmount: 100_000, originalCurrency: 'ARS' }],
      }],
    }));
    expect(r.commitments.totalArs).toBe(100_000);
    expect(r.commitments.hasMissingRates).toBe(false);
  });

  it('converts USD commitments using FX rates', () => {
    const r = computeMonthlySummary(makeInput({
      activeCommitments: [{
        id: 'c1',
        name: 'Streaming',
        versions: [{ effectiveFrom: new Date('2026-01-01'), originalAmount: 25, originalCurrency: 'USD' }],
      }],
      fxRates: new Map([['USD', 1200], ['ARS', 1]]),
    }));
    expect(r.commitments.totalArs).toBe(30_000); // 25 * 1200
    expect(r.commitments.hasMissingRates).toBe(false);
  });

  it('flags hasMissingRates when no FX rate available for non-ARS currency', () => {
    const r = computeMonthlySummary(makeInput({
      activeCommitments: [{
        id: 'c1',
        name: 'Streaming',
        versions: [{ effectiveFrom: new Date('2026-01-01'), originalAmount: 25, originalCurrency: 'USD' }],
      }],
      fxRates: new Map([['ARS', 1]]), // no USD rate
    }));
    expect(r.commitments.hasMissingRates).toBe(true);
  });

  it('skips commitments with no version effective by mid-month', () => {
    const r = computeMonthlySummary(makeInput({
      activeCommitments: [{
        id: 'c1',
        name: 'Future thing',
        // version starts in July, we're in April → no applicable version
        versions: [{ effectiveFrom: new Date('2026-07-01'), originalAmount: 100, originalCurrency: 'ARS' }],
      }],
    }));
    expect(r.commitments.totalArs).toBe(0);
  });

  it('uses the correct version after an effective-date change', () => {
    // Before July: $20. From July: $25. Summary is for April → should use $20.
    const r = computeMonthlySummary(makeInput({
      month: 4,
      today: new Date(2026, 3, 15),
      activeCommitments: [{
        id: 'c1',
        name: 'Streaming',
        versions: [
          { effectiveFrom: new Date('2026-01-01'), originalAmount: 20, originalCurrency: 'USD' },
          { effectiveFrom: new Date('2026-07-01'), originalAmount: 25, originalCurrency: 'USD' },
        ],
      }],
      fxRates: new Map([['USD', 1200], ['ARS', 1]]),
    }));
    expect(r.commitments.totalArs).toBe(24_000); // 20 * 1200
  });
});

describe('computeMonthlySummary — month classification', () => {
  it('identifies current month correctly', () => {
    const r = computeMonthlySummary(makeInput({ today: new Date(2026, 3, 15) }));
    expect(r.isCurrentMonth).toBe(true);
    expect(r.monthLabel).toBe('2026-04');
  });

  it('identifies past month correctly', () => {
    const r = computeMonthlySummary(makeInput({ year: 2026, month: 3, today: new Date(2026, 3, 15) }));
    expect(r.isCurrentMonth).toBe(false);
    expect(r.remainingDays).toBe(0);
    expect(r.daysInMonth).toBe(31);
  });

  it('identifies future month correctly and returns all days remaining', () => {
    const r = computeMonthlySummary(makeInput({ year: 2026, month: 6, today: new Date(2026, 3, 15) }));
    expect(r.isCurrentMonth).toBe(false);
    expect(r.remainingDays).toBe(30); // all of June
  });
});

describe('computeMonthlySummary — risk evaluation', () => {
  it('returns SAFE when spend is well below expected pace', () => {
    // April 15 (day 15 of 30), dailyBudget = 1_800_000/30 = 60_000
    // expectedByNow = 60_000 * 15 = 900_000
    // actualExpenses = 100_000 → ratio = 0.11 → SAFE
    const r = computeMonthlySummary(makeInput({ expenseEntriesArs: [100_000] }));
    expect(r.risk.dailySpend).toBe('SAFE');
  });

  it('returns DANGER when spend exceeds expected pace', () => {
    // dailyBudget = 1_800_000/30 = 60_000
    // expectedByNow (day 15) = 900_000
    // actualExpenses = 1_800_000 → ratio = 2.0 → DANGER
    const r = computeMonthlySummary(makeInput({ expenseEntriesArs: [1_800_000] }));
    expect(r.risk.dailySpend).toBe('DANGER');
  });

  it('returns DANGER debt burden when debt payments exceed 50% of income', () => {
    const r = computeMonthlySummary(makeInput({
      plannedIncomeArs: 1_000_000,
      debtPaymentsArs: [600_000], // 60% of income
    }));
    expect(r.risk.debtBurden).toBe('DANGER');
  });

  it('returns SAFE debt burden when debt payments are under 30% of income', () => {
    const r = computeMonthlySummary(makeInput({
      plannedIncomeArs: 1_000_000,
      debtPaymentsArs: [200_000], // 20% of income
    }));
    expect(r.risk.debtBurden).toBe('SAFE');
  });
});
