import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { resolveAndVerifyFx } from '../../lib/fx.js';
import type { z } from 'zod';
import type {
  createExpenseCategorySchema,
  createExpenseEntrySchema,
  listExpenseEntriesQuerySchema,
} from './expenses.schemas.js';

type CreateCategoryInput = z.infer<typeof createExpenseCategorySchema> & { userId: string };
type CreateEntryInput = z.infer<typeof createExpenseEntrySchema> & { userId: string };
type ListEntriesQuery = z.infer<typeof listExpenseEntriesQuerySchema>;

export async function listCategories(userId: string) {
  return prisma.expenseCategory.findMany({
    where: { userId, isArchived: false },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(input: CreateCategoryInput) {
  return prisma.expenseCategory.create({
    data: { userId: input.userId, name: input.name, color: input.color ?? null },
  });
}

export async function listEntries(userId: string, filters: ListEntriesQuery) {
  const where: Prisma.ExpenseEntryWhereInput = { userId };
  if (filters.from && filters.to) {
    where.entryDate = { gte: new Date(filters.from), lte: new Date(filters.to) };
  } else if (filters.year !== undefined && filters.month !== undefined) {
    const start = new Date(filters.year, filters.month - 1, 1);
    const end = new Date(filters.year, filters.month, 0);
    where.entryDate = { gte: start, lte: end };
  }
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  return prisma.expenseEntry.findMany({
    where,
    include: { category: true },
    orderBy: { entryDate: 'desc' },
  });
}

export async function createEntry(input: CreateEntryInput) {
  const {
    userId, entryDate, description, categoryId, originalAmount, originalCurrency,
    arsAmount, fxSnapshotId, recurringCommitmentId,
  } = input;
  const fx = await resolveAndVerifyFx(userId, {
    originalAmount,
    originalCurrency,
    clientArsAmount: arsAmount,
    fxSnapshotId,
  });
  return prisma.expenseEntry.create({
    data: {
      userId,
      entryDate: new Date(entryDate),
      description: description ?? null,
      categoryId: categoryId ?? null,
      originalAmount,
      originalCurrency,
      fxRate: fx.fxRate,
      arsAmount: fx.arsAmount,
      fxSnapshotId: fx.fxSnapshotId,
      recurringCommitmentId: recurringCommitmentId ?? null,
      source: 'MANUAL',
    },
  });
}
