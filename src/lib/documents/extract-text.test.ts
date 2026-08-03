import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractText, MAX_EXTRACTED_CHARS, UnsupportedFileTypeError } from "./extract-text";

/** Builds a minimal, valid single-page PDF (no external deps) containing one line of text, for
 * exercising the real pdf branch of extractText end to end instead of mocking the pdf library. */
function buildTestPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 72 712 Td (${text}) Tj ET`;
  const objects = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 5 0 R>>>>/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj",
    `4 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${obj}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

/** Builds a minimal, valid .docx (a zip archive with the OOXML parts Word/mammoth expect)
 * containing one paragraph of text. */
async function buildTestDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("extractText", () => {
  it("reads a .txt file as UTF-8 text", async () => {
    const text = await extractText("policy.txt", Buffer.from("Refunds within 30 days.", "utf-8"));
    expect(text).toBe("Refunds within 30 days.");
  });

  it("reads a .md file the same way as .txt", async () => {
    const text = await extractText("faq.md", Buffer.from("# FAQ\n\nWe ship worldwide.", "utf-8"));
    expect(text).toBe("# FAQ\n\nWe ship worldwide.");
  });

  it("trims surrounding whitespace", async () => {
    const text = await extractText("note.txt", Buffer.from("  \n hello \n  ", "utf-8"));
    expect(text).toBe("hello");
  });

  it("truncates content past the max length instead of blowing up the prompt", async () => {
    const huge = "a".repeat(MAX_EXTRACTED_CHARS + 5_000);
    const text = await extractText("huge.txt", Buffer.from(huge, "utf-8"));
    expect(text.length).toBeLessThan(huge.length);
    expect(text.endsWith("[…truncated]")).toBe(true);
  });

  it("rejects unsupported file types instead of silently returning garbage", async () => {
    await expect(extractText("archive.zip", Buffer.from("PK"))).rejects.toBeInstanceOf(
      UnsupportedFileTypeError,
    );
  });

  it("is case-insensitive about the extension", async () => {
    const text = await extractText("NOTES.TXT", Buffer.from("hi", "utf-8"));
    expect(text).toBe("hi");
  });

  it("extracts text from a real .pdf via unpdf", async () => {
    const pdf = buildTestPdf("Refunds within 30 days.");
    const text = await extractText("policy.pdf", pdf);
    expect(text).toContain("Refunds within 30 days.");
  });

  it("rejects a corrupted .pdf with a clear, user-facing message", async () => {
    await expect(extractText("broken.pdf", Buffer.from("not actually a pdf"))).rejects.toThrow(
      /Couldn't extract text from that PDF/,
    );
  });

  it("extracts text from a real .docx via mammoth", async () => {
    const docx = await buildTestDocx("We ship worldwide within 5 business days.");
    const text = await extractText("shipping.docx", docx);
    expect(text).toContain("We ship worldwide within 5 business days.");
  });

  it("rejects a corrupted .docx with a clear, user-facing message", async () => {
    await expect(extractText("broken.docx", Buffer.from("not actually a docx"))).rejects.toThrow(
      /Couldn't extract text from that \.docx file/,
    );
  });
});
