ALTER TABLE "Order" ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'low';
ALTER TABLE "Order" ADD COLUMN "riskReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Order_riskLevel_createdAt_idx" ON "Order"("riskLevel", "createdAt");
