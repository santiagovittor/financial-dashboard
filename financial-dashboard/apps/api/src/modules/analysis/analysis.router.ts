import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import * as service from './analysis.service.js';

const router: IRouter = Router();
router.use(requireAuth);

// GET /analysis
// Returns the stored narrative analysis + staleness info.
// Returns 204 if no analysis has been generated yet.
router.get('/', async (req, res, next) => {
  try {
    const result = await service.getAnalysis(req.session.user!.id);
    if (!result) {
      res.status(204).end();
      return;
    }
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /analysis/dashboard
// Returns deterministic financial data for the analysis page (no AI call).
router.get('/dashboard', async (req, res, next) => {
  try {
    const result = await service.getDashboardData(req.session.user!.id);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /analysis/generate
// Triggers a new Gemini narrative generation and stores the result.
router.post('/generate', async (req, res, next) => {
  try {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new AppError(503, 'GEMINI_API_KEY is not configured — narrative analysis unavailable.', 'GEMINI_NOT_CONFIGURED');
    }
    const result = await service.generateAnalysis(req.session.user!.id);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

export { router as analysisRouter };
