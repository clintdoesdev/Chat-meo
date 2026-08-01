import { describe, expect, it } from "vitest";
import { extractText, MAX_EXTRACTED_CHARS, UnsupportedFileTypeError } from "./extract-text";

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
});
