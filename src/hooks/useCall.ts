import { useCallback, useRef, useState } from "react";
import RealtimeKitClient from "@cloudflare/realtimekit";
import { apiFetch } from "@/lib/api";

export type CallPhase = "idle" | "connecting" | "ringing" | "in_call" | "ended";

const NO_ANSWER_MS = 45_000;

/** Classic two-pulse ringback tone (WebAudio) so the caller hears that it is ringing. */
function createRingback() {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const beep = () => {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const off of [0, 0.5]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 425;
      gain.gain.setValueAtTime(0.0001, t0 + off);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + off + 0.03);
      gain.gain.setValueAtTime(0.25, t0 + off + 0.38);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.42);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + off);
      osc.stop(t0 + off + 0.45);
    }
  };
  return {
    start() {
      try {
        const AC = window.AudioContext ?? (window as any).webkitAudioContext;
        if (!AC || timer) return;
        ctx = new AC();
        void ctx.resume();
        beep();
        timer = setInterval(beep, 3000);
      } catch { /* no audio available */ }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      try { void ctx?.close(); } catch { /* ignore */ }
      ctx = null;
    },
  };
}

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
  const ringRef = useRef(createRingback());
  const noAnswerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  const hangUpRef = useRef<(r?: "completed" | "declined" | "no_answer") => Promise<void>>(async () => {});

  // Remote voices: the core SDK only gives us the track — we must play it.
  const playRemote = useCallback((id: string, track: MediaStreamTrack | null | undefined) => {
    const existing = audioEls.current.get(id);
    if (!track) {
      if (existing) { existing.srcObject = null; existing.remove(); audioEls.current.delete(id); }
      return;
    }
    const el = existing ?? document.createElement("audio");
    el.autoplay = true;
    el.setAttribute("playsinline", "true");
    el.srcObject = new MediaStream([track]);
    if (!existing) { el.style.display = "none"; document.body.appendChild(el); audioEls.current.set(id, el); }
    void el.play().catch(() => undefined);
  }, []);

  const clearRemote = useCallback(() => {
    audioEls.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audioEls.current.clear();
  }, []);

  const startTalking = useCallback(() => {
    ringRef.current.stop();
    if (noAnswerRef.current) { clearTimeout(noAnswerRef.current); noAnswerRef.current = null; }
    setPhase((p) => {
      if (p !== "in_call" && !timerRef.current) {
        timerRef.current = setInterval(() => setDurationSeconds((x) => x + 1), 1000);
      }
      return "in_call";
    });
  }, []);

  const attachMeeting = useCallback(async (meetingId: string, authToken: string) => {
    const meeting = await RealtimeKitClient.init({
      authToken,
      defaults: { audio: true, video: false },
    });
    meetingRef.current = meeting;

    meeting.self.disableVideo();
    meeting.self.enableAudio();

    const wire = (p: any) => {
      try {
        playRemote(p.id, p.audioEnabled ? p.audioTrack : null);
        p.on?.("audioUpdate", ({ audioEnabled, audioTrack }: any) =>
          playRemote(p.id, audioEnabled ? audioTrack : null));
      } catch { /* SDK shape differs — audio just won't attach */ }
    };

    const joined: any = (meeting as any).participants?.joined;
    joined?.on?.("participantJoined", (p: any) => { wire(p); startTalking(); });
    joined?.on?.("participantLeft", (p: any) => {
      playRemote(p.id, null);
      if ((joined?.toArray?.() ?? []).length === 0) void hangUpRef.current("completed");
    });

    meeting.self.on("roomJoined", () => {
      // We are in the room, but the other person has not picked up yet: ring.
      const others: any[] = joined?.toArray?.() ?? [];
      if (others.length > 0) {
        others.forEach(wire);
        startTalking();
      } else {
        setPhase("ringing");
        ringRef.current.start();
        noAnswerRef.current = setTimeout(() => {
          setError("No answer. Please try again in a little while, or send a message.");
          void hangUpRef.current("no_answer");
        }, NO_ANSWER_MS);
      }
    });
    meeting.self.on("roomLeft", () => {
      ringRef.current.stop();
      clearRemote();
      setPhase("ended");
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    });

    await meeting.joinRoom();
  }, [playRemote, clearRemote, startTalking]);

  const startCall = useCallback(async (bookingId: string) => {
    setError(null);
    setPhase("connecting");
    try {
      const res = await apiFetch(`/api/bookings/${bookingId}/call/start`, { method: "POST" });
      sessionRef.current = { bookingId, callSessionId: res.call_session_id };
      await attachMeeting(res.dyte_meeting_id, res.dyte_auth_token);
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow the microphone in your browser and try again."
          : e?.message ?? "Could not start call",
      );
      ringRef.current.stop();
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
      setError(
        e?.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow the microphone in your browser and try again."
          : e?.message ?? "Could not join call",
      );
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
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    ringRef.current.stop();
    if (noAnswerRef.current) { clearTimeout(noAnswerRef.current); noAnswerRef.current = null; }
    clearRemote();
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
  }, [clearRemote]);
  hangUpRef.current = hangUp;

  return { phase, isMuted, durationSeconds, error, startCall, joinCall, toggleMute, hangUp };
}