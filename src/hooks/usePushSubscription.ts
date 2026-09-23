import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

// Set VITE_VAPID_PUBLIC_KEY in the frontend .env — must match the backend's
// VAPID_PUBLIC_KEY (they're a pair; only the private half stays server-side).
const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Registers /sw.js and subscribes for Web Push, then tells the backend
 * about the subscription so it can ring this device when the tab isn't
 * focused. Best-effort only — see public/sw.js for the ceiling on this.
 * Call once per authenticated session (e.g. from the app layout), after
 * login. No-ops silently if the browser doesn't support push or the user
 * hasn't granted permission.
 */
export function usePushSubscription(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }
        if (Notification.permission !== "granted") return;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
        if (cancelled) return;

        const json = subscription.toJSON();
        await apiFetch("/api/notifications/push-subscribe", {
          method: "POST",
          body: JSON.stringify({
            endpoint: json.endpoint,
            p256dh_key: json.keys?.p256dh,
            auth_key: json.keys?.auth,
            user_agent: navigator.userAgent,
          }),
        });
      } catch {
        // Non-fatal — calling still works via websocket + FCM while the
        // tab/app is open; this channel only adds backgrounded coverage.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}