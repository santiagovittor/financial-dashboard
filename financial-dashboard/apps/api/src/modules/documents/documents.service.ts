import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';

export async function listDocuments(userId: string) {
  return prisma.sourceDocument.findMany({
    where: { userId },
    include: { extractions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { uploadedAt: 'desc' },
  });
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
  // Verify the extraction belongs to this user's document
  const extraction = await prisma.documentExtraction.findFirst({
    where: { id: extractionId, userId },
  });
  if (!extraction) throw new AppError(404, 'Extraction not found');

  return prisma.extractionReview.create({
    data: { extractionId, status, notes: notes ?? null, reviewedAt: new Date() },
  });
}
