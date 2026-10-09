// Push-only service worker. No caching/offline behaviour — it exists purely
// so the browser has something to wake in the background for `push` events.
self.addEventListener("push", (event) => {
  let data = { title: "DevFest Chennai", body: "" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload (shouldn't happen — our server always sends JSON).
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/web-app-manifest-192x192.png",
      badge: "/web-app-manifest-192x192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
