// Guards the Inbox's link-preview fetch (src/lib/actions/link-preview.ts) against being turned
// into an internal-network probe: a message can contain any URL a customer or seller typed, and
// fetching it server-side to build a preview card is exactly the shape of request an SSRF attack
// needs. This only checks DNS resolution ahead of the actual fetch — it does not pin the
// connection to the checked IP, so a DNS-rebinding attack (the name resolves to a public IP here,
// then to a private one by the time the fetch itself connects) isn't fully closed. That's an
// accepted, documented gap for a beta-scale feature; the check below still blocks the overwhelming
// majority of realistic SSRF attempts (localhost, cloud metadata endpoints, RFC1918 ranges).
import { isIP } from "net";
import { promises as dns } from "dns";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

// Every non-globally-routable IPv4 block worth blocking for an outbound fetch: this-network,
// private (RFC1918), carrier-grade NAT, loopback, link-local, IETF protocol assignments,
// benchmarking, multicast, and reserved/future-use — deliberately broad rather than a minimal
// "just the obvious ones" list.
const PRIVATE_IPV4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isPrivateIPv4(ip: string): boolean {
  const int = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (int & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  // Link-local (fe80::/10) and unique local (fc00::/7, i.e. fc.. or fd..).
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // IPv4-mapped (::ffff:a.b.c.d) — the embedded v4 address needs its own check.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // Unparseable — treat as unsafe rather than letting it through.
}

/** Resolves `hostname` and reports whether every address it resolves to is a public, routable
 * IP — a hostname with even one private/reserved address among its A/AAAA records is rejected,
 * since which address `fetch()` actually connects to isn't ours to control. */
export async function resolveIsPublicHost(hostname: string): Promise<boolean> {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((record) => !isPrivateOrReservedIp(record.address));
  } catch {
    return false;
  }
}
