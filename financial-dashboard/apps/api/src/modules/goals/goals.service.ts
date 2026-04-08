import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createGoalSchema, patchGoalSchema } from '@fin/shared';

type CreateGoalInput = z.infer<typeof createGoalSchema> & { userId: string };
type PatchGoalInput = z.infer<typeof patchGoalSchema>;

export async function listGoals(userId: string) {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGoal(input: CreateGoalInput) {
  return prisma.goal.create({
    data: {
      userId: input.userId,
      name: input.name,
      targetArs: input.targetArs,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      notes: input.notes ?? null,
    },
  });
}

export async function patchGoal(userId: string, id: string, data: PatchGoalInput) {
  const updateData: Prisma.GoalUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.targetArs !== undefined) updateData.targetArs = data.targetArs;
  if ('targetDate' in data) {
    updateData.targetDate = data.targetDate ? new Date(data.targetDate) : null;
  }
  if (data.currentArs !== undefined) updateData.currentArs = data.currentArs;
  if ('notes' in data) updateData.notes = data.notes ?? null;
  if (data.isCompleted !== undefined) updateData.isCompleted = data.isCompleted;

  // Scope the write to userId so ownership is enforced at the DB level,
  // not only by the preceding read (eliminates TOCTOU race).
  const result = await prisma.goal.updateMany({ where: { id, userId }, data: updateData });
  if (result.count === 0) throw new AppError(404, 'Goal not found');

  return prisma.goal.findUniqueOrThrow({ where: { id } });
}
