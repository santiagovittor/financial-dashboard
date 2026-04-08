// Domain enums mirroring the Prisma schema.
// Defined here so the frontend can import them without depending on @prisma/client.

export const DEBT_TYPES = ['FIXED_INSTALLMENT', 'REVOLVING'] as const;
export type DebtType = (typeof DEBT_TYPES)[number];

export const DEBT_STATUSES = ['ACTIVE', 'PAID_OFF', 'CANCELLED'] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

export const RECURRING_COMMITMENT_TYPES = [
  'EXPENSE',
  'SUBSCRIPTION',
  'SERVICE',
  'OTHER',
] as const;
export type RecurringCommitmentType = (typeof RECURRING_COMMITMENT_TYPES)[number];

export const SOURCE_DOCUMENT_TYPES = [
  'CREDIT_CARD_STATEMENT',
  'DEBT_STATEMENT',
  'INVOICE',
  'CSV_EXPENSES',
  'OTHER',
] as const;
export type SourceDocumentType = (typeof SOURCE_DOCUMENT_TYPES)[number];

export const EXTRACTION_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const TRANSACTION_SOURCES = ['MANUAL', 'DOCUMENT_IMPORT'] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

// ─── Risk keys ────────────────────────────────────────────────────────────────
// Canonical keys for RiskSetting.key in the database.

export const RISK_KEYS = {
  DAILY_SPEND_WARNING_RATIO: 'daily_spend_warning_ratio',
  DAILY_SPEND_DANGER_RATIO: 'daily_spend_danger_ratio',
  DEBT_TO_INCOME_WARNING_RATIO: 'debt_to_income_warning_ratio',
  DEBT_TO_INCOME_DANGER_RATIO: 'debt_to_income_danger_ratio',
} as const;

export type RiskKey = (typeof RISK_KEYS)[keyof typeof RISK_KEYS];

export const DEFAULT_RISK_VALUES: Record<RiskKey, number> = {
  [RISK_KEYS.DAILY_SPEND_WARNING_RATIO]: 0.8,
  [RISK_KEYS.DAILY_SPEND_DANGER_RATIO]: 1.0,
  [RISK_KEYS.DEBT_TO_INCOME_WARNING_RATIO]: 0.3,
  [RISK_KEYS.DEBT_TO_INCOME_DANGER_RATIO]: 0.5,
};
