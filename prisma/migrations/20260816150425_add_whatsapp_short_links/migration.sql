-- CreateTable
CREATE TABLE "whatsapp_short_links" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_short_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_short_links_slug_key" ON "whatsapp_short_links"("slug");

-- CreateIndex
CREATE INDEX "whatsapp_short_links_botId_idx" ON "whatsapp_short_links"("botId");

-- AddForeignKey
ALTER TABLE "whatsapp_short_links" ADD CONSTRAINT "whatsapp_short_links_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
