function extractHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0];
  }
}

/**
 * An empty allowedDomains list means the bot owner hasn't restricted embedding yet — permissive
 * by design, matching the same leniency as skipping this check outright in dev. Once at least
 * one domain is configured, the request must carry an Origin header matching one of them
 * (supporting a "*.example.com" wildcard entry for subdomains).
 */
export function isOriginAllowed(origin: string | null, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  if (!origin) return false;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  return allowedDomains.some((entry) => {
    const allowedHost = extractHostname(entry);
    if (allowedHost.startsWith("*.")) {
      return hostname === allowedHost.slice(2) || hostname.endsWith(allowedHost.slice(1));
    }
    return hostname === allowedHost;
  });
}
