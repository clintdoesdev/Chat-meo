-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notificationsReadAt" TIMESTAMP(3);
