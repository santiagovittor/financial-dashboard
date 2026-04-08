import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { createDebtSchema, recordDebtPaymentSchema } from './debts.schemas.js';
import * as service from './debts.service.js';

const router: IRouter = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const debts = await service.listDebts(req.session.user!.id);
    res.json({ ok: true, data: debts });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const debt = await service.getDebt(req.session.user!.id, req.params['id']!);
    res.json({ ok: true, data: debt });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createDebtSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const debt = await service.createDebt({ ...body.data, userId: req.session.user!.id });
    res.status(201).json({ ok: true, data: debt });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/payments', async (req, res, next) => {
  try {
    const body = recordDebtPaymentSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const payment = await service.recordPayment({
      ...body.data,
      userId: req.session.user!.id,
      debtId: req.params['id']!,
    });
    res.status(201).json({ ok: true, data: payment });
  } catch (err) {
    next(err);
  }
});

export { router as debtsRouter };
