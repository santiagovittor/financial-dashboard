import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { RISK_KEYS, DEFAULT_RISK_VALUES } from '@fin/shared';

export async function listRiskSettings(userId: string) {
  return prisma.riskSetting.findMany({
    where: { userId },
    orderBy: { key: 'asc' },
  });
}

/**
 * Upsert a risk setting. Only accepts known keys defined in RISK_KEYS.
 */
export async function upsertRiskSetting(
  userId: string,
  key: string,
  value: number,
  description?: string,
) {
  const validKeys = Object.values(RISK_KEYS) as string[];
  if (!validKeys.includes(key)) {
    throw new AppError(400, `Unknown risk key: ${key}. Valid keys: ${validKeys.join(', ')}`);
  }

  return prisma.riskSetting.upsert({
    where: { userId_key: { userId, key } },
    update: { value, description: description ?? null },
    create: { userId, key, value, description: description ?? null },
  });
}

/**
 * Seed default risk settings for a user if none exist.
 * Called during first login or setup.
 */
export async function seedDefaultRiskSettings(userId: string) {
  const existing = await prisma.riskSetting.findMany({ where: { userId } });
  const existingKeys = new Set(existing.map((s: { key: string }) => s.key));
  const missing = Object.entries(DEFAULT_RISK_VALUES).filter(([k]) => !existingKeys.has(k));

  if (missing.length === 0) return;

  await prisma.riskSetting.createMany({
    data: missing.map(([key, value]) => ({ userId, key, value })),
    skipDuplicates: true,
  });
}
