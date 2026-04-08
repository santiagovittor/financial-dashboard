import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  addCommitmentVersionSchema,
  createRecurringCommitmentSchema,
} from './commitments.schemas.js';
import * as service from './commitments.service.js';

const router: IRouter = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const commitments = await service.listCommitments(req.session.user!.id);
    res.json({ ok: true, data: commitments });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createRecurringCommitmentSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const commitment = await service.createCommitment({
      ...body.data,
      userId: req.session.user!.id,
    });
    res.status(201).json({ ok: true, data: commitment });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/deactivate — soft-delete: marks isActive=false, stops appearing in summaries
router.patch('/:id/deactivate', async (req, res, next) => {
  try {
    const commitment = await service.deactivateCommitment(
      req.session.user!.id,
      req.params['id']!,
    );
    res.json({ ok: true, data: commitment });
  } catch (err) {
    next(err);
  }
});

// Add a new effective-dated version (amount change)
router.post('/:id/versions', async (req, res, next) => {
  try {
    const body = addCommitmentVersionSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const version = await service.addVersion({
      ...body.data,
      userId: req.session.user!.id,
      commitmentId: req.params['id']!,
    });
    res.status(201).json({ ok: true, data: version });
  } catch (err) {
    next(err);
  }
});

export { router as commitmentsRouter };
