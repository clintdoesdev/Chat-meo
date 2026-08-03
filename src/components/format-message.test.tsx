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
});
