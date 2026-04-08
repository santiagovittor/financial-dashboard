import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { z } from 'zod';
import type {
  addCommitmentVersionSchema,
  createRecurringCommitmentSchema,
} from './commitments.schemas.js';

type CreateInput = z.infer<typeof createRecurringCommitmentSchema> & { userId: string };
type AddVersionInput = z.infer<typeof addCommitmentVersionSchema> & {
  userId: string;
  commitmentId: string;
};

export async function listCommitments(userId: string) {
  return prisma.recurringCommitment.findMany({
    where: { userId },
    include: { versions: { orderBy: { effectiveFrom: 'desc' } }, category: true },
    orderBy: { name: 'asc' },
  });
}

export async function createCommitment(input: CreateInput) {
  const {
    userId, name, type, categoryId, dayOfMonth, startDate, endDate, notes,
    initialAmount, initialCurrency,
  } = input;

  return prisma.recurringCommitment.create({
    data: {
      userId,
      name,
      type,
      categoryId: categoryId ?? null,
      dayOfMonth,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      notes: notes ?? null,
      versions: {
        create: {
          effectiveFrom: new Date(startDate),
          originalAmount: initialAmount,
          originalCurrency: initialCurrency,
        },
      },
    },
    include: { versions: true },
  });
}

export async function addVersion(input: AddVersionInput) {
  const commitment = await prisma.recurringCommitment.findFirst({
    where: { id: input.commitmentId, userId: input.userId },
  });
  if (!commitment) throw new AppError(404, 'Commitment not found');

  return prisma.recurringCommitmentVersion.create({
    data: {
      commitmentId: input.commitmentId,
      effectiveFrom: new Date(input.effectiveFrom),
      originalAmount: input.originalAmount,
      originalCurrency: input.originalCurrency,
      notes: input.notes ?? null,
    },
  });
}

export async function deactivateCommitment(userId: string, id: string) {
  const commitment = await prisma.recurringCommitment.findFirst({ where: { id, userId } });
  if (!commitment) throw new AppError(404, 'Commitment not found');
  if (!commitment.isActive) throw new AppError(409, 'Commitment is already inactive', 'ALREADY_INACTIVE');

  return prisma.recurringCommitment.update({
    where: { id },
    data: { isActive: false },
    include: { versions: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
  });
}
