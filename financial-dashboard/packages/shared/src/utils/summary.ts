/**
 * Pure monthly budget summary computation.
 *
 * This module contains NO I/O — it operates entirely on data already loaded
 * by the caller. This makes it fast and fully testable.
 */
import { computeDailyBudget, daysInMonth } from './budget.js';
import { resolveEffectiveVersion } from './recurring.js';
import { toArs, roundMoney, sumArs } from './money.js';
import { buildThreshold, evaluateDailySpend, evaluateDebtBurden } from './risk.js';
import type { Currency } from '../types/currency.js';
import type { RiskLevel } from './risk.js';
import { RISK_KEYS } from '../types/domain.js';

export interface CommitmentForSummary {
  id: string;
  name: string;
  versions: Array<{
    effectiveFrom: Date;
    originalAmount: number;
    originalCurrency: string;
  }>;
}

export interface MonthlySummaryInput {
  year: number;
  month: number; // 1-12
  today: Date;
  plannedIncomeArs: number | null;
  /** ARS amounts of each income entry this month */
  incomeEntriesArs: number[];
  /** ARS amounts of each expense entry this month */
  expenseEntriesArs: number[];
  /** ARS amounts of each debt payment this month */
  debtPaymentsArs: number[];
  /** Active recurring commitments for this month (with their version history) */
  activeCommitments: CommitmentForSummary[];
  /**
   * FX rates applicable to this month.
   * fromCurrency → rate (1 fromCurrency = rate ARS).
   * 'ARS' key is implicitly 1 if not present.
   */
  fxRates: Map<string, number>;
  /** User's risk settings (key → value) */
  riskSettings: Map<string, number>;
}

export interface MonthlySummaryOutput {
  year: number;
  month: number;
  monthLabel: string; // YYYY-MM
  daysInMonth: number;
  remainingDays: number;
  isCurrentMonth: boolean;
  income: {
    plannedArs: number | null;
    actualArs: number;
    varianceArs: number | null; // actual - planned; negative = below plan
  };
  expenses: {
    totalArs: number;
    entryCount: number;
  };
  commitments: {
    totalArs: number;
    count: number;
    /** true if any active commitment couldn't be converted due to missing FX rate */
    hasMissingRates: boolean;
  };
  debts: {
    paymentsTotalArs: number;
    paymentCount: number;
  };
  balance: {
    totalOutflowArs: number;
    /** planned income if available, else actual income */
    referenceIncomeArs: number;
    remainingArs: number;
    /** null if no days remaining (past month or month hasn't started) */
    dailyAvailableArs: number | null;
    isOverBudget: boolean;
  };
  risk: {
    /** Spend pace vs daily budget (based on elapsed days this month) */
    dailySpend: RiskLevel;
    /** Monthly debt payments vs reference income */
    debtBurden: RiskLevel;
  };
}

