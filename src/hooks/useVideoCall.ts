/**
 * Video calling for tele-consultations, via Cloudflare RealtimeKit.
 *
 * Deliberately a separate hook from useCall.ts rather than a "video" flag
 * added to it: useCall is shared by the existing audio-only calling flow
 * (family <-> physical-visit provider) and explicitly disables video by
 * design (`defaults: { audio: true, video: false }`). Changing that
 * shared hook's behaviour to support video would risk turning on cameras
 * in a flow that was deliberately built audio-only. This hook targets the
 * tele-consultation screen only and uses the exact same backend call API
 * (POST /bookings/{id}/call/start|join|end) — the SAME RealtimeKit meeting
 * mechanics, just with video requested.
 *
 * SDK SURFACE — verified against Cloudflare's published RealtimeKit docs
 * (developers.cloudflare.com/realtime/realtimekit/core), since this sandbox
 * has no network access to install the package and inspect its .d.ts
 * directly:
 *   - RealtimeKitClient.init(), meeting.self.on('roomJoined'|'roomLeft'),
 *     meeting.self.enableAudio/disableAudio/enableVideo/disableVideo — all
 *     confirmed correct (roomJoined/roomLeft and joinRoom/leaveRoom are
 *     also copied verbatim from the already-working useCall.ts).
 *   - Per-participant video/audio changes are events on the MAP, not on
 *     the individual RTKParticipant — there is no participant.on(...).
 *     The correct pattern, registered ONCE per meeting:
 *       meeting.participants.joined.on('videoUpdate', (participant) => {
 *         // participant.videoTrack / participant.videoEnabled
 *       });
 *     An earlier version of this hook incorrectly called p.on('videoUpdate',
 *     ...) on each joined participant, which does not exist on
 *     RTKParticipant and would have silently done nothing (event listeners
 *     attached to an object with no .on() throw, so the join flow itself
 *     would have broken the moment a real remote participant joined).
 *   - meeting.self's own 'videoUpdate' event does not have a confirmed
 *     payload shape in the docs, so this reads meeting.self.videoEnabled /
 *     meeting.self.videoTrack directly instead of destructuring the event
 *     argument — those two properties ARE documented on RTKSelfMedia.
 *
 * Still worth a final check against the installed package's actual .d.ts
 * before shipping, the same way Digio's exact API shape should be checked
 * (see app/integrations/providers.py::DigioClient for that caveat on the
 * backend) — but this is no longer an unverified guess, it's built from
 * Cloudflare's own reference pages.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import RealtimeKitClient from "@cloudflare/realtimekit";
import { teleCallService } from "@/lib/teleconsult";

export type VideoCallPhase = "idle" | "connecting" | "in_call" | "ended";

export interface RemoteParticipant {
  id: string;
  name: string;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
}

export interface UseVideoCallResult {
  phase: VideoCallPhase;
  isMuted: boolean;
  isVideoOff: boolean;
  durationSeconds: number;
  error: string | null;
  selfVideoTrack: MediaStreamTrack | null;
  remoteParticipants: RemoteParticipant[];
  /** Caller: starts a brand-new video session on this booking. */
  startCall: (bookingId: string) => Promise<void>;
  /** Callee: joins a session they were rung for. */
  joinCall: (bookingId: string, callSessionId: string) => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  hangUp: (reason?: "completed" | "declined" | "no_answer") => Promise<void>;
}

