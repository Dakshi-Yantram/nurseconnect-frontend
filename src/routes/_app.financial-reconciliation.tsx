import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { ApprovePayoutModal } from "@/components/shared/ApprovePayoutModal";
import { ApprovalSuccessModal } from "@/components/shared/ApprovalSuccessModal";
import { REVENUE_TREND, LEDGER } from "@/lib/mock-data";
import { apiFetch } from "@/lib/api";
import { Wallet, TrendingUp, RefreshCw, Receipt, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/financial-reconciliation")({ component: FinanceReconPage });

// ---------------------------------------------------------------------------
// Mirrors app/api/v1/admin.py: GET /payouts, POST /payouts/{id}/approve.
//
// "Approve" here is a BATCH-LEVEL action: it approves every nurse payout
// inside the batch in one call (see the endpoint docstring). An admin who
// wants to review, approve, or reject nurses one at a time — rather than
// as a whole batch — should do that from the Payout Approvals screen
// instead; this button is for "I've reviewed this whole batch, release
// all of it."
// ---------------------------------------------------------------------------
interface PayoutBatchRow {
  id: string;
  batch: string;
  nurses: number;
  gross: number;
  commission: number;
  net_payout: number;
  date: string;
  approval_status: "pending" | "approved";
  pending_approval_count: number;
}

// The revenue-trend chart and the recent-ledger table below don't have a
// backing admin endpoint yet, so they still read from local sample data —
// only the payout batches table (the one with the "Approve" action users
// actually click) has been wired to the real backend.
interface AuditEntry { id: string; action: string; entity: string; entityId: string; user: string; timestamp: string; }

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(d: Date) {
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function FinanceReconPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [approving, setApproving] = useState<PayoutBatchRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ batchId: string; batchName: string; netPayout: string; approvedAt: string; } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/admin/payouts")
      .then((data: PayoutBatchRow[]) => setPayouts(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load payout batches"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  function handleApproveClick(row: PayoutBatchRow) { setApproving(row); }
  function handleModalCancel() { setApproving(null); }

  async function handleModalApprove() {
    if (!approving) return;
    setBusyId(approving.id);
    try {
      await apiFetch(`/api/admin/payouts/${approving.id}/approve`, { method: "POST" });
      const now = new Date();
      const approvedAt = formatTimestamp(now);
      const entry: AuditEntry = {
        id: `AUD-${Date.now()}`,
        action: "Batch Approved",
        entity: "Payout Batch",
        entityId: approving.id,
        user: "Admin User",
        timestamp: approvedAt,
      };
      setAuditLog((prev) => [entry, ...prev]);
      setSuccessInfo({
        batchId: approving.id,
        batchName: approving.batch,
        netPayout: inr(approving.net_payout),
        approvedAt,
      });
      setApproving(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }
  function handleSuccessClose() { setSuccessInfo(null); }

  return (
    <>
      {approving && (
        <ApprovePayoutModal
          batch={{
            id: approving.id,
            batch: approving.batch,
            date: approving.date,
            nurses: approving.nurses,
            gross: inr(approving.gross),
            commission: inr(approving.commission),
            net: inr(approving.net_payout),
          }}
          onCancel={handleModalCancel}
          onApprove={handleModalApprove}
        />
      )}
      {successInfo && <ApprovalSuccessModal batchId={successInfo.batchId} batchName={successInfo.batchName} netPayout={successInfo.netPayout} approvedBy="Admin User" approvedAt={successInfo.approvedAt} onClose={handleSuccessClose} />}

      <div className="space-y-6">
        <button onClick={() => router.history.back()} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Gross Revenue (MTD)" value="₹8.4L" trend="+24%" icon={Wallet} tone="primary" />
          <KpiCard label="Net Payouts" value="₹6.6L" trend="+19%" icon={TrendingUp} tone="success" />
          <KpiCard label="Refunds Issued" value="₹42K" hint="14 refunds" icon={RefreshCw} tone="warning" />
          <KpiCard
            label="Pending Reconciliation"
            value={String(payouts.filter((p) => p.approval_status === "pending").length)}
            hint={`${payouts.length} batches total`}
            icon={Receipt}
            tone="purple"
          />
        </div>

        <Card title="Revenue vs Payouts (₹ Lakhs)">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="m" fontSize={12} stroke="#94A3B8" />
                <YAxis fontSize={12} stroke="#94A3B8" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="payouts" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              Payout Batches
              <button onClick={load} className="text-muted-foreground hover:text-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </span>
          }
          padded={false}
        >
          {error && <div className="px-5 py-4 text-[13px] text-rose-600">{error}</div>}
          {loading ? (
            <div className="px-5 py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : payouts.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              No payout batches yet. Batches are created when nurse payouts are grouped for bulk release —
              individual payouts can still be reviewed and approved one at a time on Payout Approvals.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead><tr className="bg-muted/40 text-muted-foreground text-left">
                <th className="px-5 py-2.5 font-medium">Batch ID</th><th className="px-5 py-2.5 font-medium">Batch</th>
                <th className="px-5 py-2.5 font-medium">Nurses</th><th className="px-5 py-2.5 font-medium">Gross</th>
                <th className="px-5 py-2.5 font-medium">Commission</th><th className="px-5 py-2.5 font-medium">Net Payout</th>
                <th className="px-5 py-2.5 font-medium">Date</th><th className="px-5 py-2.5 font-medium">Status</th><th className="px-5 py-2.5 font-medium"></th>
              </tr></thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-[12px]">{p.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 font-medium">{p.batch}</td>
                    <td className="px-5 py-3">{p.nurses}</td>
                    <td className="px-5 py-3">{inr(p.gross)}</td>
                    <td className="px-5 py-3">{inr(p.commission)}</td>
                    <td className="px-5 py-3 font-semibold">{inr(p.net_payout)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-5 py-3">
                      <StatusChip
                        tone={p.approval_status === "approved" ? "success" : "warning"}
                        label={p.approval_status === "approved" ? "Approved" : `Pending (${p.pending_approval_count})`}
                        dot
                      />
                    </td>
                    <td className="px-5 py-3">
                      {p.approval_status === "pending" && (
                        <button
                          onClick={() => handleApproveClick(p)}
                          disabled={busyId === p.id}
                          className="px-3 py-1.5 text-[12px] rounded-md bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {auditLog.length > 0 && (
          <Card title="Audit Log" padded={false}>
            <table className="w-full text-[13px]">
              <thead><tr className="bg-muted/40 text-muted-foreground text-left">
                <th className="px-5 py-2.5 font-medium">Entry ID</th><th className="px-5 py-2.5 font-medium">Action</th>
                <th className="px-5 py-2.5 font-medium">Entity</th><th className="px-5 py-2.5 font-medium">Entity ID</th>
                <th className="px-5 py-2.5 font-medium">User</th><th className="px-5 py-2.5 font-medium">Timestamp</th>
              </tr></thead>
              <tbody>
                {auditLog.map(e => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-[12px]">{e.id}</td>
                    <td className="px-5 py-3"><StatusChip tone="success" label={e.action} dot /></td>
                    <td className="px-5 py-3">{e.entity}</td>
                    <td className="px-5 py-3 font-mono text-[12px]">{e.entityId.slice(0, 8)}</td>
                    <td className="px-5 py-3">{e.user}</td>
                    <td className="px-5 py-3 text-muted-foreground">{e.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Card title="Financial Ledger (recent)" padded={false}>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5 font-medium">Entry</th><th className="px-5 py-2.5 font-medium">Booking</th>
              <th className="px-5 py-2.5 font-medium">Date</th><th className="px-5 py-2.5 font-medium">Debit</th>
              <th className="px-5 py-2.5 font-medium">Credit</th><th className="px-5 py-2.5 font-medium">Amount</th>
            </tr></thead>
            <tbody>
              {LEDGER.map(e => (
                <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px]">{e.id}</td>
                  <td className="px-5 py-3 font-mono text-[12px]">#{e.booking}</td>
                  <td className="px-5 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-5 py-3"><StatusChip tone="info" label={e.debit} /></td>
                  <td className="px-5 py-3"><StatusChip tone="purple" label={e.credit} /></td>
                  <td className="px-5 py-3 font-semibold">{e.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
