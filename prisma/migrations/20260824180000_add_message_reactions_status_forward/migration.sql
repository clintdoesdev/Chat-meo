-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "customerReaction" TEXT,
ADD COLUMN     "agentReaction" TEXT,
ADD COLUMN     "deliveryStatus" "MessageDeliveryStatus",
ADD COLUMN     "forwarded" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "messages_waMessageId_idx" ON "messages"("waMessageId");

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false;
