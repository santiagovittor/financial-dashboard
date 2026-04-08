/**
 * Heuristic text extractor for common Argentine financial documents.
 *
 * Handles two document types:
 *   CREDIT_CARD_STATEMENT — resúmenes de tarjeta (Visa, Mastercard, etc.)
 *   INCOME               — facturas, recibos de sueldo, liquidaciones
 *
 * This is intentionally simple: regex over extracted PDF text.
 * Swap the ExtractionProvider in index.ts to use an LLM instead.
 */

import type { ExtractedPayload } from './types.js';

// ─── Amount parsing ───────────────────────────────────────────────────────────
// Argentine PDFs use period as thousands separator and comma as decimal:
//   "1.234,56" → 1234.56
// Some digital exports reverse this. We handle both.
function parseAmount(raw: string): number | undefined {
  const s = raw.replace(/\s/g, '').replace(/[$\u20ac\u20b1]/g, '');
  if (!s) return undefined;
  let n: number;
  if (/,\d{1,2}$/.test(s)) {
    // "1.234,56" — comma is decimal separator
    n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  } else if (/\.\d{1,2}$/.test(s)) {
    // "1,234.56" — period is decimal separator
    n = parseFloat(s.replace(/,/g, ''));
  } else {
    // No decimal part — strip all separators
    n = parseFloat(s.replace(/[.,]/g, ''));
  }
  return isNaN(n) || n <= 0 ? undefined : n;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────
function parseDate(raw: string): string | undefined {
  // DD/MM/YYYY or DD-MM-YYYY
  let m = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  // YYYY-MM-DD or YYYY/MM/DD
  m = raw.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  return undefined;
}

// ─── Pattern matching helper ──────────────────────────────────────────────────
function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

// ─── Credit card statement extraction ────────────────────────────────────────
const ISSUERS = [
  'VISA', 'MASTERCARD', 'AMERICAN EXPRESS', 'AMEX',
  'NARANJA', 'ICBC', 'GALICIA', 'SANTANDER', 'HSBC',
  'MACRO', 'BBVA', 'CIUDAD', 'PATAGONIA', 'SUPERVIELLE',
] as const;

function extractStatement(text: string): ExtractedPayload {
  const totalRaw = firstMatch(text, [
    /total\s+a\s+pagar[:\s]+\$?\s*([\d.,]+)/i,
    /importe\s+total[:\s]+\$?\s*([\d.,]+)/i,
    /saldo\s+total[:\s]+\$?\s*([\d.,]+)/i,
    /total\s+del\s+resumen[:\s]+\$?\s*([\d.,]+)/i,
    /total\s+facturado[:\s]+\$?\s*([\d.,]+)/i,
  ]);
  const minRaw = firstMatch(text, [
    /pago\s+m[ií]nimo[:\s]+\$?\s*([\d.,]+)/i,
    /m[ií]nimo\s+a\s+pagar[:\s]+\$?\s*([\d.,]+)/i,
    /pago\s+m[ií]n[\.:]?\s*\$?\s*([\d.,]+)/i,
  ]);
  const dueDateRaw = firstMatch(text, [
    /vencimiento[:\s]+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
    /fecha\s+(?:de\s+)?vencimiento[:\s]+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
    /1[eº]r?\s+vencimiento[:\s]+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
  ]);
  const closingRaw = firstMatch(text, [
    /cierre[:\s]+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
    /fecha\s+(?:de\s+)?cierre[:\s]+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
    /per[ií]odo[:\s]+[\w\s]+hasta\s+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
  ]);

  const upper = text.toUpperCase();
  const issuer = ISSUERS.find((n) => upper.includes(n));
  const totalDue = totalRaw ? parseAmount(totalRaw) : undefined;
  const minimumPayment = minRaw ? parseAmount(minRaw) : undefined;
  const dueDate = dueDateRaw ? parseDate(dueDateRaw) : undefined;
  const closingDate = closingRaw ? parseDate(closingRaw) : undefined;

  const fieldsFound = [totalDue, dueDate, issuer].filter(Boolean).length;
  const confidence = fieldsFound >= 2 ? 'HIGH' : fieldsFound === 1 ? 'MEDIUM' : 'LOW';

  return {
    version: 1,
    documentType: 'CREDIT_CARD_STATEMENT',
    confidence,
    extractionMethod: 'PDF_TEXT',
    rawTextSnippet: text.slice(0, 500),
    statement: {
      ...(issuer !== undefined && { issuer }),
      ...(closingDate !== undefined && { closingDate }),
      ...(dueDate !== undefined && { dueDate }),
      ...(totalDue !== undefined && { totalDue }),
      ...(minimumPayment !== undefined && { minimumPayment }),
      currency: 'ARS' as const,
    },
  };
}

// ─── Income / invoice extraction ──────────────────────────────────────────────
function extractIncome(text: string): ExtractedPayload {
  const amountRaw = firstMatch(text, [
    /(?:neto\s+a\s+cobrar|total\s+neto)[:\s]+\$?\s*([\d.,]+)/i,
    /(?:total|importe|monto|honorarios|sueldo|salario)[:\s]+\$?\s*([\d.,]+)/i,
    /\$\s*([\d.,]+)/,
  ]);
  const dateRaw = firstMatch(text, [
    /fecha\s+(?:de\s+)?(?:emisi[oó]n|pago|liquidaci[oó]n)[:\s]+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
    /fecha[:\s]+([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i,
    /([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/,
  ]);

  // Spanish month names for period detection
  const MONTHS_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const periodRaw = firstMatch(text, [
    new RegExp(`((?:${MONTHS_ES.join('|')})\\s+\\d{4})`, 'i'),
    /per[ií]odo[:\s]+([\w\s]+?\d{4})/i,
  ]);

  const amount = amountRaw ? parseAmount(amountRaw) : undefined;
  const date = dateRaw ? parseDate(dateRaw) : undefined;
  const fieldsFound = [amount, date].filter(Boolean).length;
  const confidence = fieldsFound >= 2 ? 'HIGH' : fieldsFound === 1 ? 'MEDIUM' : 'LOW';

  return {
    version: 1,
    documentType: 'INCOME',
    confidence,
    extractionMethod: 'PDF_TEXT',
    rawTextSnippet: text.slice(0, 500),
    income: {
      ...(amount !== undefined && { amount }),
      currency: 'ARS' as const,
      ...(date !== undefined && { date }),
      ...(periodRaw !== undefined && { period: periodRaw }),
    },
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────
export function extractFromText(text: string, docType: string): ExtractedPayload {
  const isStatement =
    docType === 'CREDIT_CARD_STATEMENT' ||
    /resum[eé]n|tarjeta|pago\s+m[ií]nimo|total\s+a\s+pagar/i.test(text);
  const isIncome =
    docType === 'INVOICE' ||
    /factura|recibo\s+de\s+sueldo|liquidaci[oó]n|honorarios/i.test(text);

  if (isStatement) return extractStatement(text);
  if (isIncome) return extractIncome(text);

  // Unknown type — try both and return the higher-confidence result
  const stmt = extractStatement(text);
  const inc = extractIncome(text);
  const order: ExtractedPayload['confidence'][] = ['HIGH', 'MEDIUM', 'LOW'];
  return order.indexOf(stmt.confidence) <= order.indexOf(inc.confidence) ? stmt : inc;
}
