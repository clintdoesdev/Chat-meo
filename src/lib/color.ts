const HEX_RE = /^#([0-9a-f]{6})$/i;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

/** Lightens a hex color toward white by `amount` (0-1) — used to derive the widget's gradient
 * highlight shade from a single owner-picked primaryColor. Falls back to the input unchanged
 * for anything that isn't a clean 6-digit hex, so a bad value degrades to "flat color" instead
 * of throwing. */
export function lightenHex(hex: string, amount: number): string {
  const match = HEX_RE.exec(hex);
  if (!match) return hex;

  const num = parseInt(match[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);

  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
