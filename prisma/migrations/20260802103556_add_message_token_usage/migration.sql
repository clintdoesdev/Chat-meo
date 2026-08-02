-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "promptTokens" INTEGER;
