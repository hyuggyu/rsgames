ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "LoginChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "ip" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoginChallenge_tokenHash_key" ON "LoginChallenge"("tokenHash");
CREATE INDEX "LoginChallenge_userId_expiresAt_idx" ON "LoginChallenge"("userId", "expiresAt");
CREATE INDEX "LoginChallenge_expiresAt_consumedAt_idx" ON "LoginChallenge"("expiresAt", "consumedAt");
ALTER TABLE "LoginChallenge" ADD CONSTRAINT "LoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
