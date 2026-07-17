import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2, ShieldCheck, Clock, AlertTriangle, UserCheck,
  XCircle, FileText, ExternalLink, RefreshCw, CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/nurse-approval")({
  component: NurseApproval,
  head: () => ({ meta: [{ title: "Nurse Approval — NurseConnect" }] }),
});

const REQUIRED_DOCS = ["aadhaar", "nursing_license", "degree_certificate", "police_verification"];
const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  nursing_license: "Nursing License",
  degree_certificate: "Degree / Education Certificate",
  police_verification: "Police Verification",
};
const TIERS = [
  { id: "tier1", label: "Tier 1 · Care Support" },
  { id: "tier2", label: "Tier 2 · Assistant Nurse" },
  { id: "tier3", label: "Tier 3 · Registered Nurse (injections/IV)" },
  { id: "tier4", label: "Tier 4 · Specialist Nurse" },
  { id: "tier5", label: "Tier 5 · Clinical Lead" },
];

type TicketEntry = {
  id: string; nurse_id: string; status: string; priority: string;
  nurse_name?: string; nurse_email?: string; sla_due_at?: string | null;
};
type Doc = {
  id: string; document_type: string; verification_status: string;
  document_url: string | null; rejection_reason: string | null;
};
type WorkerDetail = {
  worker_id: string; full_name: string; email: string; phone: string;
  tier: string; background_check_status: string | null; documents: Doc[];
};

function priorityBadge(p: string) {
  if (p === "HIGH") return "bg-red-100 text-red-700";
  if (p === "MEDIUM") return "bg-amber-100 text-amber-700";
  return "bg-muted text-muted-foreground";
}

