import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { reviewExtractionSchema } from './documents.schemas.js';
import * as service from './documents.service.js';

const router: IRouter = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const documents = await service.listDocuments(req.session.user!.id);
    res.json({ ok: true, data: documents });
  } catch (err) {
    next(err);
  }
});

// Document upload endpoint — returns 501 until storage and parsing pipeline is wired.
// When implemented: validate MIME type against ALLOWED_MIME_TYPES, enforce
// MAX_UPLOAD_BYTES, compute SHA-256 checksum before storing, never store to a
// user-controlled path.
router.post('/', (_req, res) => {
  res.status(501).json({
    ok: false,
    error: { message: 'Document upload not yet implemented', code: 'NOT_IMPLEMENTED' },
  });
});

router.get('/:id/extractions', async (req, res, next) => {
  try {
    const extractions = await service.getExtractions(req.session.user!.id, req.params['id']!);
    res.json({ ok: true, data: extractions });
  } catch (err) {
    next(err);
  }
});

// Review an extraction. Approving does NOT auto-import data into canonical tables.
router.post('/:id/extractions/:extractionId/review', async (req, res, next) => {
  try {
    const body = reviewExtractionSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    const review = await service.reviewExtraction(
      req.session.user!.id,
      req.params['extractionId']!,
      body.data.status,
      body.data.notes,
    );
    res.status(201).json({ ok: true, data: review });
  } catch (err) {
    next(err);
  }
});

export { router as documentsRouter };
