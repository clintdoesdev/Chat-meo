-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "conversation_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_folders_userId_name_key" ON "conversation_folders"("userId", "name");

-- CreateIndex
CREATE INDEX "conversations_folderId_idx" ON "conversations"("folderId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "conversation_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_folders" ADD CONSTRAINT "conversation_folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
