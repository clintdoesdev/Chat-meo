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

export type Hsv = { h: number; s: number; v: number };

/** Falls back to black for anything that isn't a clean 6-digit hex — same "degrade, don't
 * throw" contract as lightenHex, since this feeds a live-updating color picker UI. */
export function hexToHsv(hex: string): Hsv {
  const match = HEX_RE.exec(hex);
  if (!match) return { h: 0, s: 0, v: 0 };

  const num = parseInt(match[1], 16);
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toByte = (channel: number) => Math.round((channel + m) * 255);
  return `#${[toByte(r), toByte(g), toByte(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
