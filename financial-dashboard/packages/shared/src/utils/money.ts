import Decimal from 'decimal.js';
import type { Currency } from '../types/currency.js';

// Configure Decimal for financial use
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface MoneyResult {
  originalAmount: number;
  originalCurrency: Currency;
  fxRate: number;
  arsAmount: number;
}

/**
 * Convert an original amount to ARS using the given FX rate.
 * Rate is expressed as: 1 originalCurrency = rate ARS.
 * Uses Decimal arithmetic to avoid floating-point precision errors.
 * Result is rounded to 4 decimal places (matches DB Decimal(15,4)).
 */
export function toArs(
  originalAmount: number,
  originalCurrency: Currency,
  fxRate: number,
): MoneyResult {
  if (fxRate <= 0) {
    throw new Error(`Invalid fxRate ${fxRate}: must be positive`);
  }
  if (originalAmount < 0) {
    throw new Error(`Invalid originalAmount ${originalAmount}: must be non-negative`);
  }
  const arsAmount = new Decimal(originalAmount)
    .mul(new Decimal(fxRate))
    .toDecimalPlaces(4)
    .toNumber();

  return { originalAmount, originalCurrency, fxRate, arsAmount };
}

/**
 * Shorthand for ARS-denominated amounts.
 * fxRate is always 1 for ARS → ARS.
 */
export function arsOnly(amount: number): MoneyResult {
  if (amount < 0) {
    throw new Error(`Invalid amount ${amount}: must be non-negative`);
  }
  return { originalAmount: amount, originalCurrency: 'ARS', fxRate: 1, arsAmount: amount };
}

/**
 * Sum an array of ARS amounts using Decimal to prevent accumulation errors.
 */
export function sumArs(amounts: number[]): number {
  return amounts
    .reduce((acc, n) => acc.plus(new Decimal(n)), new Decimal(0))
    .toDecimalPlaces(4)
    .toNumber();
}

/**
 * Round a number to 4 decimal places (DB precision for monetary amounts).
 */
export function roundMoney(n: number): number {
  return new Decimal(n).toDecimalPlaces(4).toNumber();
}
