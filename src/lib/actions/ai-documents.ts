"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { extractText, UnsupportedFileTypeError } from "@/lib/documents/extract-text";
import { prisma } from "@/lib/prisma";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type AiNodeDocumentSummary = {
  id: string;
  fileName: string;
  charCount: number;
  createdAt: string;
};

async function requireFlowOwnership(flowId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { id: true, bot: { select: { userId: true, slug: true } } },
  });
  if (!flow || flow.bot.userId !== session.user.id) return null;

  return { botSlug: flow.bot.slug };
}

export async function listAiNodeDocuments(
  flowId: string,
  nodeId: string,
): Promise<AiNodeDocumentSummary[]> {
  const owned = await requireFlowOwnership(flowId);
  if (!owned) return [];

  const docs = await prisma.aiNodeDocument.findMany({
    where: { flowId, nodeId },
    select: { id: true, fileName: true, charCount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return docs.map((doc) => ({ ...doc, createdAt: doc.createdAt.toISOString() }));
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

  const owned = await requireFlowOwnership(flowId);
  if (!owned) return { error: "Flow not found." };

  const buffer = Buffer.from(await file.arrayBuffer());

  let content: string;
  try {
    content = await extractText(file.name, buffer);
  } catch (error) {
    if (error instanceof UnsupportedFileTypeError) return { error: error.message };
    return { error: "Couldn't read that file." };
  }

  if (!content) return { error: "That file doesn't contain any readable text." };

  const doc = await prisma.aiNodeDocument.create({
    data: { flowId, nodeId, fileName: file.name, content, charCount: content.length },
    select: { id: true, fileName: true, charCount: true, createdAt: true },
  });

  revalidatePath(`/app/studio/${owned.botSlug}`);
  return { error: null, document: { ...doc, createdAt: doc.createdAt.toISOString() } };
}

export async function deleteAiNodeDocument(documentId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const doc = await prisma.aiNodeDocument.findUnique({
    where: { id: documentId },
    select: { flowId: true, flow: { select: { bot: { select: { userId: true, slug: true } } } } },
  });
  if (!doc || doc.flow.bot.userId !== session.user.id) return { error: "Document not found." };

  await prisma.aiNodeDocument.delete({ where: { id: documentId } });

  revalidatePath(`/app/studio/${doc.flow.bot.slug}`);
  return { error: null };
}
