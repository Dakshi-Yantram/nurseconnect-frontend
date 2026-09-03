import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, XCircle, Send, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/payout-approvals")({ component: PayoutApprovalsPage });

interface PayoutRow {
  id: string;
  worker_id: string;
  worker_name: string | null;
  worker_has_bank: boolean;
  booking_id: string;
  gross_amount: number;
  tds_deducted: number;
  net_amount: number;
  status: string;
  approval_status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function PayoutApprovalsPage() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/admin/worker-payouts")
      .then((data: PayoutRow[]) => setRows(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load payouts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/worker-payouts/${id}/approve`, { method: "POST" });
      toast.success("Payout approved — ready to process");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error("Give a reason for rejecting"); return; }
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/worker-payouts/${id}/reject-approval`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      toast.success("Payout rejected");
      setRejectingId(null);
      setRejectReason("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const process = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/worker-payouts/${id}/process`, { method: "POST" });
      toast.success("Payout processed");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Process failed");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = rows.filter((r) => {
    const matchesQuery = !query || (r.worker_name ?? "").toLowerCase().includes(query.toLowerCase());
    const matchesApproval = approvalFilter === "all" || r.approval_status === approvalFilter;
    return matchesQuery && matchesApproval;
  });

  const pendingCount = rows.filter((r) => r.approval_status === "pending").length;
  const approvedUnpaidCount = rows.filter((r) => r.approval_status === "approved" && r.status !== "paid").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold leading-tight">Payout Approvals</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Every worker payout needs an explicit admin approval before it can be processed. Net amount already reflects
          the 80/20 nurse/platform split and TDS.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Awaiting Approval</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-amber-600">{pendingCount}</div>
        </div>
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Approved, Not Yet Paid</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-sky-600">{approvedUnpaidCount}</div>
        </div>
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Total Payouts</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums">{rows.length}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-9 pl-8 pr-3 text-[13px] rounded-md border border-border bg-background"
            placeholder="Search nurse name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setApprovalFilter(f)}
            className={`h-9 px-3 text-[12.5px] rounded-md border ${approvalFilter === f ? "bg-blue-50 border-blue-200 text-blue-700" : "border-border text-muted-foreground"}`}
          >
            {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="nc-card p-4 text-[13px] text-rose-600">{error}</div>}

      <Card padded={false}>
        <div className="divide-y divide-border">
          {loading && <div className="px-5 py-6 text-[13px] text-muted-foreground">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-5 py-6 text-[13px] text-muted-foreground">No payouts match this filter.</div>
          )}
          {!loading && filtered.map((p) => (
            <div key={p.id} className="px-4 sm:px-5 py-3.5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{p.worker_name ?? "Unknown worker"}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">
                    Gross {inr(p.gross_amount)} · TDS {inr(p.tds_deducted)} · Net (80%) {inr(p.net_amount)} · Created {formatDate(p.created_at)}
                  </div>
                  {!p.worker_has_bank && (
                    <div className="text-[11px] text-rose-600 mt-0.5">No bank details on file — process will fail until added.</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusChip label={p.approval_status} tone={p.approval_status === "approved" ? "success" : p.approval_status === "rejected" ? "danger" : "warning"} />
                  <StatusChip label={p.status} tone={statusToneFor(p.status)} />
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                {p.approval_status !== "approved" && p.status !== "paid" && (
                  <button
                    onClick={() => approve(p.id)}
                    disabled={busyId === p.id}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md bg-emerald-600 text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                )}
                {p.approval_status !== "rejected" && p.status !== "paid" && (
                  rejectingId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="h-8 px-2 text-[12.5px] rounded-md border border-border"
                        placeholder="Reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <button onClick={() => reject(p.id)} disabled={busyId === p.id} className="h-8 px-2 text-[12.5px] rounded-md bg-rose-600 text-white">Confirm</button>
                      <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="h-8 px-2 text-[12.5px] rounded-md border border-border">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRejectingId(p.id)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-rose-200 text-rose-600"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  )
                )}
                {p.approval_status === "approved" && p.status !== "paid" && (
                  <button
                    onClick={() => process(p.id)}
                    disabled={busyId === p.id}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md bg-blue-600 text-white disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" /> Process payout
                  </button>
                )}
                {p.status === "paid" && (
                  <span className="text-[11.5px] text-muted-foreground">Paid {formatDate(p.paid_at)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
