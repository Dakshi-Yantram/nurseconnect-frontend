import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Users, AlertTriangle, RefreshCw, RotateCcw, ToggleLeft, ToggleRight, UserPlus } from "lucide-react";
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

  // Add Reviewer form
  const [showAddForm, setShowAddForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [maxTickets, setMaxTickets] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

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

  async function submitAddReviewer(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setFormError("All fields are required");
      return;
    }
    setSubmitting(true);
    try {
      // Two-step: create the reviewer-role user account, then the
      // ReviewerProfile row that drives assignment/capacity for them.
      const user = await apiFetch("/api/admin/staff/reviewer", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone_e164: phone.trim(),
          password,
          role: "reviewer",
        }),
      });
      await apiFetch("/api/admin/reviewers", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          is_active: true,
          can_review_nurse_documents: true,
          max_open_tickets: maxTickets,
          specialization: specialization.trim() || null,
        }),
      });
      setFormSuccess(`${fullName.trim()} added as a reviewer`);
      setFullName(""); setEmail(""); setPhone(""); setPassword(""); setSpecialization(""); setMaxTickets(20);
      setShowAddForm(false);
      await load();
    } catch (err: any) {
      setFormError(String(err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
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
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddForm((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90">
              <UserPlus size={13} /> Add Reviewer
            </button>
            <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-muted">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-[13.5px] font-bold text-foreground mb-3">New reviewer</p>
            <form onSubmit={submitAddReviewer} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-foreground">Full name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground">Specialization (optional)</label>
                <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="e.g. ICU documentation"
                  className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground">Mobile number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9999900001"
                  className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground">Temporary password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
                <p className="mt-1 text-[11px] text-muted-foreground">8+ characters, with uppercase, lowercase, and a number.</p>
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground">Starting capacity</label>
                <select value={maxTickets} onChange={(e) => setMaxTickets(Number(e.target.value))}
                  className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40">
                  {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => <option key={n} value={n}>Max {n}</option>)}
                </select>
              </div>

              {formError && (
                <div className="sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</div>
              )}
              {formSuccess && (
                <div className="sm:col-span-2 text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{formSuccess}</div>
              )}

              <div className="sm:col-span-2 flex gap-2">
                <button disabled={submitting} type="submit"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-md font-medium hover:opacity-95 disabled:opacity-60 transition text-[13px]">
                  <UserPlus className="h-4 w-4" />
                  {submitting ? "Creating…" : "Create reviewer"}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 rounded-md font-medium text-[13px] text-muted-foreground hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

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
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No reviewers yet. Use "Add Reviewer" above to create one.</p>
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