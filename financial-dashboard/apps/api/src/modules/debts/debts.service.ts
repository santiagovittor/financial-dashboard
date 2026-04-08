import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { resolveAndVerifyFx } from '../../lib/fx.js';
import type { z } from 'zod';
import type { createDebtSchema, recordDebtPaymentSchema } from './debts.schemas.js';

type CreateDebtInput = z.infer<typeof createDebtSchema> & { userId: string };
type RecordPaymentInput = z.infer<typeof recordDebtPaymentSchema> & {
  userId: string;
  debtId: string;
};

export async function listDebts(userId: string) {
  return prisma.debt.findMany({
    where: { userId },
    include: { payments: { orderBy: { paymentDate: 'desc' }, take: 5 }, scheduleItems: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDebt(userId: string, id: string) {
  const debt = await prisma.debt.findFirst({
    where: { id, userId },
    include: {
      payments: { orderBy: { paymentDate: 'desc' } },
      scheduleItems: { orderBy: { dueDate: 'asc' } },
    },
  });
  if (!debt) throw new AppError(404, 'Debt not found');
  return debt;
}

export async function createDebt(input: CreateDebtInput) {
  const {
    userId, name, type, originalPrincipal, principalCurrency, arsPrincipal,
    fxSnapshotId, openedAt, dueDate, interestRateAnnual, installmentCount,
    installmentAmount, installmentCurrency, creditLimitOriginal, notes,
  } = input;

  const fx = await resolveAndVerifyFx(userId, {
    originalAmount: originalPrincipal,
    originalCurrency: principalCurrency,
    clientArsAmount: arsPrincipal,
    fxSnapshotId,
  });

  return prisma.debt.create({
    data: {
      userId,
      name,
      type,
      originalPrincipal,
      principalCurrency,
      fxRate: fx.fxRate,
      arsPrincipal: fx.arsAmount,
      fxSnapshotId: fx.fxSnapshotId,
      openedAt: new Date(openedAt),
      dueDate: dueDate ? new Date(dueDate) : null,
      interestRateAnnual: interestRateAnnual ?? null,
      installmentCount: installmentCount ?? null,
      installmentAmount: installmentAmount ?? null,
      installmentCurrency: installmentCurrency ?? null,
      creditLimitOriginal: creditLimitOriginal ?? null,
      currentBalanceOriginal: originalPrincipal,
      currentBalanceCurrency: principalCurrency,
      notes: notes ?? null,
    },
  });
}

export async function recordPayment(input: RecordPaymentInput) {
  const debt = await prisma.debt.findFirst({
    where: { id: input.debtId, userId: input.userId },
  });
  if (!debt) throw new AppError(404, 'Debt not found');
  if (debt.status !== 'ACTIVE') {
    throw new AppError(409, 'Cannot record payment on a non-active debt', 'DEBT_NOT_ACTIVE');
  }

  const {
    originalAmount, originalCurrency, arsAmount,
    fxSnapshotId, isMinimumPayment, notes, paymentDate,
  } = input;

  const fx = await resolveAndVerifyFx(input.userId, {
    originalAmount,
    originalCurrency,
    clientArsAmount: arsAmount,
    fxSnapshotId,
  });

  const [payment] = await prisma.$transaction([
    prisma.debtPayment.create({
      data: {
        debtId: input.debtId,
        userId: input.userId,
        paymentDate: new Date(paymentDate),
        originalAmount,
        originalCurrency,
        fxRate: fx.fxRate,
        arsAmount: fx.arsAmount,
        fxSnapshotId: fx.fxSnapshotId,
        isMinimumPayment,
        notes: notes ?? null,
        source: 'MANUAL',
      },
    }),
    prisma.debt.update({
      where: { id: input.debtId },
      data: { currentBalanceOriginal: { decrement: originalAmount } },
    }),
  ]);

  return payment;
}
