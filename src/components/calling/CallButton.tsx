import { useEffect } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCall } from "@/hooks/useCall";

function formatDuration(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CallButton({ bookingId, calleeLabel }: { bookingId: string; calleeLabel: string }) {
  const { phase, isMuted, durationSeconds, error, startCall, toggleMute, hangUp } = useCall();

  if (phase === "idle" || phase === "ended") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant="outline" size="sm" onClick={() => startCall(bookingId)} className="gap-1.5">
          <Phone className="h-3.5 w-3.5" />
          Call {calleeLabel}
        </Button>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <div className="flex flex-col">
        <span className="text-[12px] font-medium text-foreground">
          {phase === "connecting" ? `Calling ${calleeLabel}…` : `On call with ${calleeLabel}`}
        </span>
        {phase === "in_call" && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatDuration(durationSeconds)}</span>
        )}
      </div>
      {phase === "in_call" && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
      )}
      <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => hangUp("completed")}>
        <PhoneOff className="h-4 w-4" />
      </Button>
    </div>
  );
}