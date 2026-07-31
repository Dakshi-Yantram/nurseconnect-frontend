import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Siren, X } from "lucide-react";
import { toast } from "sonner";
import { useSOSAlertListener, type SOSAlert } from "@/hooks/useSOSAlertListener";

const ROLE_LABEL: Record<SOSAlert["triggered_by_role"], string> = {
  worker: "The nurse",
  consumer: "The customer",
  admin: "A staff member",
};

/** Mounted app-wide (gated to admin sessions) in AppShell. Shows a
 * persistent red banner for every live safety SOS until it's dismissed or
 * acknowledged from the Support Dashboard, and fires a loud toast the
 * instant a new one comes in. */
export function SOSAlertBanner({ enabled }: { enabled: boolean }) {
  const { alerts, dismiss } = useSOSAlertListener(enabled);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const a of alerts) {
      if (seen.current.has(a.escalation_id)) continue;
      seen.current.add(a.escalation_id);
      toast.error(`🆘 Safety SOS — ${ROLE_LABEL[a.triggered_by_role] ?? "Someone"} needs help`, {
        description: a.notes || `Booking ${a.booking_ref ?? a.booking_id}`,
        duration: Infinity,
      });
    }
  }, [alerts]);

  if (!enabled || alerts.length === 0) return null;

  return (
    <div className="sticky top-0 z-40 space-y-1.5 px-3 pt-2 sm:px-4">
      {alerts.map((a) => (
        <div
          key={a.escalation_id}
          className="flex items-center gap-3 rounded-lg border border-rose-300 bg-rose-600 px-4 py-2.5 text-white shadow-lg animate-in slide-in-from-top-2"
        >
          <Siren className="h-4 w-4 shrink-0 animate-pulse" />
          <div className="min-w-0 flex-1 text-[13px]">
            <span className="font-semibold">{ROLE_LABEL[a.triggered_by_role] ?? "Someone"} triggered a safety SOS.</span>{" "}
            <span className="opacity-90">Booking #{(a.booking_ref ?? a.booking_id).slice(0, 10)}</span>
            {a.notes && <span className="opacity-90"> — {a.notes}</span>}
          </div>
          <Link
            to="/support-dashboard"
            className="shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-[12px] font-medium hover:bg-white/25"
          >
            Open dashboard
          </Link>
          <button onClick={() => dismiss(a.escalation_id)} className="shrink-0 rounded-md p-1 hover:bg-white/15">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
