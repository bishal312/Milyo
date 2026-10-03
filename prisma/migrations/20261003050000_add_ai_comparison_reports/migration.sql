CREATE TYPE "AIComparisonStatus" AS ENUM ('PENDING', 'MATCH', 'NO_MATCH', 'FAILED');

CREATE TABLE "AIComparisonReport" (
    "id" TEXT NOT NULL,
    "lostItemId" TEXT NOT NULL,
    "foundItemId" TEXT NOT NULL,
    "status" "AIComparisonStatus" NOT NULL DEFAULT 'PENDING',
    "score" DOUBLE PRECISION,
    "confidenceLevel" TEXT,
    "reasoning" TEXT,
    "keyMatchingFeatures" JSONB,
    "discrepancies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIComparisonReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIComparisonReport_lostItemId_foundItemId_key"
ON "AIComparisonReport"("lostItemId", "foundItemId");

CREATE INDEX "AIComparisonReport_createdAt_idx"
ON "AIComparisonReport"("createdAt");

ALTER TABLE "AIComparisonReport"
ADD CONSTRAINT "AIComparisonReport_lostItemId_fkey"
FOREIGN KEY ("lostItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIComparisonReport"
ADD CONSTRAINT "AIComparisonReport_foundItemId_fkey"
FOREIGN KEY ("foundItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
