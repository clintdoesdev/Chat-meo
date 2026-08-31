// A pure, dependency-free helper (no Prisma import) so client components — the Inbox view chief
// among them — can safely import it without dragging server-only DB code into the browser bundle.
// See inbox-queries.ts, which is Prisma-coupled and therefore server-only, for where the actual
// Message rows this operates on come from.

export type MessageContentTypeDto = "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";

const MEDIA_PREVIEW_EMOJI: Record<Exclude<MessageContentTypeDto, "TEXT">, string> = {
  IMAGE: "📷",
  DOCUMENT: "📄",
  VIDEO: "🎥",
  AUDIO: "🎤",
};

const MEDIA_PREVIEW_LABEL: Record<Exclude<MessageContentTypeDto, "TEXT">, string> = {
  IMAGE: "Photo",
  DOCUMENT: "Document",
  VIDEO: "Video",
  AUDIO: "Audio",
};

/** A one-line, emoji-prefixed stand-in for a non-text message — used for a conversation's list
 * preview, the compose box's "replying to" bar, and anywhere else a message needs to collapse to
 * a single line (search results) without rendering the actual attachment. `caption`
 * (image/video/document only) takes priority over the generic label when present, e.g.
 * "📷 check this out" instead of "📷 Photo". */
export function mediaPreview(contentType: MessageContentTypeDto, content: string, caption?: string | null): string {
  if (contentType === "TEXT") return content;
  return caption ? `${MEDIA_PREVIEW_EMOJI[contentType]} ${caption}` : `${MEDIA_PREVIEW_EMOJI[contentType]} ${MEDIA_PREVIEW_LABEL[contentType]}`;
}
