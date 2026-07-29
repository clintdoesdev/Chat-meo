-- CreateEnum
CREATE TYPE "TwoFactorMethod" AS ENUM ('EMAIL', 'TOTP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "twoFactorMethod" "TwoFactorMethod";

-- Backfill: all pre-existing 2FA users were email-based before this migration.
UPDATE "users" SET "twoFactorMethod" = 'EMAIL' WHERE "twoFactorEnabled" = true;
