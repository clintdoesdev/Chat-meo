-- CreateEnum
CREATE TYPE "MessageContentType" AS ENUM ('TEXT', 'IMAGE');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "contentType" "MessageContentType" NOT NULL DEFAULT 'TEXT';
