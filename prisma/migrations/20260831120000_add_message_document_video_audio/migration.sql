-- AlterEnum
ALTER TYPE "MessageContentType" ADD VALUE 'DOCUMENT';
ALTER TYPE "MessageContentType" ADD VALUE 'VIDEO';
ALTER TYPE "MessageContentType" ADD VALUE 'AUDIO';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "fileName" TEXT;
