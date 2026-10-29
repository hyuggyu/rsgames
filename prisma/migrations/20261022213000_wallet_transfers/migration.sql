CREATE TABLE "WalletTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletTransfer_transferNumber_key" ON "WalletTransfer"("transferNumber");
CREATE UNIQUE INDEX "WalletTransfer_idempotencyKey_key" ON "WalletTransfer"("idempotencyKey");
CREATE INDEX "WalletTransfer_fromUserId_createdAt_idx" ON "WalletTransfer"("fromUserId", "createdAt");
CREATE INDEX "WalletTransfer_toUserId_createdAt_idx" ON "WalletTransfer"("toUserId", "createdAt");
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
