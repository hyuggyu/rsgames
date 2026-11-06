-- Force a password change on first login (used for the seeded admin account)
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
