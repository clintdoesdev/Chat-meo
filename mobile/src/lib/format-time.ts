/** Small, dependency-free relative-time formatter — the Inbox row timestamp is the only place
 * this app needs one, so a full date library (date-fns/dayjs) isn't worth adding for it. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
