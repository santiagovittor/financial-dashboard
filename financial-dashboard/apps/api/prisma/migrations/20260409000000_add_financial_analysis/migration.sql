-- CreateTable
CREATE TABLE "financial_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coversPeriod" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_analyses_userId_key" ON "financial_analyses"("userId");

-- AddForeignKey
ALTER TABLE "financial_analyses" ADD CONSTRAINT "financial_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
