import { Router, type IRouter, type Request, type Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/requireAuth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  uploadDocumentSchema,
  reviewExtractionSchema,
  importExtractionSchema,
} from './documents.schemas.js';
import * as service from './documents.service.js';

const router: IRouter = Router();
router.use(requireAuth);

// ─── Multer setup ─────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, `Unsupported file type: ${file.mimetype}`, 'UNSUPPORTED_FILE_TYPE') as unknown as null, false);
    }
  },
});

/** Wrap multer in a promise so it plays nicely with Express 5 async handlers */
function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const documents = await service.listDocuments(req.session.user!.id);
    res.json({ ok: true, data: documents });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    await runUpload(req, res);

    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded', 'NO_FILE');

    const body = uploadDocumentSchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError(400, 'Missing or invalid document type', 'VALIDATION_ERROR');
    }

    const result = await service.uploadDocument(
      req.session.user!.id,
      file.buffer,
      file.originalname,
      file.mimetype,
      body.data.type,
    );

    res.status(result.isDuplicate ? 200 : 201).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
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

// Import confirmed items from an approved extraction into canonical finance tables.
router.post('/:id/extractions/:extractionId/import', async (req, res, next) => {
  try {
    const body = importExtractionSchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError(400, 'Validation error', 'VALIDATION_ERROR');
    }
    const results = await service.importExtraction(
      req.session.user!.id,
      req.params['id']!,
      req.params['extractionId']!,
      body.data.items,
    );
    res.status(201).json({ ok: true, data: results });
  } catch (err) {
    next(err);
  }
});

export { router as documentsRouter };
