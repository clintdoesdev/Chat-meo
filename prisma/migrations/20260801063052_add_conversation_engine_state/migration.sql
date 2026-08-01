-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "engineState" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "conversations_botId_visitorId_status_idx" ON "conversations"("botId", "visitorId", "status");
