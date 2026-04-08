import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { createGoalSchema, patchGoalSchema } from '@fin/shared';
import * as service from './goals.service.js';

const router: IRouter = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const goals = await service.listGoals(req.session.user!.id);
    res.json({ ok: true, data: goals });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createGoalSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const goal = await service.createGoal({ ...body.data, userId: req.session.user!.id });
    res.status(201).json({ ok: true, data: goal });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = patchGoalSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const goal = await service.patchGoal(req.session.user!.id, req.params['id']!, body.data);
    res.json({ ok: true, data: goal });
  } catch (err) {
    next(err);
  }
});

export { router as goalsRouter };
