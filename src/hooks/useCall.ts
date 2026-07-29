import { useCallback, useRef, useState } from "react";
import RealtimeKitClient from "@cloudflare/realtimekit";
import { apiFetch } from "@/lib/api";

export type CallPhase = "idle" | "connecting" | "in_call" | "ended";

export interface UseCallResult {
  phase: CallPhase;
  isMuted: boolean;
  durationSeconds: number;
  error: string | null;
  /** Caller: starts a brand-new call on this booking. */
  startCall: (bookingId: string) => Promise<void>;
  /** Callee: joins a call they were rung for. */
  joinCall: (bookingId: string, callSessionId: string) => Promise<void>;
  toggleMute: () => void;
  hangUp: (reason?: "completed" | "declined" | "no_answer") => Promise<void>;
}

/** Audio-only in-app calling via Cloudflare RealtimeKit. Video track is never requested. */
export function useCall(): UseCallResult {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const meetingRef = useRef<RealtimeKitClient | null>(null);
  const sessionRef = useRef<{ bookingId: string; callSessionId: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const attachMeeting = useCallback(async (meetingId: string, authToken: string) => {
    const meeting = await RealtimeKitClient.init({
      authToken,
      defaults: { audio: true, video: false },
    });
    meetingRef.current = meeting;

    meeting.self.disableVideo();
    meeting.self.enableAudio();

    meeting.self.on("roomJoined", () => {
      setPhase("in_call");
      timerRef.current = setInterval(() => setDurationSeconds((s) => s + 1), 1000);
    });
    meeting.self.on("roomLeft", () => {
      setPhase("ended");
      if (timerRef.current) clearInterval(timerRef.current);
    });

    await meeting.joinRoom();
  }, []);

  const startCall = useCallback(async (bookingId: string) => {
    setError(null);
    setPhase("connecting");
    try {
      const res = await apiFetch(`/api/bookings/${bookingId}/call/start`, { method: "POST" });
      sessionRef.current = { bookingId, callSessionId: res.call_session_id };
      await attachMeeting(res.dyte_meeting_id, res.dyte_auth_token);
    } catch (e: any) {
      setError(e?.message ?? "Could not start call");
      setPhase("idle");
    }
  }, [attachMeeting]);

  const joinCall = useCallback(async (bookingId: string, callSessionId: string) => {
    setError(null);
    setPhase("connecting");
    try {
      const res = await apiFetch(`/api/bookings/${bookingId}/call/${callSessionId}/join`, { method: "POST" });
      sessionRef.current = { bookingId, callSessionId };
      await attachMeeting(res.dyte_meeting_id, res.dyte_auth_token);
    } catch (e: any) {
      setError(e?.message ?? "Could not join call");
      setPhase("idle");
    }
  }, [attachMeeting]);

  const toggleMute = useCallback(() => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    if (isMuted) {
      meeting.self.enableAudio();
      setIsMuted(false);
    } else {
      meeting.self.disableAudio();
      setIsMuted(true);
    }
  }, [isMuted]);

  const hangUp = useCallback(async (reason: "completed" | "declined" | "no_answer" = "completed") => {
    try {
      meetingRef.current?.leaveRoom();
    } catch {
      // already left
    }
    if (timerRef.current) clearInterval(timerRef.current);
    const s = sessionRef.current;
    if (s) {
      try {
        await apiFetch(`/api/bookings/${s.bookingId}/call/${s.callSessionId}/end`, {
          method: "POST",
          body: JSON.stringify({ end_reason: reason }),
        });
      } catch {
        // best effort — call already ended server-side is fine
      }
    }
    setPhase("ended");
    setDurationSeconds(0);
    meetingRef.current = null;
    sessionRef.current = null;
  }, []);

  return { phase, isMuted, durationSeconds, error, startCall, joinCall, toggleMute, hangUp };
}