/** Keeps a single doc's contribution to the AI node's system prompt bounded — several of these
 * can stack for one node, and that prompt still has to leave room for persona guard, conversation
 * history, and the actual reply within the model's context. ~30k tokens per doc is generous
 * headroom for a "knowledge base excerpt" without one huge upload dominating the whole prompt. */
export const MAX_EXTRACTED_CHARS = 120_000;

const SUPPORTED_EXTENSIONS = ["txt", "md", "pdf", "docx"] as const;

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

async function extractPdfText(fileName: string, buffer: Buffer): Promise<string> {
  // unpdf, not pdf-parse: pdf-parse's pdfjs-dist dependency did top-level work that's been
  // flaky in this app's server-action bundling before (see git history), and it kept failing
  // to read real PDFs in production even after isolating its import. unpdf bundles its own
  // pdf.js build specifically compiled for serverless/edge runtimes and has zero required
  // native dependencies for text extraction (only an *optional* peer for image rendering,
  // which this never touches), which is exactly the class of problem pdf-parse kept hitting
  // here. Still dynamically imported, same reasoning as before: a load failure becomes a
  // catchable rejection instead of crashing whatever called extractText.
  let getDocumentProxy: typeof import("unpdf").getDocumentProxy;
  let unpdfExtractText: typeof import("unpdf").extractText;
  try {
    ({ getDocumentProxy, extractText: unpdfExtractText } = await import("unpdf"));
  } catch (error) {
    console.error("[extract-text] failed to load unpdf", error);
    throw new Error("PDF support is temporarily unavailable — try again shortly, or use a .txt/.md file.");
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await unpdfExtractText(pdf, { mergePages: true });
    return truncate(text.trim());
  } catch (error) {
    console.error("[extract-text] unpdf failed to parse", fileName, error);
    throw new Error(
      "Couldn't extract text from that PDF — it may be corrupted, password-protected, or a scanned image with no embedded text.",
    );
  }
}

async function extractDocxText(fileName: string, buffer: Buffer): Promise<string> {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch (error) {
    console.error("[extract-text] failed to load mammoth", error);
    throw new Error(".docx support is temporarily unavailable — try again shortly, or use a .txt/.md file.");
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    return truncate(result.value.trim());
  } catch (error) {
    console.error("[extract-text] mammoth failed to parse", fileName, error);
    throw new Error(
      "Couldn't extract text from that .docx file — it may be corrupted or password-protected. Note: legacy .doc files aren't supported, only .docx.",
    );
  }
}

/** Extracts plain text from an uploaded knowledge-base file so it can be injected into an AI
 * node's system prompt. Throws UnsupportedFileTypeError for anything outside txt/md/pdf/docx.
 *
 * Both the pdf and docx branches import their library lazily rather than at module scope: a
 * load failure inside a dynamic import is a normal rejected promise this function can catch,
 * whereas a failure during a static top-level import happens before any function body runs at
 * all and can't be caught by a caller. It also means a plain .txt/.md upload never touches
 * either library. */
export async function extractText(fileName: string, buffer: Buffer): Promise<string> {
  const ext = extensionOf(fileName);

  if (ext === "txt" || ext === "md") {
    return truncate(buffer.toString("utf-8").trim());
  }

  if (ext === "pdf") {
    return extractPdfText(fileName, buffer);
  }

  if (ext === "docx") {
    return extractDocxText(fileName, buffer);
  }

  throw new UnsupportedFileTypeError(fileName);
}
