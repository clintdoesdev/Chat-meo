-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "waMessageId" TEXT,
ADD COLUMN     "replyToId" TEXT,
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
