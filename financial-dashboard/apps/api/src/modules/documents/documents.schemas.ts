import { z } from 'zod';
import { reviewExtractionSchema, SOURCE_DOCUMENT_TYPES } from '@fin/shared';

export { reviewExtractionSchema };

// Allowed MIME types for document uploads.
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Max upload size: 10 MB.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadDocumentSchema = z.object({
  type: z.enum(SOURCE_DOCUMENT_TYPES),
});

// ─── Import schemas ───────────────────────────────────────────────────────────
// The frontend submits one item per canonical record to create.
// All FX provenance fields are required — the UI must resolve them
// (using /api/v1/rates/latest) before the user confirms import.

export const importItemSchema = z.object({
  /** What kind of canonical record to create */
  type: z.enum(['INCOME_ENTRY', 'EXPENSE_ENTRY']),
  /** YYYY-MM-DD */
  entryDate: z.string().date(),
  description: z.string().max(500).optional(),
  originalAmount: z.number().positive(),
  originalCurrency: z.enum(['ARS', 'USD', 'USDT']),
  fxRate: z.number().positive(),
  arsAmount: z.number().positive(),
  fxSnapshotId: z.string().cuid().optional(),
  /** Only for EXPENSE_ENTRY */
  categoryId: z.string().cuid().optional(),
});

export type ImportItem = z.infer<typeof importItemSchema>;

export const importExtractionSchema = z.object({
  items: z.array(importItemSchema).min(1).max(50),
});
