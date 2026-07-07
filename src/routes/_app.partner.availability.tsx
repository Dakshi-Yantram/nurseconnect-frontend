import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Wifi, WifiOff, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/availability")({
  component: WorkerAvailability,
  head: () => ({ meta: [{ title: "Availability — NurseConnect" }] }),
});

// The backend models availability as a live online/offline status (not a
// weekly grid). Going ONLINE is only allowed once onboarding is approved.
function WorkerAvailability() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<string>("offline");
  const [onboarding, setOnboarding] = useState<string>("");
  const [stats, setStats] = useState<{ rating: number; visits: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiFetch("/api/workers/me");
      setAvailability(me.availability ?? "offline");
      setOnboarding(me.onboarding_status ?? "");
      setStats({ rating: Number(me.rating_average ?? 0), visits: Number(me.completed_visits_count ?? 0) });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(next: "online" | "offline") {
    setError(null);
    setSaving(true);
    try {
      const updated = await apiFetch("/api/workers/me/availability", {
        method: "PUT",
        body: JSON.stringify({ availability: next }),
      });
      setAvailability(updated.availability ?? next);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const isOnline = availability === "online";
  const onVisit = availability === "on_visit";
  const notApproved = onboarding !== "approved";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-xl px-4 py-8 space-y-4">
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Availability</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Go online to receive booking requests. Go offline to stop receiving them.
          </p>
        </div>

        <div className={cn(
          "rounded-xl border px-5 py-5 flex items-center gap-4",
          isOnline ? "border-emerald-200 bg-emerald-50" : "border-border bg-card"
        )}>
          <span className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full",
            isOnline ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
          )}>
            {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-foreground">
              {onVisit ? "On a visit" : isOnline ? "You're online" : "You're offline"}
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              {onVisit ? "Status managed automatically during an active visit"
                : isOnline ? "Receiving new booking requests" : "Not receiving requests"}
            </p>
          </div>
          {!onVisit && (
            <button
              onClick={() => setStatus(isOnline ? "offline" : "online")}
              disabled={saving || (notApproved && !isOnline)}
              className={cn(
                "rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed",
                isOnline ? "border border-border text-foreground hover:bg-muted"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {saving ? "…" : isOnline ? "Go offline" : "Go online"}
            </button>
          )}
        </div>

        {notApproved && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2 text-[12.5px] text-amber-800">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
            Your account must be approved before you can go online.
          </div>
        )}

        {error && <p className="text-[12.5px] text-red-600">{error}</p>}

        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rating</p>
              <p className="text-[24px] font-bold text-foreground mt-0.5">{stats.rating.toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Completed Visits</p>
              <p className="text-[24px] font-bold text-foreground mt-0.5">{stats.visits}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
