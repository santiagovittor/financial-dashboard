import { Router, type IRouter } from 'express';
import { prisma } from '../../lib/prisma.js';

const router: IRouter = Router();

router.get('/', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      data: {
        status: 'ok',
        db: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    next(new Error('Database connection failed'));
  }
});

export { router as healthRouter };
