import { PDFParse } from "pdf-parse";

/** Keeps a single doc's contribution to the AI node's system prompt bounded — several of these
 * can stack for one node, and that prompt still has to leave room for persona guard, conversation
 * history, and the actual reply within the model's context. ~30k tokens per doc is generous
 * headroom for a "knowledge base excerpt" without one huge upload dominating the whole prompt. */
export const MAX_EXTRACTED_CHARS = 120_000;

const SUPPORTED_EXTENSIONS = ["txt", "md", "pdf"] as const;

export class UnsupportedFileTypeError extends Error {
  constructor(fileName: string) {
    super(`Unsupported file type for "${fileName}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.`);
    this.name = "UnsupportedFileTypeError";
  }
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function truncate(text: string): string {
  return text.length > MAX_EXTRACTED_CHARS ? `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[…truncated]` : text;
}

/** Extracts plain text from an uploaded knowledge-base file so it can be injected into an AI
 * node's system prompt. Throws UnsupportedFileTypeError for anything outside txt/md/pdf. */
export async function extractText(fileName: string, buffer: Buffer): Promise<string> {
  const ext = extensionOf(fileName);

  if (ext === "txt" || ext === "md") {
    return truncate(buffer.toString("utf-8").trim());
  }

  if (ext === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return truncate(result.text.trim());
    } finally {
      await parser.destroy();
    }
  }

  throw new UnsupportedFileTypeError(fileName);
}
