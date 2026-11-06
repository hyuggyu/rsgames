CREATE TABLE "DeliveryRevealChallenge" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryRevealChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderSecretAccess" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderSecretAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryRevealChallenge_tokenHash_key" ON "DeliveryRevealChallenge"("tokenHash");
CREATE INDEX "DeliveryRevealChallenge_userId_orderId_expiresAt_idx" ON "DeliveryRevealChallenge"("userId", "orderId", "expiresAt");
CREATE INDEX "DeliveryRevealChallenge_expiresAt_consumedAt_idx" ON "DeliveryRevealChallenge"("expiresAt", "consumedAt");
CREATE INDEX "OrderSecretAccess_orderId_createdAt_idx" ON "OrderSecretAccess"("orderId", "createdAt");
CREATE INDEX "OrderSecretAccess_userId_createdAt_idx" ON "OrderSecretAccess"("userId", "createdAt");
ALTER TABLE "DeliveryRevealChallenge" ADD CONSTRAINT "DeliveryRevealChallenge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryRevealChallenge" ADD CONSTRAINT "DeliveryRevealChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderSecretAccess" ADD CONSTRAINT "OrderSecretAccess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderSecretAccess" ADD CONSTRAINT "OrderSecretAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
