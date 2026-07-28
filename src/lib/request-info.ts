import { headers } from "next/headers";

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  return "an unknown browser";
}

function detectOs(ua: string): string {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "an unknown device";
}

/** Best-effort "Chrome on macOS" style summary from a User-Agent string. */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  return `${detectBrowser(ua)} on ${detectOs(ua)}`;
}

/** Best-effort client IP from proxy headers — may be absent or spoofable, informational only. */
export async function getClientInfo(): Promise<{ ip: string; device: string }> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : headerList.get("x-real-ip") ?? "Unknown";
  const device = describeUserAgent(headerList.get("user-agent"));
  return { ip, device };
}
