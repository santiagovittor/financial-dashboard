import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractedPayloadSchema, SPENDING_CATEGORIES } from './types.js';
import type { ExtractionProvider, ExtractedPayload } from './types.js';

// Lazy-initialized so the module can be imported even when the key is absent;
// the actual error surfaces only when extraction is attempted.
let _model: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null = null;

function getModel() {
  if (_model) return _model;
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set — Gemini extraction is unavailable. ' +
        'Add GEMINI_API_KEY to your environment to enable AI extraction.',
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  _model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  return _model;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const CATEGORIES_LIST = SPENDING_CATEGORIES.join(', ');

const EXTRACTION_PROMPT = `You are analyzing a financial document (PDF). Extract all data and return a single JSON object.

Return ONLY valid JSON. No markdown, no code fences, no explanation.

JSON structure for a credit card statement:
{
  "version": 1,
  "documentType": "CREDIT_CARD_STATEMENT",
  "confidence": "HIGH",
  "extractionMethod": "GEMINI_PDF",
  "statement": {
    "issuer": "Banco Galicia",
    "cardName": "Visa Gold",
    "statementPeriod": "Marzo 2026",
    "closingDate": "2026-03-31",
    "dueDate": "2026-04-15",
    "minimumPayment": 12500.00,
    "totalDue": 87350.75,
    "currency": "ARS",
    "totalArs": 78650.75,
    "totalUsd": 45.20,
    "taxesAndFees": 8200.00,
    "interest": 0,
    "lineItems": [
      {
        "date": "2026-03-05",
        "description": "SUPERMERCADO COTO",
        "amount": 4500.00,
        "currency": "ARS",
        "category": "groceries",
        "essential": true,
        "recurring": false
      },
      {
        "date": "2026-03-10",
        "description": "NETFLIX",
        "amount": 8900.00,
        "currency": "ARS",
        "category": "subscriptions",
        "essential": false,
        "recurring": true,
        "installmentCurrent": 1,
        "installmentTotal": 1
      }
    ],
    "warnings": []
  }
}

Rules:
- documentType: "CREDIT_CARD_STATEMENT" for credit card statements, "INCOME" for pay stubs or invoices, "UNKNOWN" for anything else
- confidence: "HIGH" if all key fields are readable, "MEDIUM" if some are unclear, "LOW" if the document is hard to read
- All dates must be YYYY-MM-DD. Convert from any format (e.g. "15/04/2026" → "2026-04-15")
- Amounts are always positive numbers — never include currency symbols
- totalArs: sum of all ARS-denominated charges shown on the statement
- totalUsd: sum of all USD-denominated charges in original USD (if any USD purchases appear)
- taxesAndFees: sum of IVA, impuesto PAIS, percepción IIGG, recargos, and any administrative fees
- interest: total interest or financiación charged (not the purchase amounts themselves)
- category must be one of: ${CATEGORIES_LIST}
- essential: true for groceries, utilities, transport, health; false for dining out, shopping, entertainment, subscriptions
- recurring: true for subscriptions and regular monthly charges; false for one-time purchases
- installmentCurrent/installmentTotal: only include when the line item explicitly shows installment info (e.g. "3 de 12" → current:3, total:12)
- warnings: list any data quality issues, ambiguities, or fields you could not confidently extract
- Omit fields you cannot confidently find — do not guess or emit null
- For INCOME documents use "income" key instead of "statement"
- Return ONLY the JSON object`;

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJsonObject(text: string): string {
  // Strip markdown code fences if the model wrapped its output
  const stripped = text
    .replace(/^```[a-z]*\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini response did not contain a JSON object');
  }
  return stripped.slice(start, end + 1);
}

// ─── Null stripping ────────────────────────────────────────────────────────────
// Gemini sometimes emits `null` for missing optional fields. Strip these so the
// Zod schema's .optional() validators accept the output cleanly.

function stripNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripNulls);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const geminiProvider: ExtractionProvider = {
  async extract(buffer: Buffer, mimeType: string, _docType: string): Promise<ExtractedPayload> {
    const model = getModel();

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType as 'application/pdf',
          data: buffer.toString('base64'),
        },
      },
      EXTRACTION_PROMPT,
    ]);

    const text = result.response.text();
    const jsonString = extractJsonObject(text);
    const raw = stripNulls(JSON.parse(jsonString) as unknown) as unknown;

    return extractedPayloadSchema.parse(raw);
  },
};
