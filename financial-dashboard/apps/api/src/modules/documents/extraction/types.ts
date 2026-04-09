// Structured payload produced by any extraction provider.
// Stored verbatim in DocumentExtraction.rawExtractedJson.

export interface ExtractedIncome {
  amount?: number;
  currency?: 'ARS' | 'USD' | 'USDT';
  /** YYYY-MM-DD */
  date?: string;
  /** Human-readable billing period, e.g. "Marzo 2026" */
  period?: string;
  description?: string;
}

export interface ExtractedStatement {
  issuer?: string;
  /** YYYY-MM-DD */
  closingDate?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  totalDue?: number;
  minimumPayment?: number;
  currency?: 'ARS' | 'USD' | 'USDT';
}

export interface ExtractedPayload {
  version: 1;
  documentType: 'INCOME' | 'CREDIT_CARD_STATEMENT' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /**
   * PDF_TEXT          — text layer extracted cleanly (heuristic, removed)
   * IMAGE_ONLY        — PDF had no text layer (scanned); extraction not possible
   * UNSUPPORTED_FORMAT — mime type not parseable as text
   * PENDING_LLM       — placeholder until the Claude-based provider is implemented
   */
  extractionMethod: 'PDF_TEXT' | 'IMAGE_ONLY' | 'UNSUPPORTED_FORMAT' | 'PENDING_LLM';
  /** First 500 chars of raw text, for user reference in the review UI */
  rawTextSnippet?: string;
  income?: ExtractedIncome;
  statement?: ExtractedStatement;
}

/** Provider interface — swap heuristic for LLM by implementing this. */
export interface ExtractionProvider {
  extract(text: string, docType: string): Promise<ExtractedPayload>;
}
