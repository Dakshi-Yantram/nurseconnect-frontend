import { useEffect, useRef, useState } from "react";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";

export interface IncomingCall {
  booking_id: string;
  call_session_id: string;
  dyte_meeting_id: string;
  caller_name: string;
}

/**
 * Subscribes to the existing /api/ws/user socket (already used elsewhere in
 * the app) and surfaces `incoming_call` / `call_ended` events. Mount this
 * once near the root of each authenticated layout (consumer + partner) so a
 * call can ring no matter which page the user is on — NOT just the booking
 * detail page.
 *
 * IMPORTANT: this only fires while the tab is open (foreground or
 * backgrounded-but-alive). It does not fire if the tab/app was fully closed
 * — that gap is covered (best-effort) by the FCM/Web-Push side channel the
 * backend also fires on /call/start; see usePushSubscription.ts.
 */
export function useIncomingCallListener() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
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
          if (msg.type === "incoming_call") {
            setIncomingCall({
              booking_id: msg.booking_id,
              call_session_id: msg.call_session_id,
              dyte_meeting_id: msg.dyte_meeting_id,
              caller_name: msg.caller_name,
            });
          } else if (msg.type === "call_ended") {
            setIncomingCall((cur) => (cur?.call_session_id === msg.call_session_id ? null : cur));
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
  }, []);

  return { incomingCall, dismissIncomingCall: () => setIncomingCall(null) };
}