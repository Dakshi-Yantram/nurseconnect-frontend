import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIncomingCallListener } from "@/hooks/useIncomingCallListener";
import { useCall } from "@/hooks/useCall";

/**
 * Mount ONCE inside each authenticated layout (e.g. _app.consumer.tsx and
 * _app.partner.tsx), not per-page — that way a call rings regardless of
 * which page the user is currently on.
 */
export function IncomingCallOverlay() {
  const { incomingCall, dismissIncomingCall } = useIncomingCallListener();
  const { phase, joinCall, hangUp } = useCall();

  if (!incomingCall || phase === "in_call" || phase === "connecting") return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center p-3">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-2xl px-4 py-3 animate-in slide-in-from-top-4">
        <div className="h-9 w-9 rounded-full bg-primary/15 grid place-items-center animate-pulse">
          <Phone className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground">{incomingCall.caller_name}</span>
          <span className="text-[11px] text-muted-foreground">Incoming call…</span>
        </div>
        <Button
          size="icon"
          variant="destructive"
          className="h-9 w-9 rounded-full"
          onClick={async () => {
            await hangUp("declined");
            dismissIncomingCall();
          }}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-700"
          onClick={() => joinCall(incomingCall.booking_id, incomingCall.call_session_id)}
        >
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}