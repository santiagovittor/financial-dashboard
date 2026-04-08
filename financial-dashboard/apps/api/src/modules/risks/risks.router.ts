import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { upsertRiskSettingSchema } from '@fin/shared';
import * as service from './risks.service.js';
import * as budgetService from '../budget/budget.service.js';

const router: IRouter = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const settings = await service.listRiskSettings(req.session.user!.id);
    res.json({ ok: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put('/:key', async (req, res, next) => {
  try {
    const body = upsertRiskSettingSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const setting = await service.upsertRiskSetting(
      req.session.user!.id,
      req.params['key']!,
      Number(body.data.value),
      body.data.description,
    );
    res.json({ ok: true, data: setting });
  } catch (err) {
    next(err);
  }
});

// GET /risks/evaluate — evaluates risk for the current month
// Returns just the risk + balance slice of the monthly summary.
router.get('/evaluate', async (req, res, next) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const summary = await budgetService.getMonthlySummary(req.session.user!.id, year, month);
    res.json({
      ok: true,
      data: {
        month: summary.monthLabel,
        risk: summary.risk,
        balance: summary.balance,
        remainingDays: summary.remainingDays,
      },
    });
  } catch (err) {
    next(err);
  }
});

export { router as risksRouter };
