-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD', 'USDT');

-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('FIXED_INSTALLMENT', 'REVOLVING');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringCommitmentType" AS ENUM ('EXPENSE', 'SUBSCRIPTION', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceDocumentType" AS ENUM ('CREDIT_CARD_STATEMENT', 'DEBT_STATEMENT', 'INVOICE', 'CSV_EXPENSES', 'OTHER');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'DOCUMENT_IMPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromCurrency" "Currency" NOT NULL,
    "toCurrency" "Currency" NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_income_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "estimatedOriginal" DECIMAL(15,4) NOT NULL,
    "estimatedCurrency" "Currency" NOT NULL,
    "fxRate" DECIMAL(15,6) NOT NULL,
    "estimatedArs" DECIMAL(15,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_income_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "description" TEXT,
    "originalAmount" DECIMAL(15,4) NOT NULL,
    "originalCurrency" "Currency" NOT NULL,
    "fxRate" DECIMAL(15,6) NOT NULL,
    "arsAmount" DECIMAL(15,4) NOT NULL,
    "fxSnapshotId" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "originalAmount" DECIMAL(15,4) NOT NULL,
    "originalCurrency" "Currency" NOT NULL,
    "fxRate" DECIMAL(15,6) NOT NULL,
    "arsAmount" DECIMAL(15,4) NOT NULL,
    "fxSnapshotId" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "recurringCommitmentId" TEXT,
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_commitments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecurringCommitmentType" NOT NULL DEFAULT 'EXPENSE',
    "categoryId" TEXT,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_commitment_versions" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "originalAmount" DECIMAL(15,4) NOT NULL,
    "originalCurrency" "Currency" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_commitment_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DebtType" NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "originalPrincipal" DECIMAL(15,4) NOT NULL,
    "principalCurrency" "Currency" NOT NULL,
    "fxRate" DECIMAL(15,6) NOT NULL,
    "arsPrincipal" DECIMAL(15,4) NOT NULL,
    "fxSnapshotId" TEXT,
    "openedAt" DATE NOT NULL,
    "dueDate" DATE,
    "interestRateAnnual" DECIMAL(8,4),
    "installmentCount" INTEGER,
    "installmentAmount" DECIMAL(15,4),
    "installmentCurrency" "Currency",
    "creditLimitOriginal" DECIMAL(15,4),
    "currentBalanceOriginal" DECIMAL(15,4) NOT NULL,
    "currentBalanceCurrency" "Currency" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_payments" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "originalAmount" DECIMAL(15,4) NOT NULL,
    "originalCurrency" "Currency" NOT NULL,
    "fxRate" DECIMAL(15,6) NOT NULL,
    "arsAmount" DECIMAL(15,4) NOT NULL,
    "fxSnapshotId" TEXT,
    "isMinimumPayment" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_schedule_items" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "expectedAmount" DECIMAL(15,4) NOT NULL,
    "expectedCurrency" "Currency" NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetArs" DECIMAL(15,4) NOT NULL,
    "currentArs" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "targetDate" DATE,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "type" "SourceDocumentType" NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "rawExtractedJson" JSONB,
    "extractedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_reviews" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "exchange_rate_snapshots_userId_effectiveDate_idx" ON "exchange_rate_snapshots"("userId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_snapshots_userId_fromCurrency_toCurrency_effe_key" ON "exchange_rate_snapshots"("userId", "fromCurrency", "toCurrency", "effectiveDate");

-- CreateIndex
CREATE INDEX "monthly_income_plans_userId_year_month_idx" ON "monthly_income_plans"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_income_plans_userId_year_month_key" ON "monthly_income_plans"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "income_entries_userId_entryDate_idx" ON "income_entries"("userId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_userId_name_key" ON "expense_categories"("userId", "name");

-- CreateIndex
CREATE INDEX "expense_entries_userId_entryDate_idx" ON "expense_entries"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "expense_entries_userId_categoryId_idx" ON "expense_entries"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "recurring_commitments_userId_isActive_idx" ON "recurring_commitments"("userId", "isActive");

-- CreateIndex
CREATE INDEX "recurring_commitment_versions_commitmentId_effectiveFrom_idx" ON "recurring_commitment_versions"("commitmentId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_commitment_versions_commitmentId_effectiveFrom_key" ON "recurring_commitment_versions"("commitmentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "debts_userId_status_idx" ON "debts"("userId", "status");

-- CreateIndex
CREATE INDEX "debt_payments_debtId_paymentDate_idx" ON "debt_payments"("debtId", "paymentDate");

-- CreateIndex
CREATE INDEX "debt_payments_userId_paymentDate_idx" ON "debt_payments"("userId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "debt_schedule_items_paymentId_key" ON "debt_schedule_items"("paymentId");

-- CreateIndex
CREATE INDEX "debt_schedule_items_debtId_isPaid_idx" ON "debt_schedule_items"("debtId", "isPaid");

-- CreateIndex
CREATE UNIQUE INDEX "debt_schedule_items_debtId_installmentNumber_key" ON "debt_schedule_items"("debtId", "installmentNumber");

-- CreateIndex
CREATE INDEX "goals_userId_isCompleted_idx" ON "goals"("userId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "risk_settings_userId_key_key" ON "risk_settings"("userId", "key");

-- CreateIndex
CREATE INDEX "source_documents_userId_uploadedAt_idx" ON "source_documents"("userId", "uploadedAt");

-- CreateIndex
CREATE INDEX "document_extractions_documentId_idx" ON "document_extractions"("documentId");

-- CreateIndex
CREATE INDEX "document_extractions_userId_status_idx" ON "document_extractions"("userId", "status");

-- CreateIndex
CREATE INDEX "extraction_reviews_extractionId_idx" ON "extraction_reviews"("extractionId");

-- AddForeignKey
ALTER TABLE "exchange_rate_snapshots" ADD CONSTRAINT "exchange_rate_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_income_plans" ADD CONSTRAINT "monthly_income_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_recurringCommitmentId_fkey" FOREIGN KEY ("recurringCommitmentId") REFERENCES "recurring_commitments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_commitments" ADD CONSTRAINT "recurring_commitments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_commitments" ADD CONSTRAINT "recurring_commitments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_commitment_versions" ADD CONSTRAINT "recurring_commitment_versions_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "recurring_commitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_schedule_items" ADD CONSTRAINT "debt_schedule_items_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_schedule_items" ADD CONSTRAINT "debt_schedule_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "debt_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_settings" ADD CONSTRAINT "risk_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_reviews" ADD CONSTRAINT "extraction_reviews_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "document_extractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
