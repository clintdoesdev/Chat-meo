-- CreateTable
CREATE TABLE "ai_node_documents" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_node_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_node_documents_flowId_nodeId_idx" ON "ai_node_documents"("flowId", "nodeId");

-- AddForeignKey
ALTER TABLE "ai_node_documents" ADD CONSTRAINT "ai_node_documents_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
