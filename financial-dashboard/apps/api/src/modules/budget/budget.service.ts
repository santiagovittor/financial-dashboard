/**
 * Budget service — DB data loading + pure computation via @fin/shared.
 *
 * All arithmetic is delegated to computeMonthlySummary (zero I/O, fully tested).
 * This module only deals with fetching the right rows and converting Decimal→number.
 */
import { prisma } from '../../lib/prisma.js';
import {
  computeMonthlySummary,
  buildFxRateMap,
  computeDailyBudget,
  computeRemainingBudget,
  sumArs,
  type MonthlySummaryOutput,
  type CommitmentForSummary,
} from '@fin/shared';
import { decimalToNumber } from '../../lib/fx.js';
import type { Decimal } from '@prisma/client/runtime/library';

export type { MonthlySummaryOutput };

export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlySummaryOutput> {
  const today = new Date();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // last calendar day
  const totalDays = monthEnd.getDate();
  const midMonth = new Date(year, month - 1, Math.ceil(totalDays / 2));

  const [
    plan,
    incomeEntries,
    expenseEntries,
    debtPayments,
    commitments,
    fxSnapshots,
    riskSettings,
  ] = await Promise.all([
    prisma.monthlyIncomePlan.findUnique({
      where: { userId_year_month: { userId, year, month } },
      select: { estimatedArs: true },
    }),
    prisma.incomeEntry.findMany({
      where: { userId, entryDate: { gte: monthStart, lte: monthEnd } },
      select: { arsAmount: true },
    }),
    prisma.expenseEntry.findMany({
      where: { userId, entryDate: { gte: monthStart, lte: monthEnd } },
      select: { arsAmount: true },
    }),
    prisma.debtPayment.findMany({
      where: { userId, paymentDate: { gte: monthStart, lte: monthEnd } },
      select: { arsAmount: true },
    }),
    prisma.recurringCommitment.findMany({
      where: { userId, isActive: true },
      include: {
        versions: {
          orderBy: { effectiveFrom: 'asc' },
          select: { effectiveFrom: true, originalAmount: true, originalCurrency: true },
        },
      },
    }),
    prisma.exchangeRateSnapshot.findMany({
      where: { userId },
      select: { effectiveDate: true, rate: true, fromCurrency: true, toCurrency: true },
    }),
    prisma.riskSetting.findMany({
      where: { userId },
      select: { key: true, value: true },
    }),
  ]);

  const fxRates = buildFxRateMap(
    fxSnapshots.map((s: { effectiveDate: Date; rate: Decimal; fromCurrency: string; toCurrency: string }) => ({
      effectiveDate: s.effectiveDate,
      rate: decimalToNumber(s.rate),
      fromCurrency: s.fromCurrency,
      toCurrency: s.toCurrency,
    })),
    midMonth,
  );

  const riskMap = new Map<string, number>(
    riskSettings.map((s: { key: string; value: Decimal }) => [s.key, decimalToNumber(s.value)]),
  );

  const activeCommitments: CommitmentForSummary[] = commitments.map((c: { id: string; name: string; versions: Array<{ effectiveFrom: Date; originalAmount: Decimal; originalCurrency: string }> }) => ({
    id: c.id,
    name: c.name,
    versions: c.versions.map((v: { effectiveFrom: Date; originalAmount: Decimal; originalCurrency: string }) => ({
      effectiveFrom: v.effectiveFrom,
      originalAmount: decimalToNumber(v.originalAmount),
      originalCurrency: v.originalCurrency,
    })),
  }));

  return computeMonthlySummary({
    year,
    month,
    today,
    plannedIncomeArs: plan ? decimalToNumber(plan.estimatedArs) : null,
    incomeEntriesArs: incomeEntries.map((e: { arsAmount: Decimal }) => decimalToNumber(e.arsAmount)),
    expenseEntriesArs: expenseEntries.map((e: { arsAmount: Decimal }) => decimalToNumber(e.arsAmount)),
    debtPaymentsArs: debtPayments.map((p) => decimalToNumber(p.arsAmount)),
    activeCommitments,
    fxRates,
    riskSettings: riskMap,
  });
}

// ── Legacy daily budget endpoint (kept for backward compatibility) ─────────────

export interface DailyBudgetResult {
  date: string;
  year: number;
  month: number;
  day: number;
  monthlyIncomeArs: number | null;
  dailyBudgetArs: number | null;
  spentArs: number;
  remainingArs: number | null;
  isOverBudget: boolean;
}

export async function getDailyBudget(userId: string, date: Date): Promise<DailyBudgetResult> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const dayStart = new Date(year, month - 1, day);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

  const [plan, entries] = await Promise.all([
    prisma.monthlyIncomePlan.findUnique({
      where: { userId_year_month: { userId, year, month } },
      select: { estimatedArs: true },
    }),
    prisma.expenseEntry.findMany({
      where: { userId, entryDate: { gte: dayStart, lte: dayEnd } },
      select: { arsAmount: true },
    }),
  ]);

  const spentArs = sumArs(entries.map((e) => decimalToNumber(e.arsAmount)));
  const monthlyIncomeArs = plan ? decimalToNumber(plan.estimatedArs) : null;
  const dailyBudgetArs =
    monthlyIncomeArs !== null ? computeDailyBudget(monthlyIncomeArs, year, month) : null;
  const remainingArs =
    dailyBudgetArs !== null ? computeRemainingBudget(dailyBudgetArs, spentArs) : null;

  return {
    date: date.toISOString().slice(0, 10),
    year,
    month,
    day,
    monthlyIncomeArs,
    dailyBudgetArs,
    spentArs,
    remainingArs,
    isOverBudget: remainingArs !== null && remainingArs < 0,
  };
}
