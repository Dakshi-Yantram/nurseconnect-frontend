import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Lock, Check, ShieldAlert, Loader2, Syringe } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/services")({
  component: PartnerServices,
});

type Eligibility = {
  target_type: "package";
  id: string;
  code: string;
  name: string;
  category?: string | null;
  min_tier?: string | null;
  risk_level?: string | null;
  qualification_status: string;
  preference_status: string;      // OPTED_IN | OPTED_OUT | PAUSED
  can_opt_in: boolean;
  locked_reason?: string | null;
  requires_admin_skill_approval?: boolean;
};

// Nurses choose which admin-managed care packages they want to serve — but
// they can only opt IN to ones they are qualified for. A caretaker who
// isn't qualified for, say, Post-Surgery Recovery, sees it LOCKED with the
// reason. Enforced server-side too (opt-in is rejected unless
// qualification=APPROVED). No pricing is ever shown here — packages are
// purely opt-in offerings gated by training/assessments.
function PartnerServices() {
  const [items, setItems] = useState<Eligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiFetch("/api/workers/me/service-eligibility");
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setPreference(item: Eligibility, status: "OPTED_IN" | "OPTED_OUT") {
    setError(null);
    setBusy(item.id);
    try {
      await apiFetch("/api/workers/me/service-preferences", {
        method: "PUT",
        body: JSON.stringify({
          target_type: item.target_type,
          target_id: item.id,
          preference_status: status,
        }),
      });
      await load();
    } catch (e: any) {
      // Server rejects opt-in when not qualified — surface its reason.
      setError(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  async function requestUnlock(item: Eligibility) {
    setError(null);
    setRequesting(item.id);
    try {
      await apiFetch("/api/workers/me/service-qualification-requests", {
        method: "POST",
        body: JSON.stringify({
          target_type: item.target_type,
          target_id: item.id,
        }),
      });
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setRequesting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Care Packages I Can Provide</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Opt in to the care packages you want to serve. Locked packages require a
            higher tier, certificate, or a passed assessment first.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => {
            const optedIn = item.preference_status === "OPTED_IN";
            const locked = !item.can_opt_in && !optedIn;
            const pendingReview = item.qualification_status === "QUALIFIED_PENDING_APPROVAL";
            const risky = (item.risk_level ?? "").toUpperCase() === "HIGH";
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border px-4 py-3.5 flex items-center gap-3",
                  optedIn ? "border-emerald-200 bg-emerald-50" : locked ? "border-border bg-muted/40" : "border-border bg-card"
                )}
              >
                <span className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                  locked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                )}>
                  {locked ? <Lock size={16} /> : risky ? <Syringe size={16} /> : <Check size={16} />}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-foreground truncate">{item.name}</p>
                    {item.min_tier && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {item.min_tier}
                      </span>
                    )}
                    {risky && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        <ShieldAlert size={10} /> High risk
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    {optedIn
                      ? "You are offering this care package"
                      : pendingReview
                        ? "Unlock request is waiting for reviewer approval"
                      : locked
                        ? (item.locked_reason ?? "Not qualified yet")
                        : "Available to opt in"}
                  </p>
                </div>

                {optedIn ? (
                  <button
                    onClick={() => setPreference(item, "OPTED_OUT")}
                    disabled={busy === item.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-muted disabled:opacity-40"
                  >
                    {busy === item.id ? "…" : "Opt out"}
                  </button>
                ) : locked ? (
                  pendingReview ? (
                    <span className="text-[11px] font-semibold text-amber-700">Requested</span>
                  ) : (
                    <button
                      onClick={() => requestUnlock(item)}
                      disabled={requesting === item.id}
                      className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      {requesting === item.id ? "…" : "Request unlock"}
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => setPreference(item, "OPTED_IN")}
                    disabled={busy === item.id}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
                  >
                    {busy === item.id ? "…" : "Opt in"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No care packages available yet. Ask an admin to add one.</p>
        )}
      </div>
    </div>
  );
}
