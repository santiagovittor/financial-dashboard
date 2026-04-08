import { z } from 'zod';
import { createIncomeEntrySchema, upsertMonthlyIncomePlanSchema } from '@fin/shared';

export { createIncomeEntrySchema, upsertMonthlyIncomePlanSchema };

export const listEntriesQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
