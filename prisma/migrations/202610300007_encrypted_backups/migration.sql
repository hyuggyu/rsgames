CREATE TABLE "BackupSnapshot" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "collections" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BackupSnapshot_storageKey_key" ON "BackupSnapshot"("storageKey");
CREATE INDEX "BackupSnapshot_createdAt_idx" ON "BackupSnapshot"("createdAt");
