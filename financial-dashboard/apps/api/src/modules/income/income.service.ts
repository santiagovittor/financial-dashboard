import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { resolveAndVerifyFx } from '../../lib/fx.js';
import { toArs, arsOnly } from '@fin/shared';
import type { Currency } from '@prisma/client';
import type { z } from 'zod';
import type {
  createIncomeEntrySchema,
  upsertMonthlyIncomePlanSchema,
} from './income.schemas.js';

type CreateEntryInput = z.infer<typeof createIncomeEntrySchema> & { userId: string };
type UpsertPlanInput = z.infer<typeof upsertMonthlyIncomePlanSchema> & { userId: string };

export async function listMonthlyPlans(userId: string) {
  return prisma.monthlyIncomePlan.findMany({
    where: { userId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

export async function upsertMonthlyPlan(input: UpsertPlanInput) {
  const { userId, year, month, estimatedOriginal, estimatedCurrency, fxRate, notes } = input;
  // Derive estimatedArs server-side; do not trust the client-submitted value.
  const derived =
    estimatedCurrency === 'ARS'
      ? arsOnly(estimatedOriginal)
      : toArs(estimatedOriginal, estimatedCurrency as Currency, fxRate);
  const estimatedArs = derived.arsAmount;
  const effectiveFxRate = derived.fxRate;
  const noteVal = notes ?? null;
  return prisma.monthlyIncomePlan.upsert({
    where: { userId_year_month: { userId, year, month } },
    update: { estimatedOriginal, estimatedCurrency, fxRate: effectiveFxRate, estimatedArs, notes: noteVal },
    create: { userId, year, month, estimatedOriginal, estimatedCurrency, fxRate: effectiveFxRate, estimatedArs, notes: noteVal },
  });
}

export async function listIncomeEntries(
  userId: string,
  filters: { year?: number | undefined; month?: number | undefined },
) {
  const where: Prisma.IncomeEntryWhereInput = { userId };
  if (filters.year !== undefined && filters.month !== undefined) {
    const start = new Date(filters.year, filters.month - 1, 1);
    const end = new Date(filters.year, filters.month, 0);
    where.entryDate = { gte: start, lte: end };
  }
  return prisma.incomeEntry.findMany({ where, orderBy: { entryDate: 'desc' } });
}

export async function createIncomeEntry(input: CreateEntryInput) {
  const { userId, entryDate, description, originalAmount, originalCurrency, arsAmount, fxSnapshotId } = input;
  const fx = await resolveAndVerifyFx(userId, {
    originalAmount,
    originalCurrency,
    clientArsAmount: arsAmount,
    fxSnapshotId,
  });
  return prisma.incomeEntry.create({
    data: {
      userId,
      entryDate: new Date(entryDate),
      description: description ?? null,
      originalAmount,
      originalCurrency,
      fxRate: fx.fxRate,
      arsAmount: fx.arsAmount,
      fxSnapshotId: fx.fxSnapshotId,
      source: 'MANUAL',
    },
  });
}
