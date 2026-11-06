ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