export function useVideoCall(): UseVideoCallResult {
  const [phase, setPhase] = useState<VideoCallPhase>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selfVideoTrack, setSelfVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  const meetingRef = useRef<RealtimeKitClient | null>(null);
  const sessionRef = useRef<{ bookingId: string; callSessionId: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        meetingRef.current?.leaveRoom();
      } catch {
        // already left / never joined
      }
    };
  }, []);

  const upsertRemote = useCallback((id: string, patch: Partial<RemoteParticipant>) => {
    setRemoteParticipants((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) {
        return [...prev, { id, name: patch.name ?? "Patient", videoTrack: null, audioTrack: null, ...patch }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const removeRemote = useCallback((id: string) => {
    setRemoteParticipants((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const attachMeeting = useCallback(
    async (meetingId: string, authToken: string) => {
      const meeting = await RealtimeKitClient.init({
        authToken,
        defaults: { audio: true, video: true },
      });
      meetingRef.current = meeting;

      meeting.self.enableAudio();
      meeting.self.enableVideo();

      meeting.self.on("roomJoined", () => {
        setPhase("in_call");
        setSelfVideoTrack(meeting.self.videoTrack ?? null);
        timerRef.current = setInterval(() => setDurationSeconds((s) => s + 1), 1000);
      });
      meeting.self.on("roomLeft", () => {
        setPhase("ended");
        if (timerRef.current) clearInterval(timerRef.current);
      });
      meeting.self.on("videoUpdate", () => {
        // RTKSelfMedia documents .videoEnabled / .videoTrack as properties
        // on meeting.self, not a payload on this event — read them off the
        // object rather than assuming what the event argument contains.
        setIsVideoOff(!meeting.self.videoEnabled);
        setSelfVideoTrack(meeting.self.videoTrack ?? null);
      });

      // Existing + future remote participants (the patient's side, joined
      // via a family-app equivalent of joinCall against the same meeting).
      // Each of the four events below is a MAP-level event on
      // meeting.participants.joined, fired for whichever participant
      // changed — registered once here, not per-participant. RTKParticipant
      // itself exposes no .on() method (see the file header note).
      meeting.participants.joined.forEach((p: any) => {
        upsertRemote(p.id, { name: p.name, videoTrack: p.videoTrack ?? null, audioTrack: p.audioTrack ?? null });
      });
      meeting.participants.joined.on("participantJoined", (p: any) => {
        upsertRemote(p.id, { name: p.name, videoTrack: p.videoTrack ?? null, audioTrack: p.audioTrack ?? null });
      });
      meeting.participants.joined.on("participantLeft", (p: any) => removeRemote(p.id));
      meeting.participants.joined.on("videoUpdate", (p: any) => {
        upsertRemote(p.id, { videoTrack: p.videoTrack ?? null });
      });
      meeting.participants.joined.on("audioUpdate", (p: any) => {
        upsertRemote(p.id, { audioTrack: p.audioTrack ?? null });
      });

      await meeting.joinRoom();
    },
    [upsertRemote, removeRemote],
  );

  const startCall = useCallback(
    async (bookingId: string) => {
      setError(null);
      setPhase("connecting");
      try {
        const res = await teleCallService.start(bookingId);
        sessionRef.current = { bookingId, callSessionId: res.call_session_id };
        await attachMeeting(res.dyte_meeting_id, res.dyte_auth_token);
      } catch (e: any) {
        setError(e?.message ?? "Could not start the video consultation");
        setPhase("idle");
      }
    },
    [attachMeeting],
  );

  const joinCall = useCallback(
    async (bookingId: string, callSessionId: string) => {
      setError(null);
      setPhase("connecting");
      try {
        const res = await teleCallService.join(bookingId, callSessionId);
        sessionRef.current = { bookingId, callSessionId };
        await attachMeeting(res.dyte_meeting_id, res.dyte_auth_token);
      } catch (e: any) {
        setError(e?.message ?? "Could not join the video consultation");
        setPhase("idle");
      }
    },
    [attachMeeting],
  );

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

  const toggleVideo = useCallback(() => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    if (isVideoOff) {
      meeting.self.enableVideo();
      setIsVideoOff(false);
    } else {
      meeting.self.disableVideo();
      setIsVideoOff(true);
    }
  }, [isVideoOff]);

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
        await teleCallService.end(s.bookingId, s.callSessionId, reason);
      } catch {
        // best effort — call already ended server-side is fine
      }
    }
    setPhase("ended");
    setDurationSeconds(0);
    setSelfVideoTrack(null);
    setRemoteParticipants([]);
    meetingRef.current = null;
    sessionRef.current = null;
  }, []);

  return {
    phase,
    isMuted,
    isVideoOff,
    durationSeconds,
    error,
    selfVideoTrack,
    remoteParticipants,
    startCall,
    joinCall,
    toggleMute,
    toggleVideo,
    hangUp,
  };
}
