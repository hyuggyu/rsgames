CREATE TABLE "ApiClient" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scopes" TEXT[] DEFAULT ARRAY['products:read','balance:read','orders:write','orders:read']::TEXT[],
  "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requestsPerMinute" INTEGER NOT NULL DEFAULT 60,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiRequestLog" (
  "id" TEXT NOT NULL,
  "apiClientId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "ip" TEXT,
  "latencyMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "apiClientId" TEXT;
CREATE UNIQUE INDEX "ApiClient_keyPrefix_key" ON "ApiClient"("keyPrefix");
CREATE INDEX "ApiClient_userId_active_idx" ON "ApiClient"("userId", "active");
CREATE INDEX "ApiRequestLog_apiClientId_createdAt_idx" ON "ApiRequestLog"("apiClientId", "createdAt");
CREATE INDEX "ApiRequestLog_createdAt_idx" ON "ApiRequestLog"("createdAt");
CREATE INDEX "Order_apiClientId_createdAt_idx" ON "Order"("apiClientId", "createdAt");

ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "ApiClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "ApiClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
