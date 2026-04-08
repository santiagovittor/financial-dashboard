import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../types/currency.js';

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

export const monetaryAmountSchema = z.object({
  originalAmount: z.number().nonnegative(),
  originalCurrency: currencySchema,
  fxRate: z.number().positive(),
  arsAmount: z.number().nonnegative(),
});
