import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { env } from '../../config/env.js';
import { extractDocument } from './extraction/index.js';
import type { ImportItem } from './documents.schemas.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function storeFile(
  userId: string,
  buffer: Buffer,
  originalName: string,
): Promise<{ storagePath: string; checksum: string; sizeBytes: number }> {
  const checksum = createHash('sha256').update(buffer).digest('hex');
  const ext = extname(originalName) || '.bin';
  const dir = join(env.UPLOADS_DIR, userId);
  await mkdir(dir, { recursive: true });
  const storagePath = join(dir, `${checksum}${ext}`);
  await writeFile(storagePath, buffer);
  return { storagePath, checksum, sizeBytes: buffer.length };
}

// ─── Public service functions ─────────────────────────────────────────────────

export async function listDocuments(userId: string) {
  return prisma.sourceDocument.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      type: true,
      checksum: true,
      uploadedAt: true,
      // storagePath intentionally excluded from list responses
      extractions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          extractedAt: true,
          createdAt: true,
          reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
  });
}

export async function uploadDocument(
  userId: string,
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  docType: string,
) {
  // Deduplication: if the same user already uploaded this file, return existing doc
  const checksum = createHash('sha256').update(buffer).digest('hex');
  const existing = await prisma.sourceDocument.findFirst({
    where: { userId, checksum },
    include: { extractions: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (existing) return { document: existing, isDuplicate: true };

  // Store file on disk
  const { storagePath, sizeBytes } = await storeFile(userId, buffer, originalFilename);

  // Run extraction synchronously (heuristic — fast enough for MVP)
  const payload = await extractDocument(buffer, mimeType, docType);

  // Persist everything in a transaction
  const [document, extraction] = await prisma.$transaction(async (tx) => {
    const doc = await tx.sourceDocument.create({
      data: {
        userId,
        originalFilename,
        mimeType,
        storagePath,
        sizeBytes,
        type: docType as Parameters<typeof tx.sourceDocument.create>[0]['data']['type'],
        checksum,
      },
    });

    const ext = await tx.documentExtraction.create({
      data: {
        documentId: doc.id,
        userId,
        status: 'COMPLETED',
        rawExtractedJson: payload as object,
        extractedAt: new Date(),
      },
    });

    return [doc, ext] as const;
  });

  return { document, extraction, payload, isDuplicate: false };
}

export async function getExtractions(userId: string, documentId: string) {
  const doc = await prisma.sourceDocument.findFirst({ where: { id: documentId, userId } });
  if (!doc) throw new AppError(404, 'Document not found');
  return prisma.documentExtraction.findMany({
    where: { documentId },
    include: { reviews: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Submit a review decision for an extraction.
 *
 * IMPORTANT: Approving an extraction does NOT automatically create canonical
 * finance records. The UI must prompt the user to confirm each extracted item
 * individually before it affects income/expense/debt tables. This function
 * only records the review decision.
 */
export async function reviewExtraction(
  userId: string,
  extractionId: string,
  status: 'APPROVED' | 'REJECTED',
  notes?: string,
) {
  const extraction = await prisma.documentExtraction.findFirst({
    where: { id: extractionId, userId },
  });
  if (!extraction) throw new AppError(404, 'Extraction not found');

  return prisma.extractionReview.create({
    data: { extractionId, status, notes: notes ?? null, reviewedAt: new Date() },
  });
}

/**
 * Create canonical finance records from an approved extraction.
 *
 * Requires an APPROVED ExtractionReview to exist — call reviewExtraction first.
 * Each item in `items` creates one IncomeEntry or ExpenseEntry with:
 *   - source: DOCUMENT_IMPORT
 *   - sourceDocumentId: the document's id
 * so the dashboard picks it up automatically.
 */
export async function importExtraction(
  userId: string,
  documentId: string,
  extractionId: string,
  items: ImportItem[],
) {
  // Verify document belongs to user
  const doc = await prisma.sourceDocument.findFirst({ where: { id: documentId, userId } });
  if (!doc) throw new AppError(404, 'Document not found');

  // Verify extraction exists and belongs to user
  const extraction = await prisma.documentExtraction.findFirst({
    where: { id: extractionId, userId },
    include: { reviews: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!extraction) throw new AppError(404, 'Extraction not found');

  // Require an APPROVED review
  const latestReview = extraction.reviews[0];
  if (!latestReview || latestReview.status !== 'APPROVED') {
    throw new AppError(422, 'Extraction must be APPROVED before importing', 'REVIEW_REQUIRED');
  }

  // Create canonical records
  const results = await prisma.$transaction(async (tx) => {
    const created: Array<{ type: string; id: string }> = [];

    for (const item of items) {
      if (item.type === 'INCOME_ENTRY') {
        const entry = await tx.incomeEntry.create({
          data: {
            userId,
            entryDate: new Date(item.entryDate),
            description: item.description ?? null,
            originalAmount: item.originalAmount,
            originalCurrency: item.originalCurrency,
            fxRate: item.fxRate,
            arsAmount: item.arsAmount,
            fxSnapshotId: item.fxSnapshotId ?? null,
            source: 'DOCUMENT_IMPORT',
            sourceDocumentId: documentId,
          },
        });
        created.push({ type: 'INCOME_ENTRY', id: entry.id });
      } else {
        const entry = await tx.expenseEntry.create({
          data: {
            userId,
            entryDate: new Date(item.entryDate),
            description: item.description ?? null,
            categoryId: item.categoryId ?? null,
            originalAmount: item.originalAmount,
            originalCurrency: item.originalCurrency,
            fxRate: item.fxRate,
            arsAmount: item.arsAmount,
            fxSnapshotId: item.fxSnapshotId ?? null,
            source: 'DOCUMENT_IMPORT',
            sourceDocumentId: documentId,
          },
        });
        created.push({ type: 'EXPENSE_ENTRY', id: entry.id });
      }
    }

    return created;
  });

  return results;
}
