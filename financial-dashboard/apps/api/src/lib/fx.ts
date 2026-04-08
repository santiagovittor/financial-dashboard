/**
 * DB-backed FX snapshot resolution.
 *
 * Pure resolution logic lives in @fin/shared/utils/fx.ts.
 * This module adds DB access and AppError integration.
 */
import { prisma } from './prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { findApplicableRate, toArs, arsOnly } from '@fin/shared';
import type { Currency } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

export function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

/**
 * Returns the applicable rate (number) for fromCurrency→ARS on forDate.
 * Returns null when no snapshot qualifies.
 */
export async function resolveFxSnapshot(
  userId: string,
  fromCurrency: string,
  forDate: Date,
): Promise<number | null> {
  const snapshots = await prisma.exchangeRateSnapshot.findMany({
    where: { userId, fromCurrency: fromCurrency as Currency, toCurrency: 'ARS' as Currency },
    select: { effectiveDate: true, rate: true },
  });

  const applicable = findApplicableRate(
    snapshots.map((s) => ({ effectiveDate: s.effectiveDate, rate: decimalToNumber(s.rate) })),
    forDate,
  );

  return applicable?.rate ?? null;
}

/**
 * Like resolveFxSnapshot but throws 422 FX_RATE_NOT_FOUND when no rate exists.
 * Use this in write paths where a missing rate must block the operation.
 */
export async function requireFxSnapshot(
  userId: string,
  fromCurrency: string,
  forDate: Date,
): Promise<number> {
  const rate = await resolveFxSnapshot(userId, fromCurrency, forDate);
  if (rate === null) {
    throw new AppError(
      422,
      `No ${fromCurrency}/ARS exchange rate found for ${forDate.toISOString().slice(0, 10)}. ` +
        `Add a rate snapshot first.`,
      'FX_RATE_NOT_FOUND',
    );
  }
  return rate;
}

/**
 * Resolve and verify FX provenance for a monetary entry.
 *
 * Security contract:
 * - arsAmount is ALWAYS derived server-side; the client-submitted value is only
 *   used for mismatch detection.
 * - For ARS entries: fxRate=1, arsAmount=originalAmount; no snapshot required.
 * - For non-ARS entries: fxSnapshotId is required and must belong to userId.
 *   The snapshot's stored rate is authoritative — the client-submitted fxRate
 *   and arsAmount are cross-checked, and the request is rejected if they diverge
 *   from the server-computed value by more than 1 ARS (rounding tolerance).
 *
 * Returns the resolved { fxRate, arsAmount, fxSnapshotId } that must be persisted.
 */
export async function resolveAndVerifyFx(
  userId: string,
  input: {
    originalAmount: number;
    originalCurrency: string;
    clientArsAmount: number;
    fxSnapshotId?: string | null | undefined;
  },
): Promise<{ fxRate: number; arsAmount: number; fxSnapshotId: string | null }> {
  const { originalAmount, originalCurrency, clientArsAmount, fxSnapshotId } = input;

  if (originalCurrency === 'ARS') {
    const derived = arsOnly(originalAmount);
    return { fxRate: 1, arsAmount: derived.arsAmount, fxSnapshotId: null };
  }

  // Non-ARS: snapshot required for ownership verification and rate resolution.
  if (!fxSnapshotId) {
    throw new AppError(
      422,
      'fxSnapshotId is required for non-ARS transactions',
      'FX_SNAPSHOT_REQUIRED',
    );
  }

  const snapshot = await prisma.exchangeRateSnapshot.findFirst({
    where: { id: fxSnapshotId, userId },
    select: { rate: true },
  });

  if (!snapshot) {
    throw new AppError(
      422,
      'FX snapshot not found or not accessible',
      'FX_SNAPSHOT_NOT_FOUND',
    );
  }

  const rate = decimalToNumber(snapshot.rate);
  const derived = toArs(originalAmount, originalCurrency as Currency, rate);

  // Reject if the client-submitted arsAmount diverges from the server-computed
  // value by more than 1 ARS (allows for rounding differences).
  if (Math.abs(derived.arsAmount - clientArsAmount) > 1) {
    throw new AppError(
      422,
      `arsAmount mismatch: client submitted ${clientArsAmount} but server computed ${derived.arsAmount} from snapshot rate`,
      'FX_AMOUNT_MISMATCH',
    );
  }

  return { fxRate: rate, arsAmount: derived.arsAmount, fxSnapshotId };
}
