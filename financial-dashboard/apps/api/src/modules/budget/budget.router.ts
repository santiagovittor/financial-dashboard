import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import * as service from './budget.service.js';

const router: IRouter = Router();
router.use(requireAuth);

// GET /budget/summary?month=2026-04
// Full monthly budget summary powering the main dashboard.
const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM'),
});

router.get('/summary', async (req, res, next) => {
  try {
    const query = monthQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError(400, 'month query param must be YYYY-MM', 'VALIDATION_ERROR');
    const [yearStr, monthStr] = query.data.month.split('-') as [string, string];
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const result = await service.getMonthlySummary(req.session.user!.id, year, month);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /budget/daily?date=2026-04-07
const dateQuerySchema = z.object({
  date: z
    .string()
    .date()
    .optional()
    .transform((d) => (d ? new Date(d) : new Date())),
});

router.get('/daily', async (req, res, next) => {
  try {
    const query = dateQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError(400, 'Invalid date format', 'VALIDATION_ERROR');
    const result = await service.getDailyBudget(req.session.user!.id, query.data.date);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

export { router as budgetRouter };
