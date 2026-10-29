CREATE TYPE "PubgSaleStatus" AS ENUM ('pending', 'needs_info', 'priced', 'accepted', 'inspecting', 'completed', 'rejected', 'cancelled');

CREATE TABLE "PubgSaleRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "accountRegion" TEXT NOT NULL,
    "accountLevel" INTEGER,
    "linkingMethods" TEXT[],
    "skinsCount" INTEGER,
    "upgradedWeapons" INTEGER,
    "requestedPrice" DECIMAL(18,2) NOT NULL,
    "offeredPrice" DECIMAL(18,2),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "description" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "status" "PubgSaleStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "userNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PubgSaleRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PubgSaleRequest_requestNumber_key" ON "PubgSaleRequest"("requestNumber");
CREATE INDEX "PubgSaleRequest_userId_createdAt_idx" ON "PubgSaleRequest"("userId", "createdAt");
CREATE INDEX "PubgSaleRequest_status_createdAt_idx" ON "PubgSaleRequest"("status", "createdAt");
ALTER TABLE "PubgSaleRequest" ADD CONSTRAINT "PubgSaleRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PubgSaleRequest" ADD CONSTRAINT "PubgSaleRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
