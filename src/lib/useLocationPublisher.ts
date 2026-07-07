import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

// Publishes the caregiver's GPS location to the backend every ~15s while they
// are on the way to a booking, which is what powers the consumer's
// "Track your nurse" map. Only runs while `active` is true (caller should pass
// status ∈ assigned | worker_en_route | worker_arrived).
//
// Usage inside the partner visit screen:
//   const active = ["assigned","worker_en_route","worker_arrived"].includes(b.status);
//   useLocationPublisher(visitId, active);
export function useLocationPublisher(bookingId: string, active: boolean, intervalMs = 15000) {
  useEffect(() => {
    if (!active || !("geolocation" in navigator)) return;
    let stopped = false;

    const publish = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (stopped) return;
          try {
            await apiFetch("/api/tracking/location", {
              method: "POST",
              body: JSON.stringify({
                booking_id: bookingId,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy_metres: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
                is_offline: false,
              }),
            });
          } catch { /* best-effort; ignore transient errors */ }
        },
        () => { /* permission denied / unavailable — skip this tick */ },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
      );
    };

    publish(); // fire immediately, then on an interval
    const id = setInterval(publish, intervalMs);
    return () => { stopped = true; clearInterval(id); };
  }, [bookingId, active, intervalMs]);
}
