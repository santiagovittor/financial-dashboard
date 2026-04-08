/**
 * Extraction pipeline entry point.
 *
 * To swap the heuristic extractor for an LLM (Gemini, Claude, etc.):
 *   1. Implement ExtractionProvider in a new file.
 *   2. Replace `heuristicProvider` here with your provider.
 *   3. No other files need to change.
 */

import pdfParse from 'pdf-parse';
import { extractFromText } from './heuristic.js';
import type { ExtractedPayload, ExtractionProvider } from './types.js';

export type { ExtractedPayload, ExtractionProvider };

/** Heuristic provider: PDF text layer → regex extraction */
const heuristicProvider: ExtractionProvider = {
  async extract(text: string, docType: string): Promise<ExtractedPayload> {
    return extractFromText(text, docType);
  },
};

/** Active provider — replace this export to swap extraction backends. */
export const activeProvider: ExtractionProvider = heuristicProvider;

/**
 * Extract structured data from a file buffer.
 * Returns a payload regardless of outcome — check `confidence` and
 * `extractionMethod` to determine how reliable the result is.
 */
export async function extractDocument(
  buffer: Buffer,
  mimeType: string,
  docType: string,
): Promise<ExtractedPayload> {
  if (mimeType === 'application/pdf') {
    try {
      const parsed = await pdfParse(buffer);
      const text = parsed.text ?? '';
      if (text.trim().length < 50) {
        // Very little text — likely a scanned/image-only PDF
        return {
          version: 1,
          documentType: 'UNKNOWN',
          confidence: 'LOW',
          extractionMethod: 'IMAGE_ONLY',
          rawTextSnippet: text.slice(0, 200),
        };
      }
      return activeProvider.extract(text, docType);
    } catch {
      return {
        version: 1,
        documentType: 'UNKNOWN',
        confidence: 'LOW',
        extractionMethod: 'IMAGE_ONLY',
      };
    }
  }

  // Future: handle CSV, Excel, etc.
  return {
    version: 1,
    documentType: 'UNKNOWN',
    confidence: 'LOW',
    extractionMethod: 'UNSUPPORTED_FORMAT',
  };
}
