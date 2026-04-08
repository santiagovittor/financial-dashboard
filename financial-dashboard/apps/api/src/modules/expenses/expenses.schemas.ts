import { z } from 'zod';
import { createExpenseCategorySchema, createExpenseEntrySchema } from '@fin/shared';

export { createExpenseCategorySchema, createExpenseEntrySchema };

export const listExpenseEntriesQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM').optional(),
    from: z.string().date().optional(), // YYYY-MM-DD — overrides month when provided
    to: z.string().date().optional(),   // YYYY-MM-DD — inclusive
    categoryId: z.string().cuid().optional(),
  })
  .refine(
    (d) => !(d.from && !d.to) && !(!d.from && d.to),
    { message: 'from and to must be provided together' },
  )
  .transform(({ month, ...rest }) => {
    if (!month) return { year: undefined, month: undefined, ...rest };
    const [y, m] = month.split('-') as [string, string];
    return { year: parseInt(y, 10), month: parseInt(m, 10), ...rest };
  });
