import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { createExchangeRateSnapshotSchema } from '@fin/shared';
import { prisma } from '../../lib/prisma.js';

const router: IRouter = Router();
router.use(requireAuth);

// List all stored FX snapshots, most recent first
router.get('/', async (req, res, next) => {
  try {
    const snapshots = await prisma.exchangeRateSnapshot.findMany({
      where: { userId: req.session.user!.id },
      orderBy: { effectiveDate: 'desc' },
    });
    res.json({ ok: true, data: snapshots });
  } catch (err) {
    next(err);
  }
});

// Latest rate for each currency pair
router.get('/latest', async (req, res, next) => {
  try {
    const userId = req.session.user!.id;
    // Fetch the most recent snapshot per fromCurrency
    const snapshots = await prisma.exchangeRateSnapshot.findMany({
      where: { userId, toCurrency: 'ARS' },
      orderBy: { effectiveDate: 'desc' },
      distinct: ['fromCurrency'],
    });
    res.json({ ok: true, data: snapshots });
  } catch (err) {
    next(err);
  }
});

// Record a new manual planning rate
router.post('/', async (req, res, next) => {
  try {
    const body = createExchangeRateSnapshotSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const snapshot = await prisma.exchangeRateSnapshot.upsert({
      where: {
        userId_fromCurrency_toCurrency_effectiveDate: {
          userId: req.session.user!.id,
          fromCurrency: body.data.fromCurrency,
          toCurrency: 'ARS',
          effectiveDate: new Date(body.data.effectiveDate),
        },
      },
      update: { rate: body.data.rate, notes: body.data.notes ?? null },
      create: {
        userId: req.session.user!.id,
        fromCurrency: body.data.fromCurrency,
        toCurrency: 'ARS',
        rate: body.data.rate,
        effectiveDate: new Date(body.data.effectiveDate),
        isManual: true,
        notes: body.data.notes ?? null,
      },
    });
    res.status(201).json({ ok: true, data: snapshot });
  } catch (err) {
    next(err);
  }
});

export { router as rateRouter };
