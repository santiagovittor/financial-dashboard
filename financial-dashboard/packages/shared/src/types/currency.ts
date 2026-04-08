export const SUPPORTED_CURRENCIES = ['ARS', 'USD', 'USDT'] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CANONICAL_CURRENCY: Currency = 'ARS';

/**
 * A monetary amount with full FX provenance.
 * Every monetary record in the system must eventually conform to this shape.
 */
export interface MonetaryAmount {
  originalAmount: number;
  originalCurrency: Currency;
  /** The FX rate applied: 1 originalCurrency = fxRate ARS */
  fxRate: number;
  /** Canonical amount in ARS = originalAmount * fxRate */
  arsAmount: number;
}
