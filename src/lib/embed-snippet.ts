// Bump this when public/widget.js changes in a way embedders need immediately — it's the
// cache-busting query param on an otherwise max-age=31536000-immutable static file (see
// next.config.ts's headers() for /widget.js).
export const WIDGET_SCRIPT_VERSION = "1";

export type WidgetPosition = "BOTTOM_LEFT" | "BOTTOM_RIGHT";

function positionAttr(position: WidgetPosition): string {
  return position === "BOTTOM_LEFT" ? "bottom-left" : "bottom-right";
}

export function buildEmbedSnippet(params: {
  origin: string;
  publicKey: string;
  primaryColor: string;
  widgetPosition: WidgetPosition;
}): string {
  return (
    `<script src="${params.origin}/widget.js?v=${WIDGET_SCRIPT_VERSION}" ` +
    `data-bot="${params.publicKey}" data-color="${params.primaryColor}" ` +
    `data-position="${positionAttr(params.widgetPosition)}" async></script>`
  );
}
