import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatMessage } from "./format-message";

function render(text: string, linkClassName?: string): string {
  return renderToStaticMarkup(<>{formatMessage(text, linkClassName)}</>);
}

describe("formatMessage", () => {
  it("renders plain text unchanged", () => {
    expect(render("Just a normal reply.")).toBe("Just a normal reply.");
  });

  it("renders **bold** as <strong>, with no leftover asterisks", () => {
    const html = render("This is **very** important.");
    expect(html).toContain("<strong>very</strong>");
    expect(html).not.toContain("*");
  });

  it("renders *italic* as <em>, with no leftover asterisks", () => {
    const html = render("This is *slightly* urgent.");
    expect(html).toContain("<em>slightly</em>");
    expect(html).not.toContain("*");
  });

  it("renders __bold__ and _italic_ underscore variants too", () => {
    const html = render("__Bold__ and _italic_ underscores.");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders ***bold italic*** as nested <strong><em>", () => {
    const html = render("Truly ***critical*** news.");
    expect(html).toContain("<strong><em>critical</em></strong>");
  });

  it("renders `code` as <code>", () => {
    const html = render("Run `npm install` first.");
    expect(html).toContain("<code");
    expect(html).toContain(">npm install</code>");
  });

  it("still auto-links URLs the same way linkify used to", () => {
    const html = render("See https://example.com for details.", "cm-link");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('class="cm-link"');
    expect(html).toContain('target="_blank"');
  });

  it("formats emphasis in the text around a URL, not just plain URLs", () => {
    const html = render("Check **this** out: https://example.com and *this* too.");
    expect(html).toContain("<strong>this</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<em>this</em>");
  });

  it("handles multiple bold/italic spans in the same message", () => {
    const html = render("**One** and **two** and *three*.");
    expect(html).toContain("<strong>One</strong>");
    expect(html).toContain("<strong>two</strong>");
    expect(html).toContain("<em>three</em>");
  });

  it("leaves an unmatched single asterisk alone rather than crashing", () => {
    expect(render("This * is not emphasis.")).toBe("This * is not emphasis.");
  });

  it("renders ~~strikethrough~~ as <s>", () => {
    const html = render("That's ~~cancelled~~ postponed.");
    expect(html).toContain("<s>cancelled</s>");
    expect(html).not.toContain("~");
  });

  it("renders a markdown [text](url) link with the given text, not the raw url", () => {
    const html = render("Here's your link: [Pay now](https://pay.example.com)");
    expect(html).toContain('href="https://pay.example.com"');
    expect(html).toContain(">Pay now</a>");
    expect(html).not.toContain("[Pay now]");
  });

  it("wraps links in a small preview chip showing the hostname", () => {
    const html = render("See https://example.com/pricing for details.");
    expect(html).toContain("example.com");
    // the raw path shouldn't leak into the preview chip's own visible text
    expect(html).not.toMatch(/>\/pricing</);
  });

  it("renders a #hashtag as a styled inline span, not raw text", () => {
    const html = render("Ask about our #blackfriday deal.");
    expect(html).toMatch(/<span[^>]*>#blackfriday<\/span>/);
  });

  it("does not treat a mid-word # as a hashtag", () => {
    const html = render("Support for C#3 isn't a hashtag.");
    expect(html).not.toMatch(/<span[^>]*>#3<\/span>/);
  });

  it("renders a heading line as bold, larger text with the # markers stripped", () => {
    const html = render("# Big news\nEverything shipped.");
    expect(html).toContain("Big news");
    expect(html).not.toContain("#");
    expect(html).toMatch(/font-weight:\s*800/);
  });

  it("renders a bulleted list as a real <ul><li>", () => {
    const html = render("Choose one:\n- Basic\n- Pro\n- Enterprise");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>Basic</li>");
    expect(html).toContain("<li>Pro</li>");
    expect(html).toContain("<li>Enterprise</li>");
  });

  it("renders a numbered list as a real <ol><li>, with the digits stripped", () => {
    const html = render("1. First step\n2. Second step");
    expect(html).toContain("<ol");
    expect(html).toContain("<li>First step</li>");
    expect(html).toContain("<li>Second step</li>");
  });

  it("renders a blockquote line as <blockquote>", () => {
    const html = render("> Somebody said this");
    expect(html).toContain("<blockquote");
    expect(html).toContain("Somebody said this");
  });

  it("renders a horizontal rule as <hr>", () => {
    const html = render("Above\n---\nBelow");
    expect(html).toContain("<hr");
  });

  it("keeps a single plain line with no block syntax completely unwrapped", () => {
    expect(render("Nothing special here.")).toBe("Nothing special here.");
  });
});
