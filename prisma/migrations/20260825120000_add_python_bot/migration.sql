-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "pythonState" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "python_bots" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "python_bots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "python_bots_botId_key" ON "python_bots"("botId");

-- AddForeignKey
ALTER TABLE "python_bots" ADD CONSTRAINT "python_bots_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
