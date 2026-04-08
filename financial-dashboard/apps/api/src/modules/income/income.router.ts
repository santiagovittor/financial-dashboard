import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  createIncomeEntrySchema,
  listEntriesQuerySchema,
  upsertMonthlyIncomePlanSchema,
} from './income.schemas.js';
import * as service from './income.service.js';

const router: IRouter = Router();
router.use(requireAuth);

// Monthly income plans
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await service.listMonthlyPlans(req.session.user!.id);
    res.json({ ok: true, data: plans });
  } catch (err) {
    next(err);
  }
});

router.put('/plans', async (req, res, next) => {
  try {
    const body = upsertMonthlyIncomePlanSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const plan = await service.upsertMonthlyPlan({ ...body.data, userId: req.session.user!.id });
    res.json({ ok: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// Actual income entries
router.get('/entries', async (req, res, next) => {
  try {
    const query = listEntriesQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const entries = await service.listIncomeEntries(req.session.user!.id, query.data);
    res.json({ ok: true, data: entries });
  } catch (err) {
    next(err);
  }
});

router.post('/entries', async (req, res, next) => {
  try {
    const body = createIncomeEntrySchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const entry = await service.createIncomeEntry({ ...body.data, userId: req.session.user!.id });
    res.status(201).json({ ok: true, data: entry });
  } catch (err) {
    next(err);
  }
});

export { router as incomeRouter };
