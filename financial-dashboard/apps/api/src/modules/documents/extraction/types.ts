import { z } from 'zod';

// ─── Spending categories ───────────────────────────────────────────────────────

export const SPENDING_CATEGORIES = [
  'groceries',
  'transport',
  'dining',
  'shopping',
  'subscriptions',
  'utilities',
  'health',
  'taxes_fees',
  'debt_cost',
  'other',
] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const lineItemSchema = z.object({
  /** YYYY-MM-DD */
  date: z.string().optional(),
  description: z.string(),
  amount: z.number(),
  currency: z.enum(['ARS', 'USD', 'USDT']),
  category: z.enum(SPENDING_CATEGORIES).optional(),
  /** true = essential expense (groceries, utilities, health, commute) */
  essential: z.boolean().optional(),
  /** true = regular monthly charge (subscription, bill) */
  recurring: z.boolean().optional(),
  /** e.g. 3 for "3 of 12" */
  installmentCurrent: z.number().int().optional(),
  installmentTotal: z.number().int().optional(),
});

export const statementSummarySchema = z.object({
  issuer: z.string().optional(),
  cardName: z.string().optional(),
  /** Human-readable billing period, e.g. "Marzo 2026" */
  statementPeriod: z.string().optional(),
  /** YYYY-MM-DD */
  closingDate: z.string().optional(),
  /** YYYY-MM-DD */
  dueDate: z.string().optional(),
  minimumPayment: z.number().optional(),
  totalDue: z.number().optional(),
  /** Primary currency of the statement */
  currency: z.enum(['ARS', 'USD', 'USDT']).optional(),
  /** Sum of all ARS-denominated charges */
  totalArs: z.number().optional(),
  /** Sum of all USD-denominated charges (original USD amounts) */
  totalUsd: z.number().optional(),
  /** Sum of taxes, fees, administrative charges */
  taxesAndFees: z.number().optional(),
  /** Interest/financiación charged */
  interest: z.number().optional(),
  lineItems: z.array(lineItemSchema).optional(),
  /** Extraction quality notes or ambiguities */
  warnings: z.array(z.string()).optional(),
});

export const extractedIncomeSchema = z.object({
  amount: z.number().optional(),
  currency: z.enum(['ARS', 'USD', 'USDT']).optional(),
  /** YYYY-MM-DD */
  date: z.string().optional(),
  /** Human-readable billing period, e.g. "Marzo 2026" */
  period: z.string().optional(),
  description: z.string().optional(),
});

export const extractedPayloadSchema = z.object({
  version: z.literal(1),
  documentType: z.enum(['INCOME', 'CREDIT_CARD_STATEMENT', 'UNKNOWN']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  /**
   * GEMINI_PDF          — extracted by Gemini from raw PDF buffer
   * IMAGE_ONLY          — PDF had no text layer; extraction not possible
   * UNSUPPORTED_FORMAT  — mime type not parseable
   * PENDING_LLM         — provider not configured
   */
  extractionMethod: z.enum(['GEMINI_PDF', 'IMAGE_ONLY', 'UNSUPPORTED_FORMAT', 'PENDING_LLM']),
  rawTextSnippet: z.string().optional(),
  income: extractedIncomeSchema.optional(),
  statement: statementSummarySchema.optional(),
});

// ─── Derived types ─────────────────────────────────────────────────────────────

export type LineItem = z.infer<typeof lineItemSchema>;
export type StatementSummary = z.infer<typeof statementSummarySchema>;
export type ExtractedIncome = z.infer<typeof extractedIncomeSchema>;
export type ExtractedPayload = z.infer<typeof extractedPayloadSchema>;

// ─── Provider interface ────────────────────────────────────────────────────────

/** Extraction provider — receives the raw uploaded file buffer. */
export interface ExtractionProvider {
  extract(buffer: Buffer, mimeType: string, docType: string): Promise<ExtractedPayload>;
}
