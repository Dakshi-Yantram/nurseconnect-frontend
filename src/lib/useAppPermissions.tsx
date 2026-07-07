import { useEffect, useRef, useState } from "react";

// Status for each permission.
export type PermStatus = "unknown" | "granted" | "denied" | "unavailable";

export type AppPermissions = {
  location: PermStatus;
  notifications: PermStatus;
};

// Requests and tracks the two permissions the app needs:
//   1. Geolocation — required for live dispatch (nurse) + GPS address fill (consumer)
//   2. Notifications — for push alerts (new booking request, visit reminders)
// Note: there is no Bluetooth requirement for this app. Location + notifications
// are the only web-permission prompts needed.
export function useAppPermissions(): {
  perms: AppPermissions;
  request: () => void;
} {
  const [perms, setPerms] = useState<AppPermissions>({
    location: "unknown",
    notifications: "unknown",
  });
  const requested = useRef(false);

  async function checkPassive() {
    const next: AppPermissions = { location: "unknown", notifications: "unknown" };
    if (!navigator.geolocation) {
      next.location = "unavailable";
    } else {
      try {
        const st = await navigator.permissions.query({ name: "geolocation" });
        next.location = st.state === "granted" ? "granted" : st.state === "denied" ? "denied" : "unknown";
      } catch { /* old browser — fall back to unknown */ }
    }
    if (!("Notification" in window)) {
      next.notifications = "unavailable";
    } else {
      next.notifications =
        Notification.permission === "granted" ? "granted"
          : Notification.permission === "denied" ? "denied"
            : "unknown";
    }
    setPerms(next);
  }

  useEffect(() => { checkPassive(); }, []);

  async function request() {
    if (requested.current) return;
    requested.current = true;

    // 1. Geolocation — ask the browser. Must be a real user gesture on iOS.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setPerms((p) => ({ ...p, location: "granted" })),
        () => setPerms((p) => ({ ...p, location: "denied" })),
        { timeout: 8000 },
      );
    }

    // 2. Notifications — Notification.requestPermission()
    if ("Notification" in window && Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPerms((p) => ({ ...p, notifications: result === "granted" ? "granted" : "denied" }));
    }
  }

  return { perms, request };
}

// Pill badge so you can show permission status anywhere.
export function PermissionBadge({ status, label }: { status: PermStatus; label: string }) {
  const color =
    status === "granted" ? "bg-emerald-100 text-emerald-700"
      : status === "denied" ? "bg-red-100 text-red-700"
        : status === "unavailable" ? "bg-muted text-muted-foreground"
          : "bg-amber-100 text-amber-700";
  const dot =
    status === "granted" ? "bg-emerald-500"
      : status === "denied" ? "bg-red-500"
        : "bg-amber-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label} {status === "granted" ? "✓" : status === "denied" ? "blocked" : "pending"}
    </span>
  );
}
