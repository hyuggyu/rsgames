CREATE TABLE "OrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "source" TEXT NOT NULL DEFAULT 'system',
  "eventKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderEvent_orderId_eventKey_key" ON "OrderEvent"("orderId", "eventKey");
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");
CREATE INDEX "OrderEvent_status_createdAt_idx" ON "OrderEvent"("status", "createdAt");
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
