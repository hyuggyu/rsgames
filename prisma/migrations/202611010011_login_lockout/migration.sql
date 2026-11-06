-- Temporary account lock after repeated failed logins
ALTER TABLE "User" ADD COLUMN "failedLogins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
