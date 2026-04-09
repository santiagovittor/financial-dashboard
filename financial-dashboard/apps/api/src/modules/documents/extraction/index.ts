/**
 * Extraction pipeline entry point.
 *
 * The heuristic (regex) extractor has been removed.
 * Implement a Claude-based ExtractionProvider here:
 *   1. Create a new file (e.g. claude-provider.ts) that implements ExtractionProvider.
 *   2. Call the Claude API with the raw PDF buffer as a document content block.
 *   3. Validate the JSON response with Zod before returning it as ExtractedPayload.
 *   4. Set `activeProvider` below to your new provider.
 *
 * See CLAUDE.md → "Document Extraction Pipeline" and use the statement-analysis-design skill.
 */

export type { ExtractedPayload, ExtractionProvider } from './types.js';

/**
 * Placeholder — returns PENDING_LLM until the Claude provider is implemented.
 * Replace the body of this function (or set activeProvider) when the provider is ready.
 */
export async function extractDocument(
  _buffer: Buffer,
  _mimeType: string,
  _docType: string,
): Promise<import('./types.js').ExtractedPayload> {
  return {
    version: 1,
    documentType: 'UNKNOWN',
    confidence: 'LOW',
    extractionMethod: 'PENDING_LLM',
  };
}
