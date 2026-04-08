import { z } from 'zod';
import { currencySchema } from './currency.js';
import {
  DEBT_TYPES,
  RECURRING_COMMITMENT_TYPES,
  REVIEW_STATUSES,
} from '../types/domain.js';

// ─── Reusable money input schema ──────────────────────────────────────────────
// Use this wherever an API accepts a monetary amount with FX provenance.
// The caller must supply the fxRate and arsAmount (validated server-side
// against a stored ExchangeRateSnapshot).

export const moneyInputSchema = z.object({
  originalAmount: z.number().positive(),
  originalCurrency: currencySchema,
  fxRate: z.number().positive(),
  arsAmount: z.number().positive(),
});

export type MoneyInput = z.infer<typeof moneyInputSchema>;

// ─── Domain input schemas ─────────────────────────────────────────────────────

export const createIncomeEntrySchema = z.object({
  entryDate: z.string().date(), // YYYY-MM-DD
  description: z.string().max(500).optional(),
  ...moneyInputSchema.shape,
  fxSnapshotId: z.string().cuid().optional(),
});

export const upsertMonthlyIncomePlanSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  ...moneyInputSchema.shape,
  estimatedOriginal: z.number().positive(),
  estimatedCurrency: currencySchema,
  fxRate: z.number().positive(),
  estimatedArs: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color')
    .optional(),
});

export const createExpenseEntrySchema = z.object({
  entryDate: z.string().date(),
  description: z.string().max(500).optional(),
  categoryId: z.string().cuid().optional(),
  ...moneyInputSchema.shape,
  fxSnapshotId: z.string().cuid().optional(),
  recurringCommitmentId: z.string().cuid().optional(),
});

export const createRecurringCommitmentSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(RECURRING_COMMITMENT_TYPES),
  categoryId: z.string().cuid().optional(),
  dayOfMonth: z.number().int().min(1).max(31),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  notes: z.string().max(500).optional(),
  // Initial version
  initialAmount: z.number().positive(),
  initialCurrency: currencySchema,
});

export const addCommitmentVersionSchema = z.object({
  effectiveFrom: z.string().date(),
  originalAmount: z.number().positive(),
  originalCurrency: currencySchema,
  notes: z.string().max(500).optional(),
});

export const createDebtSchema = z
  .object({
    name: z.string().min(1).max(200),
    type: z.enum(DEBT_TYPES),
    originalPrincipal: z.number().positive(),
    principalCurrency: currencySchema,
    fxRate: z.number().positive(),
    arsPrincipal: z.number().positive(),
    fxSnapshotId: z.string().cuid().optional(),
    openedAt: z.string().date(),
    dueDate: z.string().date().optional(),
    interestRateAnnual: z.number().min(0).max(100).optional(),
    // Fixed-installment fields
    installmentCount: z.number().int().positive().optional(),
    installmentAmount: z.number().positive().optional(),
    installmentCurrency: currencySchema.optional(),
    // Revolving fields
    creditLimitOriginal: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'FIXED_INSTALLMENT') {
      if (!data.installmentCount || !data.installmentAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'installmentCount and installmentAmount are required for FIXED_INSTALLMENT debts',
        });
      }
    }
    if (data.type === 'REVOLVING' && !data.creditLimitOriginal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'creditLimitOriginal is required for REVOLVING debts',
      });
    }
  });

export const recordDebtPaymentSchema = z.object({
  paymentDate: z.string().date(),
  ...moneyInputSchema.shape,
  fxSnapshotId: z.string().cuid().optional(),
  isMinimumPayment: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export const createGoalSchema = z.object({
  name: z.string().min(1).max(200),
  targetArs: z.number().positive(),
  targetDate: z.string().date().optional(),
  notes: z.string().max(500).optional(),
});

export const upsertRiskSettingSchema = z.object({
  value: z.number().positive(),
  description: z.string().max(300).optional(),
});

export const createExchangeRateSnapshotSchema = z.object({
  fromCurrency: currencySchema,
  effectiveDate: z.string().date(),
  rate: z.number().positive(),
  notes: z.string().max(300).optional(),
});

export const reviewExtractionSchema = z.object({
  status: z.enum([REVIEW_STATUSES[1], REVIEW_STATUSES[2]]), // APPROVED | REJECTED
  notes: z.string().max(1000).optional(),
});

export const patchGoalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  targetArs: z.number().positive().optional(),
  targetDate: z.string().date().nullable().optional(),
  currentArs: z.number().nonnegative().optional(),
  notes: z.string().max(500).nullable().optional(),
  isCompleted: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });
