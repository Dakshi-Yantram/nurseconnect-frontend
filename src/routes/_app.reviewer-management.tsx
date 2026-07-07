import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Users, AlertTriangle, RefreshCw, RotateCcw, ToggleLeft, ToggleRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reviewer-management")({
  component: ReviewerManagement,
  head: () => ({ meta: [{ title: "Reviewer Management — NurseConnect" }] }),
});

type ReviewerRow = {
  id: string; user_id: string; name: string; email: string;
  is_active: boolean; can_review_nurse_documents: boolean;
  max_open_tickets: number; open_tickets: number; daily_assigned_count: number;
  specialization: string | null; last_assigned_at: string | null;
};
type UnassignedTicket = { id: string; nurse_id: string; priority: string; sla_due_at: string | null; created_at: string };

function ReviewerManagement() {
  const [reviewers, setReviewers] = useState<ReviewerRow[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rv, un] = await Promise.allSettled([
        apiFetch("/api/admin/reviewers"),
        apiFetch("/api/admin/review/unassigned"),
      ]);
      if (rv.status === "fulfilled") setReviewers(rv.value);
      if (un.status === "fulfilled") setUnassigned(un.value);
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(rp: ReviewerRow) {
    setBusy(rp.id);
    try {
      await apiFetch(`/api/admin/reviewers/${rp.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !rp.is_active }),
      });
      await load();
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setBusy(null); }
  }

  async function updateCapacity(rp: ReviewerRow, max: number) {
    setBusy(rp.id);
    try {
      await apiFetch(`/api/admin/reviewers/${rp.id}`, {
        method: "PUT",
        body: JSON.stringify({ max_open_tickets: max }),
      });
      await load();
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setBusy(null); }
  }

  async function retryAssign(ticketId: string) {
    setBusy(ticketId);
    try {
      await apiFetch(`/api/admin/review/tickets/${ticketId}/retry-assign`, { method: "POST" });
      await load();
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setBusy(null); }
  }

  async function manualReassign(ticketId: string, reviewerProfileId: string) {
    setBusy(ticketId);
    try {
      await apiFetch(`/api/admin/review/tickets/${ticketId}/reassign`, {
        method: "POST",
        body: JSON.stringify({ reviewer_profile_id: reviewerProfileId, reason: "Manual reassignment" }),
      });
      await load();
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setBusy(null); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-foreground">Reviewer Management</h1>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Workload, capacity, and unassigned tickets.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-muted">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-[12.5px] text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Unassigned tickets alert */}
        {unassigned.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-700" />
              <p className="text-[13.5px] font-bold text-amber-800">{unassigned.length} unassigned ticket{unassigned.length > 1 ? "s" : ""} — need attention</p>
            </div>
            <div className="space-y-2">
              {unassigned.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg bg-white/60 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-foreground">Ticket #{t.id.slice(0, 8)}</p>
                    <p className="text-[11.5px] text-muted-foreground">Priority: {t.priority} · Created {new Date(t.created_at).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => retryAssign(t.id)} disabled={busy === t.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">
                      {busy === t.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Auto-assign
                    </button>
                    <select defaultValue="" disabled={busy === t.id}
                      onChange={(e) => e.target.value && manualReassign(t.id, e.target.value)}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]">
                      <option value="">Assign to…</option>
                      {reviewers.filter((r) => r.is_active && r.open_tickets < r.max_open_tickets).map((r) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.open_tickets}/{r.max_open_tickets})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviewer workload table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Users size={15} className="text-primary" />
            <span className="text-[14px] font-bold text-foreground">Reviewers</span>
          </div>
          {reviewers.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No reviewer profiles yet. Create a user with the reviewer role and add their profile here.</p>
          ) : (
            <div className="divide-y divide-border">
              {reviewers.map((r) => {
                const pct = r.max_open_tickets > 0 ? (r.open_tickets / r.max_open_tickets) * 100 : 0;
                return (
                  <div key={r.id} className={cn("px-5 py-4", !r.is_active && "opacity-50")}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13.5px] font-semibold text-foreground">{r.name}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                            {r.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground">{r.email}{r.specialization ? ` · ${r.specialization}` : ""}</p>
                        <div className="mt-2 flex items-center gap-3">
                          {/* Workload bar */}
                          <div className="flex-1 max-w-[160px]">
                            <div className="flex justify-between text-[10.5px] text-muted-foreground mb-0.5">
                              <span>Open tickets</span>
                              <span>{r.open_tickets}/{r.max_open_tickets}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500")}
                                style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground">Today: {r.daily_assigned_count}</span>
                          {r.last_assigned_at && (
                            <span className="text-[11px] text-muted-foreground">Last: {new Date(r.last_assigned_at).toLocaleTimeString("en-IN")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Capacity control */}
                        <select value={r.max_open_tickets} disabled={busy === r.id}
                          onChange={(e) => updateCapacity(r, Number(e.target.value))}
                          className="rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]">
                          {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
                            <option key={n} value={n}>Max {n}</option>
                          ))}
                        </select>
                        {/* Active toggle */}
                        <button onClick={() => toggleActive(r)} disabled={busy === r.id}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-40">
                          {r.is_active ? <ToggleRight size={24} className="text-emerald-600" /> : <ToggleLeft size={24} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
