ALTER TABLE "ProductPackage" ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "ProductPackage" ADD COLUMN "lowStockAlertedAt" TIMESTAMP(3);
CREATE INDEX "ProductPackage_deliveryType_active_idx" ON "ProductPackage"("deliveryType", "active");