function NurseApproval() {
  const [tickets, setTickets] = useState<TicketEntry[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketEntry | null>(null);
  const [detail, setDetail] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, inReview, clarify] = await Promise.allSettled([
        apiFetch("/api/review/my-queue?status=PENDING_REVIEW"),
        apiFetch("/api/review/my-queue?status=IN_REVIEW"),
        apiFetch("/api/review/my-queue?status=NEEDS_CLARIFICATION"),
      ]);
      const all: TicketEntry[] = [
        ...(pending.status === "fulfilled" ? pending.value : []),
        ...(inReview.status === "fulfilled" ? inReview.value : []),
        ...(clarify.status === "fulfilled" ? clarify.value : []),
      ];
      setTickets(all);
      if (all.length > 0) setSelectedTicket((prev) => prev ?? all[0]);
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadQueue(); }, []);

  // Extracted so `act()` can call the exact same detail-fetch logic after a
  // mutation, not just on ticket selection change.
  const loadDetail = useCallback(async (ticket: TicketEntry | null) => {
    if (!ticket) { setDetail(null); return; }
    try {
      const rows: WorkerDetail[] = await apiFetch("/api/admin/workers/pending");
      setDetail(rows.find((r) => r.worker_id === ticket.nurse_id) ?? null);
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedTicket) { setDetail(null); return; }
    setLoadingDetail(true);
    loadDetail(selectedTicket).finally(() => setLoadingDetail(false));
  }, [selectedTicket, loadDetail]);

  async function act(fn: () => Promise<any>) {
    setError(null); setBusy(true);
    try {
      await fn();
      await loadQueue();
      // Document/tier/background/approve/reject actions all mutate the worker's
      // profile, but the `detail` state only refetches when `selectedTicket`
      // itself changes reference — which loadQueue() does NOT do (it preserves
      // the existing selection: `prev ?? all[0]`). Without this explicit
      // refetch, the PATCH/POST succeeds in the backend (confirmed 200 OK) but
      // the UI keeps showing the old "pending" status forever, because nothing
      // ever re-triggers the effect that loads `detail.documents`.
      await loadDetail(selectedTicket);
    }
    catch (e: any) {
      let msg = String(e?.message ?? e);
      try { const j = JSON.parse(msg); msg = j.detail?.message ?? j.detail ?? msg; } catch { }
      setError(msg);
    } finally { setBusy(false); }
  }

  const reviewDoc = (doc: Doc, status: "verified" | "rejected") => {
    const reason = status === "rejected" ? window.prompt("Reason for rejecting?") ?? "" : undefined;
    if (status === "rejected" && !reason) return;
    return act(() => apiFetch(`/api/admin/workers/${detail!.worker_id}/documents/${doc.id}`, {
      method: "PATCH", body: JSON.stringify({ status, reason }),
    }));
  };
  const setTier = (tier: string) =>
    act(() => apiFetch(`/api/admin/workers/${detail!.worker_id}/tier`, { method: "PATCH", body: JSON.stringify({ tier }) }));
  const setBackground = (status: "passed" | "failed") => {
    const reason = status === "failed" ? window.prompt("Reason?") ?? "" : undefined;
    if (status === "failed" && !reason) return;
    return act(() => apiFetch(`/api/admin/workers/${detail!.worker_id}/background-check`, { method: "POST", body: JSON.stringify({ status, reason }) }));
  };
  const updateTicketStatus = (status: string) =>
    act(() => apiFetch(`/api/review/tickets/${selectedTicket!.id}/status`, { method: "POST", body: JSON.stringify({ status }) }));
  const approve = () => act(() => apiFetch(`/api/admin/workers/${detail!.worker_id}/approve`, { method: "POST" }));
  const reject = () => {
    const reason = window.prompt("Reason for rejection?") ?? "";
    if (!reason) return;
    return act(() => apiFetch(`/api/admin/workers/${detail!.worker_id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }));
  };

  const verifiedTypes = new Set((detail?.documents ?? []).filter((d) => d.verification_status === "verified").map((d) => d.document_type));
  const allDocsVerified = REQUIRED_DOCS.every((t) => verifiedTypes.has(t));
  const backgroundPassed = detail?.background_check_status === "passed";
  const canApprove = allDocsVerified && backgroundPassed && !busy;

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[18px] font-bold text-foreground">My Review Queue</h1>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              Tickets auto-assigned to you. Priority HIGH → SLA deadline → oldest first.
            </p>
          </div>
          <button onClick={loadQueue} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-muted">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-[12.5px] text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-[13px] text-muted-foreground">
            No tickets assigned to you right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
            <div className="space-y-2">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => setSelectedTicket(t)}
                  className={cn("w-full text-left rounded-xl border px-4 py-3 transition-all",
                    t.id === selectedTicket?.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30")}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priorityBadge(t.priority))}>{t.priority}</span>
                    <span className="text-[10.5px] text-muted-foreground">{t.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">{t.nurse_name ?? "Nurse"}</p>
                  <p className="text-[11.5px] text-muted-foreground truncate">{t.nurse_email}</p>
                  {t.sla_due_at && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <Clock size={10} /> SLA {new Date(t.sla_due_at).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </button>
              ))}
            </div>

            {selectedTicket && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-muted-foreground">Status:</span>
                  {["IN_REVIEW", "NEEDS_CLARIFICATION"].map((s) => (
                    <button key={s} onClick={() => updateTicketStatus(s)} disabled={busy}
                      className="rounded-lg border border-border px-3 py-1 text-[11.5px] font-semibold hover:bg-muted disabled:opacity-40">
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>

                {loadingDetail ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
                ) : !detail ? (
                  <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">Profile not found.</div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-card px-5 py-4">
                      <p className="text-[15px] font-bold">{detail.full_name}</p>
                      <p className="text-[12.5px] text-muted-foreground">{detail.email} · {detail.phone}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                        <FileText size={14} className="text-primary" />
                        <span className="text-[13.5px] font-bold">Documents</span>
                      </div>
                      <div className="divide-y divide-border">
                        {REQUIRED_DOCS.map((type) => {
                          const doc = detail.documents.find((d) => d.document_type === type);
                          return (
                            <div key={type} className="px-5 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold">{DOC_LABELS[type]}</p>
                                <p className="text-[11.5px] text-muted-foreground">{doc ? doc.verification_status : "Not uploaded"}{doc?.rejection_reason ? ` · ${doc.rejection_reason}` : ""}</p>
                              </div>
                              {doc?.document_url && <a href={doc.document_url} target="_blank" rel="noreferrer" className="text-primary text-[12px] flex items-center gap-1">View <ExternalLink size={11} /></a>}
                              {doc ? (
                                doc.verification_status === "verified" ? (
                                  <CheckCircle2 size={17} className="text-emerald-600" />
                                ) : doc.verification_status === "rejected" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                                    <XCircle size={12} /> Rejected
                                  </span>
                                ) : (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => reviewDoc(doc, "verified")} disabled={busy} className="rounded bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-40">Verify</button>
                                    <button onClick={() => reviewDoc(doc, "rejected")} disabled={busy} className="rounded border border-red-300 px-2.5 py-1 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">Reject</button>
                                  </div>
                                )
                              ) : <span className="text-[11px] text-muted-foreground">Awaiting</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border bg-card px-5 py-4">
                        <p className="text-[12.5px] font-bold mb-2">Assign Skill Tier</p>
                        <select value={detail.tier} disabled={busy} onChange={(e) => setTier(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]">
                          {TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        <p className="text-[11px] text-muted-foreground mt-1.5">Tier 3+ can give injections/IV</p>
                      </div>
                      <div className="rounded-xl border border-border bg-card px-5 py-4">
                        <p className="text-[12.5px] font-bold mb-2">Background Check</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", backgroundPassed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                            {detail.background_check_status ?? "not started"}
                          </span>
                          {!backgroundPassed && <>
                            <button onClick={() => setBackground("passed")} disabled={busy} className="rounded bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-40">Passed</button>
                            <button onClick={() => setBackground("failed")} disabled={busy} className="rounded border border-red-300 px-2.5 py-1 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">Failed</button>
                          </>}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card px-5 py-4">
                      <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-3 flex-wrap">
                        <ShieldCheck size={14} className={allDocsVerified ? "text-emerald-600" : ""} /> All docs verified
                        <span>·</span>
                        <ShieldCheck size={14} className={backgroundPassed ? "text-emerald-600" : ""} /> Background passed
                      </div>
                      <div className="flex gap-2">
                        <button onClick={approve} disabled={!canApprove}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                          <UserCheck size={15} /> Approve & Activate
                        </button>
                        <button onClick={reject} disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">
                          <XCircle size={15} /> Reject
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}