import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  createExpenseCategorySchema,
  createExpenseEntrySchema,
  listExpenseEntriesQuerySchema,
} from './expenses.schemas.js';
import * as service from './expenses.service.js';

const router: IRouter = Router();
router.use(requireAuth);

// Categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await service.listCategories(req.session.user!.id);
    res.json({ ok: true, data: categories });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const body = createExpenseCategorySchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const category = await service.createCategory({ ...body.data, userId: req.session.user!.id });
    res.status(201).json({ ok: true, data: category });
  } catch (err) {
    next(err);
  }
});

// Entries
router.get('/entries', async (req, res, next) => {
  try {
    const query = listExpenseEntriesQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const entries = await service.listEntries(req.session.user!.id, query.data);
    res.json({ ok: true, data: entries });
  } catch (err) {
    next(err);
  }
});

router.post('/entries', async (req, res, next) => {
  try {
    const body = createExpenseEntrySchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const entry = await service.createEntry({ ...body.data, userId: req.session.user!.id });
    res.status(201).json({ ok: true, data: entry });
  } catch (err) {
    next(err);
  }
});

export { router as expensesRouter };
