import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

// Compact inline chip shown directly on the consumer's booking card once a
// nurse has accepted (booking.status one of the values below). The OTP is
// auto-generated server-side the moment the nurse accepts, so this just
// fetches/displays the already-active code — no "send" click required.
// The nurse enters this same code (POST /visits/{id}/verify-start-otp,
// scoped to booking.worker_id) to start the visit.
const ELIGIBLE = ["assigned", "worker_en_route", "worker_arrived", "in_progress"];

export function VisitOtpChip({ bookingId, status }: { bookingId: string; status: string }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ELIGIBLE.includes(status)) return;
    if (fetchedFor.current === bookingId) return;
    fetchedFor.current = bookingId;
    setLoading(true);
    apiFetch(`/api/visits/${bookingId}/generate-start-otp`, { method: "POST" })
      .then(res => {
        setOtp(res?.otp ?? null);
        setSecondsLeft(typeof res?.expires_in_seconds === "number" ? res.expires_in_seconds : null);
      })
      .catch(() => { /* best-effort — card still works without the chip */ })
      .finally(() => setLoading(false));
  }, [bookingId, status]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => (s !== null ? Math.max(0, s - 1) : s)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft !== null]);

  if (!ELIGIBLE.includes(status)) return null;
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground shrink-0">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  if (!otp) return null;

  const mm = secondsLeft != null ? Math.floor(secondsLeft / 60) : null;
  const ss = secondsLeft != null ? secondsLeft % 60 : null;

  return (
    <span
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      title="Give this code to your nurse when they arrive to start the visit"
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 shrink-0"
    >
      <KeyRound className="h-3 w-3 text-primary" />
      <span className="text-[13px] font-bold tracking-widest text-primary font-mono">{otp}</span>
      {mm != null && ss != null && (
        <span className="text-[10px] text-muted-foreground">
          {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </span>
      )}
    </span>
  );
}
