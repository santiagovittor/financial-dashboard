/**
 * Financial analysis service.
 *
 * Aggregates canonical DB data, calls Gemini for a narrative, and persists
 * the result. Staleness is computed by comparing the stored dataUpdatedAt
 * against the current max(createdAt) across canonical tables.
 */
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../lib/prisma.js';
import { decimalToNumber } from '../../lib/fx.js';
import { buildFxRateMap, computeMonthlySummary, type CommitmentForSummary } from '@fin/shared';
import type { Decimal } from '@prisma/client/runtime/library';

// ─── Narrative schema ─────────────────────────────────────────────────────────
// Validated before any persistence.

const narrativeSchema = z.object({
  version: z.literal(1),
  sections: z.object({
    overview: z.string().min(1),
    spendingDrivers: z.string().min(1),
    debtPressure: z.string().min(1),
    cuttableSpend: z.string().min(1),
    watchThis: z.string().min(1),
    dailyBudgetAssessment: z.string().min(1),
  }),
});

export type NarrativeSections = z.infer<typeof narrativeSchema>['sections'];

export interface StoredAnalysis {
  id: string;
  coversPeriod: string;
  generatedAt: string;
  dataUpdatedAt: string;
  sections: NarrativeSections;
  isStale: boolean;
  latestDataUpdatedAt: string;
}

// ─── Gemini client ────────────────────────────────────────────────────────────

let _model: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null = null;

