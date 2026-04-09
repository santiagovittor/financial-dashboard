/**
 * Extraction pipeline entry point.
 *
 * Uses the Gemini provider when GEMINI_API_KEY is set; falls back to a
 * PENDING_LLM stub payload when the key is absent so uploads still succeed.
 */

export type { ExtractedPayload, ExtractionProvider, LineItem, StatementSummary } from './types.js';
import { geminiProvider } from './gemini-provider.js';
import type { ExtractedPayload } from './types.js';

export async function extractDocument(
  buffer: Buffer,
  mimeType: string,
  docType: string,
): Promise<ExtractedPayload> {
  if (!process.env['GEMINI_API_KEY']) {
    return {
      version: 1,
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      extractionMethod: 'PENDING_LLM',
      statement: {
        warnings: [
          'AI extraction is not configured. Set GEMINI_API_KEY in your environment to enable.',
        ],
      },
    };
  }

  return geminiProvider.extract(buffer, mimeType, docType);
}
