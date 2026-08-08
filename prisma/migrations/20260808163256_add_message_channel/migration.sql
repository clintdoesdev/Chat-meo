-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WEB', 'WHATSAPP');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "channel" "MessageChannel" NOT NULL DEFAULT 'WEB';
