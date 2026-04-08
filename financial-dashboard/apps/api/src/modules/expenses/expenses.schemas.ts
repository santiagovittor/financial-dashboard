import { z } from 'zod';
import { createExpenseCategorySchema, createExpenseEntrySchema } from '@fin/shared';

export { createExpenseCategorySchema, createExpenseEntrySchema };

export const listExpenseEntriesQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    from: z.string().date().optional(), // YYYY-MM-DD — overrides year/month when provided
    to: z.string().date().optional(),   // YYYY-MM-DD — inclusive
    categoryId: z.string().cuid().optional(),
  })
  .refine(
    (d) => !(d.from && !d.to) && !(!d.from && d.to),
    { message: 'from and to must be provided together' },
  );
