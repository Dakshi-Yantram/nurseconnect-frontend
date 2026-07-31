import { useState } from "react";
import { Siren, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { EmergencyAlert } from "@/components/shared/EmergencyAlert";

/**
 * Personal-safety panic button.
 *
 * Shown to BOTH sides of an active booking — the nurse (in case the
 * customer/household doesn't feel safe) and the customer (in case the nurse
 * doesn't feel safe). It is deliberately simple: one tap, one confirmation,
 * done. It does not ask the person to explain themselves before help is on
 * the way — `notes` is optional and can be added after the fact.
 *
 * Hits POST /api/bookings/{bookingId}/sos, which opens an emergency-level
 * escalation and alerts the safety/ops team immediately — never the other
 * person on the booking.
 */
export function SOSButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notes, setNotes] = useState("");

  async function send() {
    setSending(true);
    try {
      const coords: { latitude?: number; longitude?: number } = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
          () => resolve({}),
          { timeout: 3000 },
        );
      });
      await apiFetch(`/api/bookings/${bookingId}/sos`, {
        method: "POST",
        body: JSON.stringify({ notes: notes.trim() || null, ...coords }),
      });
      setSent(true);
      setOpen(false);
      toast.success("Help is on the way — our safety team has been alerted.");
    } catch (e: any) {
      toast.error(e?.message ? "Couldn't send SOS — try calling support directly if this keeps failing." : "Something went wrong sending your SOS.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-medium text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" /> Safety team alerted
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-100"
      >
        <Siren className="h-3.5 w-3.5" /> SOS — I don't feel safe
      </button>

      <EmergencyAlert
        open={open}
        onClose={() => !sending && setOpen(false)}
        title="Send a safety SOS?"
        eyebrow="Emergency"
        icon={<Siren className="h-5 w-5" />}
        tone="danger"
        confirmLabel={sending ? "Sending…" : "Send SOS now"}
        onConfirm={() => { if (!sending) send(); }}
      >
        <p>
          This immediately alerts our safety team with your location. They will
          call you and can dispatch help. If you're in immediate danger, also
          call your local emergency number.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional — what's happening? (you can skip this)"
          rows={2}
          disabled={sending}
          className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-[12.5px] resize-none disabled:opacity-60"
        />
        {sending && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Alerting the safety team…
          </div>
        )}
      </EmergencyAlert>
    </>
  );
}
