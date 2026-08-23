// Chatmeo's push service worker — handles incoming Web Push events and notification clicks.
// Registered from src/components/app/push-subscription.tsx. Payloads are JSON-encoded
// { title, body, url } objects, written by src/lib/push/send.ts.

self.addEventListener("push", (event) => {
  let payload = { title: "Chatmeo", body: "You have a new notification.", url: "/app/inbox" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON payload (shouldn't happen — every sender goes through sendPushToUser) — fall
    // back to the generic notification above rather than dropping it silently.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/inbox";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsList.find((client) => new URL(client.url).pathname === url);
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
