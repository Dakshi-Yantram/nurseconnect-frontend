import { useEffect, useState } from "react";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch, apiErrorMessage } from "@/lib/api";

// Shown on the consumer's booking detail once a nurse is assigned. The family
// taps this when the nurse is at the door; the backend SMSes a 4-digit code to
// the family's phone, which they read aloud to the nurse to start the visit.
// Render only when booking.status is one of: assigned | worker_en_route |
// worker_arrived | in_progress.
const ELIGIBLE = ["assigned", "worker_en_route", "worker_arrived", "in_progress"];

export function StartVisitCodeButton({ bookingId, status }: { bookingId: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ELIGIBLE.includes(status)) return;
    fetchCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, status]);

  if (!ELIGIBLE.includes(status)) return null;

  async function fetchCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch(`/api/visits/${bookingId}/generate-start-otp`, { method: "POST", timeoutMs: 25_000 });
      setOtp(res?.otp ?? null);
      // sms_sent: true = texted, false = SMS failed (code still valid, shown
      // here), null = existing code re-shown (no new SMS).
      setMessage(
        res?.sms_sent === false
          ? "We couldn't text this code to you — read it to your nurse from this screen."
          : res?.message ?? "Show this code to your nurse when they arrive.",
      );
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Couldn't get the start code. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-primary" />
        <p className="text-[13.5px] font-bold text-foreground">Start the visit</p>
      </div>
      {otp ? (
        <div className="flex items-start gap-2 text-[12.5px]">
          <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-700" />
          <div>
            <p className="text-emerald-700">{message}</p>
            <p className="mt-1.5 text-[22px] font-bold tracking-[0.3em] text-primary font-mono">{otp}</p>
            <button onClick={fetchCode} disabled={busy} className="mt-1 text-primary hover:underline disabled:opacity-40">
              {busy ? "Refreshing…" : "Refresh code"}
            </button>
            {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
          </div>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-muted-foreground mb-3">
            When your nurse arrives, read them the start code to begin the visit.
          </p>
          <button
            onClick={fetchCode}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Get start code
          </button>
          {error && (
            <p className="mt-2 text-[12px] text-red-600">
              {error}{" "}
              <button onClick={fetchCode} disabled={busy} className="font-medium underline">Try again</button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
