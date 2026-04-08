import { z } from 'zod';
import { reviewExtractionSchema, SOURCE_DOCUMENT_TYPES } from '@fin/shared';

export { reviewExtractionSchema };

// Allowed MIME types for document uploads.
// This list is intentionally restrictive — expand only when a parser exists.
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Max upload size: 10 MB. Enforce in multipart middleware when implemented.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadDocumentSchema = z.object({
  type: z.enum(SOURCE_DOCUMENT_TYPES),
});
