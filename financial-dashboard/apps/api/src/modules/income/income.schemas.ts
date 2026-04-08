import { z } from 'zod';
import { createIncomeEntrySchema, upsertMonthlyIncomePlanSchema } from '@fin/shared';

export { createIncomeEntrySchema, upsertMonthlyIncomePlanSchema };

export const listEntriesQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM').optional(),
  })
  .transform(({ month }) => {
    if (!month) return { year: undefined, month: undefined };
    const [y, m] = month.split('-') as [string, string];
    return { year: parseInt(y, 10), month: parseInt(m, 10) };
  });
