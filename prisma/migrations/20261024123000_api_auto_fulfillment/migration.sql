ALTER TYPE "DeliveryType" ADD VALUE IF NOT EXISTS 'api';
CREATE TYPE "ApiFulfillmentStatus" AS ENUM ('queued', 'sending', 'processing', 'completed', 'failed', 'cancelled');

CREATE TABLE "ApiProvider" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "orderPath" TEXT NOT NULL,
  "statusPath" TEXT,
  "httpMethod" TEXT NOT NULL DEFAULT 'POST',
  "authType" TEXT NOT NULL DEFAULT 'bearer',
  "authName" TEXT,
  "keyCipherText" TEXT NOT NULL,
  "keyIv" TEXT NOT NULL,
  "keyAuthTag" TEXT NOT NULL,
  "requestTemplate" JSONB NOT NULL,
  "externalIdPath" TEXT NOT NULL DEFAULT 'order_id',
  "statusResponsePath" TEXT NOT NULL DEFAULT 'status',
  "successValues" TEXT[] DEFAULT ARRAY['completed','success']::TEXT[],
  "pendingValues" TEXT[] DEFAULT ARRAY['pending','processing']::TEXT[],
  "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiProvider_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductPackage" ADD COLUMN "apiProviderId" TEXT;
ALTER TABLE "ProductPackage" ADD COLUMN "providerCode" TEXT;
ALTER TABLE "ProductPackage" ADD COLUMN "autoFulfill" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ApiFulfillment" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "status" "ApiFulfillmentStatus" NOT NULL DEFAULT 'queued',
  "externalOrderId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "nextCheckAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiFulfillment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiFulfillment_orderItemId_key" ON "ApiFulfillment"("orderItemId");
CREATE INDEX "ApiProvider_active_idx" ON "ApiProvider"("active");
CREATE INDEX "ProductPackage_apiProviderId_idx" ON "ProductPackage"("apiProviderId");
CREATE INDEX "ApiFulfillment_status_nextCheckAt_idx" ON "ApiFulfillment"("status", "nextCheckAt");
CREATE INDEX "ApiFulfillment_providerId_createdAt_idx" ON "ApiFulfillment"("providerId", "createdAt");

ALTER TABLE "ProductPackage" ADD CONSTRAINT "ProductPackage_apiProviderId_fkey" FOREIGN KEY ("apiProviderId") REFERENCES "ApiProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiFulfillment" ADD CONSTRAINT "ApiFulfillment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiFulfillment" ADD CONSTRAINT "ApiFulfillment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ApiProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