export function computeMonthlySummary(input: MonthlySummaryInput): MonthlySummaryOutput {
  const {
    year, month, today, plannedIncomeArs, incomeEntriesArs, expenseEntriesArs,
    debtPaymentsArs, activeCommitments, fxRates, riskSettings,
  } = input;

  const totalDays = daysInMonth(year, month);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, totalDays);

  // Month classification relative to today
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);
  const isCurrentMonth =
    todayNorm.getFullYear() === year && todayNorm.getMonth() + 1 === month;
  const isFutureMonth = todayNorm < monthStart;
  const isPastMonth = todayNorm > monthEnd;

  const remainingDays = isCurrentMonth
    ? Math.max(0, totalDays - todayNorm.getDate() + 1)
    : isFutureMonth
      ? totalDays // entire month is ahead
      : 0; // past month

  // ── Income ──────────────────────────────────────────────────────────────────
  const actualIncomeArs = sumArs(incomeEntriesArs);
  const varianceArs =
    plannedIncomeArs !== null ? roundMoney(actualIncomeArs - plannedIncomeArs) : null;

  // ── Expenses ─────────────────────────────────────────────────────────────────
  const expenseTotalArs = sumArs(expenseEntriesArs);

  // ── Debt payments ─────────────────────────────────────────────────────────────
  const debtPaymentTotalArs = sumArs(debtPaymentsArs);

  // ── Commitments ──────────────────────────────────────────────────────────────
  // Use mid-month as the reference date for version resolution.
  const midMonth = new Date(year, month - 1, Math.ceil(totalDays / 2));
  let commitmentTotalArs = 0;
  let hasMissingRates = false;

  for (const c of activeCommitments) {
    const version = resolveEffectiveVersion(
      c.versions.map((v) => ({ ...v, effectiveFrom: new Date(v.effectiveFrom) })),
      midMonth,
    );
    if (!version) continue;

    const currency = version.originalCurrency as Currency;
    if (currency === 'ARS') {
      commitmentTotalArs += version.originalAmount;
    } else {
      const rate = fxRates.get(currency);
      if (rate === undefined || rate === 0) {
        hasMissingRates = true;
      } else {
        commitmentTotalArs += toArs(version.originalAmount, currency, rate).arsAmount;
      }
    }
  }
  commitmentTotalArs = roundMoney(commitmentTotalArs);

  // ── Balance ───────────────────────────────────────────────────────────────────
  const referenceIncomeArs = plannedIncomeArs ?? actualIncomeArs;
  const totalOutflowArs = sumArs([expenseTotalArs, debtPaymentTotalArs, commitmentTotalArs]);
  const remainingArs = roundMoney(referenceIncomeArs - totalOutflowArs);
  const isOverBudget = remainingArs < 0;
  const dailyAvailableArs =
    remainingDays > 0 ? roundMoney(remainingArs / remainingDays) : null;

  // ── Risk ──────────────────────────────────────────────────────────────────────
  const warnDaily = riskSettings.get(RISK_KEYS.DAILY_SPEND_WARNING_RATIO) ?? 0.8;
  const dangerDaily = riskSettings.get(RISK_KEYS.DAILY_SPEND_DANGER_RATIO) ?? 1.0;
  const warnDebt = riskSettings.get(RISK_KEYS.DEBT_TO_INCOME_WARNING_RATIO) ?? 0.3;
  const dangerDebt = riskSettings.get(RISK_KEYS.DEBT_TO_INCOME_DANGER_RATIO) ?? 0.5;

  // Spend pace: compare actual spend against expected spend at this point in month.
  // For past months, compare against full-month budget.
  const dailyBudgetArs =
    plannedIncomeArs !== null ? computeDailyBudget(plannedIncomeArs, year, month) : 0;
  const daysElapsed = isPastMonth
    ? totalDays
    : isCurrentMonth
      ? todayNorm.getDate()
      : 0; // future month: no elapsed days yet, don't alarm
  const expectedSpendByNow = dailyBudgetArs * daysElapsed;

  const dailyThreshold = buildThreshold(warnDaily, dangerDaily);
  const debtThreshold = buildThreshold(warnDebt, dangerDebt);
  const dailySpendRisk = evaluateDailySpend(expenseTotalArs, expectedSpendByNow, dailyThreshold);
  const debtBurdenRisk = evaluateDebtBurden(debtPaymentTotalArs, referenceIncomeArs, debtThreshold);

  return {
    year,
    month,
    monthLabel: `${year}-${String(month).padStart(2, '0')}`,
    daysInMonth: totalDays,
    remainingDays,
    isCurrentMonth,
    income: { plannedArs: plannedIncomeArs, actualArs: actualIncomeArs, varianceArs },
    expenses: { totalArs: expenseTotalArs, entryCount: expenseEntriesArs.length },
    commitments: { totalArs: commitmentTotalArs, count: activeCommitments.length, hasMissingRates },
    debts: { paymentsTotalArs: debtPaymentTotalArs, paymentCount: debtPaymentsArs.length },
    balance: { totalOutflowArs, referenceIncomeArs, remainingArs, dailyAvailableArs, isOverBudget },
    risk: { dailySpend: dailySpendRisk, debtBurden: debtBurdenRisk },
  };
}