function getModel() {
  if (_model) return _model;
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set — narrative analysis is unavailable.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  _model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  return _model;
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function extractJsonObject(text: string): string {
  const stripped = text
    .replace(/^```[a-z]*\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini response did not contain a JSON object');
  }
  return stripped.slice(start, end + 1);
}

function stripNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripNulls);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

// ─── Context builder ──────────────────────────────────────────────────────────

async function buildAnalysisContext(userId: string, year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const totalDays = monthEnd.getDate();
  const midMonth = new Date(year, month - 1, Math.ceil(totalDays / 2));

  // Look back 3 months for trend data
  const threeMonthsAgo = new Date(year, month - 4, 1);

  const [
    plan,
    incomeEntries,
    expenseEntriesFull,
    debtPayments,
    commitments,
    fxSnapshots,
    riskSettings,
    activeDebts,
    recentExpenses,
    recentIncome,
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
      select: {
        arsAmount: true,
        originalAmount: true,
        originalCurrency: true,
        category: { select: { name: true } },
      },
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
    prisma.debt.findMany({
      where: { userId, status: 'ACTIVE' },
      select: {
        name: true,
        type: true,
        currentBalanceOriginal: true,
        currentBalanceCurrency: true,
        interestRateAnnual: true,
        installmentAmount: true,
        installmentCurrency: true,
        installmentCount: true,
        dueDate: true,
      },
    }),
    // Last 3 months expenses for trend
    prisma.expenseEntry.findMany({
      where: { userId, entryDate: { gte: threeMonthsAgo, lt: monthStart } },
      select: { arsAmount: true, entryDate: true },
    }),
    prisma.incomeEntry.findMany({
      where: { userId, entryDate: { gte: threeMonthsAgo, lt: monthStart } },
      select: { arsAmount: true, entryDate: true },
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

  const summary = computeMonthlySummary({
    year,
    month,
    today: new Date(),
    plannedIncomeArs: plan ? decimalToNumber(plan.estimatedArs) : null,
    incomeEntriesArs: incomeEntries.map((e: { arsAmount: Decimal }) => decimalToNumber(e.arsAmount)),
    expenseEntriesArs: expenseEntriesFull.map((e: { arsAmount: Decimal }) => decimalToNumber(e.arsAmount)),
    debtPaymentsArs: debtPayments.map((p: { arsAmount: Decimal }) => decimalToNumber(p.arsAmount)),
    activeCommitments,
    fxRates,
    riskSettings: riskMap,
  });

  // Category breakdown
  const categoryTotals = new Map<string, number>();
  for (const e of expenseEntriesFull) {
    const cat = e.category?.name ?? 'Uncategorised';
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + decimalToNumber(e.arsAmount));
  }
  const categoryBreakdown = [...categoryTotals.entries()]
    .map(([category, totalArs]) => ({ category, totalArs: Math.round(totalArs) }))
    .sort((a, b) => b.totalArs - a.totalArs);

  // ARS vs USD split
  const arsExpenses = expenseEntriesFull
    .filter((e: { originalCurrency: string }) => e.originalCurrency === 'ARS')
    .reduce((s: number, e: { arsAmount: Decimal }) => s + decimalToNumber(e.arsAmount), 0);
  const usdExpenses = expenseEntriesFull
    .filter((e: { originalCurrency: string }) => e.originalCurrency !== 'ARS')
    .reduce((s: number, e: { arsAmount: Decimal }) => s + decimalToNumber(e.arsAmount), 0);

  // Recent months trend
  function groupByMonth(entries: Array<{ arsAmount: Decimal; entryDate: Date }>) {
    const m = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.entryDate.getFullYear()}-${String(e.entryDate.getMonth() + 1).padStart(2, '0')}`;
      m.set(key, (m.get(key) ?? 0) + decimalToNumber(e.arsAmount));
    }
    return m;
  }
  const expensesByMonth = groupByMonth(recentExpenses);
  const incomeByMonth = groupByMonth(recentIncome);
  const recentMonthKeys = [...new Set([...expensesByMonth.keys(), ...incomeByMonth.keys()])].sort();
  const recentMonthsTrend = recentMonthKeys.map((k) => ({
    month: k,
    expensesArs: Math.round(expensesByMonth.get(k) ?? 0),
    incomeArs: Math.round(incomeByMonth.get(k) ?? 0),
  }));

  // Active debts
  const debtSummary = activeDebts.map((d: {
    name: string;
    type: string;
    currentBalanceOriginal: Decimal;
    currentBalanceCurrency: string;
    interestRateAnnual: Decimal | null;
    installmentAmount: Decimal | null;
    installmentCurrency: string | null;
    installmentCount: number | null;
    dueDate: Date | null;
  }) => ({
    name: d.name,
    type: d.type,
    balanceOriginal: Math.round(decimalToNumber(d.currentBalanceOriginal)),
    balanceCurrency: d.currentBalanceCurrency,
    interestRateAnnual: d.interestRateAnnual ? decimalToNumber(d.interestRateAnnual) : null,
    monthlyInstallmentOriginal: d.installmentAmount ? Math.round(decimalToNumber(d.installmentAmount)) : null,
    installmentCurrency: d.installmentCurrency ?? null,
    dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null,
  }));

  return {
    currentMonth: `${year}-${String(month).padStart(2, '0')}`,
    summary: {
      income: summary.income,
      expenses: summary.expenses,
      commitments: summary.commitments,
      debts: summary.debts,
      balance: summary.balance,
      risk: summary.risk,
      remainingDays: summary.remainingDays,
    },
    categoryBreakdown,
    currencySplit: {
      arsExpensesArs: Math.round(arsExpenses),
      usdExpensesArs: Math.round(usdExpenses),
    },
    recentMonthsTrend,
    activeDebts: debtSummary,
  };
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(context: Awaited<ReturnType<typeof buildAnalysisContext>>): string {
  return `You are a personal finance advisor analysing a single user's financial data (all amounts in ARS, Argentine pesos).

DATA:
${JSON.stringify(context, null, 2)}

Write a concise financial analysis. Return ONLY a valid JSON object matching this exact structure — no markdown, no code fences, no preamble:

{
  "version": 1,
  "sections": {
    "overview": "2-3 sentences on overall financial health this month",
    "spendingDrivers": "What is driving spending this month — top categories, notable patterns",
    "debtPressure": "Assessment of current debt load, installment burden, minimum vs total due pressure",
    "cuttableSpend": "Specific categories or habits where spending appears reducible",
    "watchThis": "The single most important thing to watch or act on this month",
    "dailyBudgetAssessment": "How tight/comfortable the daily budget looks and what it means practically"
  }
}

Rules:
- Be specific and reference actual figures from the data
- Use ARS amounts with thousands separators (e.g. $1.250.000)
- Keep each section 2-4 sentences
- If data is sparse, note it and be conservative
- Do not repeat yourself across sections
- Return ONLY the JSON object`;
}

// ─── Staleness helper ─────────────────────────────────────────────────────────

async function getLatestDataTimestamp(userId: string): Promise<Date> {
  const [latestIncome, latestExpense, latestDebtPayment] = await Promise.all([
    prisma.incomeEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.expenseEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.debtPayment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const candidates = [latestIncome?.createdAt, latestExpense?.createdAt, latestDebtPayment?.createdAt]
    .filter((d): d is Date => d != null);

  if (candidates.length === 0) return new Date(0);
  return candidates.reduce((max, d) => (d > max ? d : max));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAnalysis(userId: string): Promise<StoredAnalysis | null> {
  const stored = await prisma.financialAnalysis.findUnique({ where: { userId } });
  if (!stored) return null;

  const latestDataAt = await getLatestDataTimestamp(userId);
  const isStale = latestDataAt > stored.dataUpdatedAt;

  return {
    id: stored.id,
    coversPeriod: stored.coversPeriod,
    generatedAt: stored.generatedAt.toISOString(),
    dataUpdatedAt: stored.dataUpdatedAt.toISOString(),
    sections: JSON.parse(stored.narrative) as NarrativeSections,
    isStale,
    latestDataUpdatedAt: latestDataAt.toISOString(),
  };
}

export async function generateAnalysis(userId: string): Promise<StoredAnalysis> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const coversPeriod = `${year}-${String(month).padStart(2, '0')}`;

  const [context, latestDataAt] = await Promise.all([
    buildAnalysisContext(userId, year, month),
    getLatestDataTimestamp(userId),
  ]);

  const prompt = buildPrompt(context);
  const model = getModel();

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonString = extractJsonObject(text);
  const raw = stripNulls(JSON.parse(jsonString) as unknown) as unknown;
  const parsed = narrativeSchema.parse(raw);

  const stored = await prisma.financialAnalysis.upsert({
    where: { userId },
    create: {
      userId,
      coversPeriod,
      narrative: JSON.stringify(parsed.sections),
      generatedAt: now,
      dataUpdatedAt: latestDataAt,
    },
    update: {
      coversPeriod,
      narrative: JSON.stringify(parsed.sections),
      generatedAt: now,
      dataUpdatedAt: latestDataAt,
    },
  });

  return {
    id: stored.id,
    coversPeriod: stored.coversPeriod,
    generatedAt: stored.generatedAt.toISOString(),
    dataUpdatedAt: stored.dataUpdatedAt.toISOString(),
    sections: parsed.sections,
    isStale: false,
    latestDataUpdatedAt: latestDataAt.toISOString(),
  };
}

// ─── Dashboard data for deterministic layer ───────────────────────────────────

export interface AnalysisDashboardData {
  coversPeriod: string;
  summary: Awaited<ReturnType<typeof buildAnalysisContext>>['summary'];
  categoryBreakdown: Awaited<ReturnType<typeof buildAnalysisContext>>['categoryBreakdown'];
  currencySplit: Awaited<ReturnType<typeof buildAnalysisContext>>['currencySplit'];
  recentMonthsTrend: Awaited<ReturnType<typeof buildAnalysisContext>>['recentMonthsTrend'];
  activeDebts: Awaited<ReturnType<typeof buildAnalysisContext>>['activeDebts'];
}

export async function getDashboardData(userId: string): Promise<AnalysisDashboardData> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const coversPeriod = `${year}-${String(month).padStart(2, '0')}`;

  const context = await buildAnalysisContext(userId, year, month);

  return {
    coversPeriod,
    summary: context.summary,
    categoryBreakdown: context.categoryBreakdown,
    currencySplit: context.currencySplit,
    recentMonthsTrend: context.recentMonthsTrend,
    activeDebts: context.activeDebts,
  };
}
