"use server";

import { auth } from "@/auth";
import { extractText } from "@/lib/documents/extract-text";
import { prisma } from "@/lib/prisma";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type AiNodeDocumentSummary = {
  id: string;
  fileName: string;
  charCount: number;
  createdAt: string;
};

async function isFlowOwner(flowId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { bot: { select: { userId: true } } },
  });
  return Boolean(flow && flow.bot.userId === session.user.id);
}

export async function listAiNodeDocuments(
  flowId: string,
  nodeId: string,
): Promise<AiNodeDocumentSummary[]> {
  try {
    if (!(await isFlowOwner(flowId))) return [];

    const docs = await prisma.aiNodeDocument.findMany({
      where: { flowId, nodeId },
      select: { id: true, fileName: true, charCount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return docs.map((doc) => ({ ...doc, createdAt: doc.createdAt.toISOString() }));
  } catch (error) {
    console.error("[actions/ai-documents] listAiNodeDocuments failed", error);
    return [];
  }
}

export async function uploadAiNodeDocument(
  formData: FormData,
): Promise<{ error: string | null; document?: AiNodeDocumentSummary }> {
  const flowId = String(formData.get("flowId") ?? "");
  const nodeId = String(formData.get("nodeId") ?? "");
  const file = formData.get("file");

  if (!flowId || !nodeId || !(file instanceof File)) {
    return { error: "Missing file." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File is too large (max 10MB)." };
  }

  try {
    if (!(await isFlowOwner(flowId))) return { error: "Flow not found." };

    const buffer = Buffer.from(await file.arrayBuffer());

    let content: string;
    try {
      content = await extractText(file.name, buffer);
    } catch (error) {
      // extractText only ever throws curated, user-safe messages (UnsupportedFileTypeError, or a
      // plain Error it constructed itself for a load/parse failure) — safe to show verbatim,
      // unlike an arbitrary caught exception elsewhere in this function.
      if (error instanceof Error) return { error: error.message };
      return { error: "Couldn't read that file." };
    }

    if (!content) return { error: "That file doesn't contain any readable text." };

    const doc = await prisma.aiNodeDocument.create({
      data: { flowId, nodeId, fileName: file.name, content, charCount: content.length },
      select: { id: true, fileName: true, charCount: true, createdAt: true },
    });

    return { error: null, document: { ...doc, createdAt: doc.createdAt.toISOString() } };
  } catch (error) {
    console.error("[actions/ai-documents] uploadAiNodeDocument failed", error);
    return { error: "Upload failed — a temporary connection issue. Please try again." };
  }
}

export async function deleteAiNodeDocument(documentId: string): Promise<{ error: string | null }> {
  try {
    const session = await auth();
    if (!session?.user) return { error: "Not signed in." };

    const doc = await prisma.aiNodeDocument.findUnique({
      where: { id: documentId },
      select: { flow: { select: { bot: { select: { userId: true } } } } },
    });
    if (!doc || doc.flow.bot.userId !== session.user.id) return { error: "Document not found." };

    await prisma.aiNodeDocument.delete({ where: { id: documentId } });
    return { error: null };
  } catch (error) {
    console.error("[actions/ai-documents] deleteAiNodeDocument failed", error);
    return { error: "Couldn't remove that document — please try again." };
  }
}
