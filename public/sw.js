// public/sw.js
// Web Push service worker — shows a notification for incoming-call pushes.
//
// SCOPE OF WHAT THIS CAN DO:
// - Browser tab closed but browser process alive (backgrounded): works on
//   Chrome/Edge/Firefox on desktop and Android.
// - Browser fully quit / phone locked for a long time / iOS Safari without
//   the site installed as a Home Screen PWA: NOT guaranteed. iOS only
//   supports web push for installed PWAs (16.4+), and even then there's no
//   CallKit-style full-screen ringing UI — just a normal notification.
// - Fully force-killed native-app-style "ring like a phone call" is not
//   achievable from a website; that needs PushKit/CallKit (iOS) or a
//   foreground service (Android), which requires a native wrapper.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || "NurseConnect";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.type === "incoming_call" ? `call-${payload.call_session_id}` : undefined,
    requireInteraction: payload.type === "incoming_call",
    data: payload,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.booking_id ? `/consumer/bookings/${data.booking_id}` : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});