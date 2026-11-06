ALTER TABLE "User" ADD COLUMN "agentCommissionRate" DECIMAL(5,2);

CREATE TABLE "WithdrawalMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "fields" JSONB NOT NULL,
    "minAmount" DECIMAL(18,6) NOT NULL DEFAULT 5,
    "maxAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WithdrawalMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentWithdrawal" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "grossAmount" DECIMAL(18,6) NOT NULL,
    "feeAmount" DECIMAL(18,6) NOT NULL,
    "netAmount" DECIMAL(18,6) NOT NULL,
    "pointsHeld" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "payoutData" JSONB NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WithdrawalMethod_slug_key" ON "WithdrawalMethod"("slug");
CREATE INDEX "WithdrawalMethod_active_sortOrder_idx" ON "WithdrawalMethod"("active", "sortOrder");
CREATE UNIQUE INDEX "AgentWithdrawal_requestNumber_key" ON "AgentWithdrawal"("requestNumber");
CREATE INDEX "AgentWithdrawal_userId_createdAt_idx" ON "AgentWithdrawal"("userId", "createdAt");
CREATE INDEX "AgentWithdrawal_status_createdAt_idx" ON "AgentWithdrawal"("status", "createdAt");
ALTER TABLE "AgentWithdrawal" ADD CONSTRAINT "AgentWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentWithdrawal" ADD CONSTRAINT "AgentWithdrawal_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "WithdrawalMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
