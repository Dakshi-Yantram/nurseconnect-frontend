import { useEffect, useRef, useState } from "react";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";

export interface SOSAlert {
  escalation_id: string;
  booking_id: string;
  booking_ref?: string | null;
  triggered_by_role: "consumer" | "worker" | "admin";
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  created_at?: string | null;
}

/**
 * Subscribes to the existing /api/ws/user socket (same one used for
 * incoming-call alerts — see useIncomingCallListener.ts) and surfaces
 * `sos.alert` events pushed by POST /bookings/{id}/sos. This gets a safety
 * SOS in front of an admin instantly, instead of waiting on the support
 * dashboard's normal 60s poll.
 *
 * Mount once, near the root, only for admin sessions.
 */
export function useSOSAlertListener(enabled: boolean) {
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const wsBase = API_BASE.replace(/^http/, "ws");
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const ws = new WebSocket(`${wsBase}/api/ws/user?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "sos.alert") {
            setAlerts((cur) => [msg as SOSAlert, ...cur.filter((a) => a.escalation_id !== msg.escalation_id)]);
          }
        } catch {
          // ignore non-JSON (e.g. pong) frames
        }
      };

      ws.onclose = () => {
        if (!closedByUs) retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [enabled]);

  function dismiss(escalationId: string) {
    setAlerts((cur) => cur.filter((a) => a.escalation_id !== escalationId));
  }

  return { alerts, dismiss };
}
