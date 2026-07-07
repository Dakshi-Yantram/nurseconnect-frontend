import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { ApprovePayoutModal } from "@/components/shared/ApprovePayoutModal";
import { ApprovalSuccessModal } from "@/components/shared/ApprovalSuccessModal";
import { PAYOUTS, REVENUE_TREND, LEDGER } from "@/lib/mock-data";
import { Wallet, TrendingUp, RefreshCw, Receipt, ArrowLeft } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/financial-reconciliation")({ component: FinanceReconPage });

interface PayoutRow { id: string; batch: string; nurses: number; gross: string; commission: string; net: string; date: string; status: string; }
interface AuditEntry { id: string; action: string; entity: string; entityId: string; user: string; timestamp: string; }

function formatTimestamp(d: Date) {
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function FinanceReconPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutRow[]>(PAYOUTS as PayoutRow[]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [approving, setApproving] = useState<PayoutRow | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ batchId: string; batchName: string; netPayout: string; approvedAt: string; } | null>(null);

  function handleApproveClick(row: PayoutRow) { setApproving(row); }
  function handleModalCancel() { setApproving(null); }
  function handleModalApprove() {
    if (!approving) return;
    const now = new Date();
    const approvedAt = formatTimestamp(now);
    setPayouts(prev => prev.map(p => (p.id === approving.id ? { ...p, status: "approved" } : p)));
    const entry: AuditEntry = { id: `AUD-${Date.now()}`, action: "Batch Approved", entity: "Payout Batch", entityId: approving.id, user: "Admin User", timestamp: approvedAt };
    setAuditLog(prev => [entry, ...prev]);
    setApproving(null);
    setSuccessInfo({ batchId: approving.id, batchName: approving.batch, netPayout: approving.net, approvedAt });
  }
  function handleSuccessClose() { setSuccessInfo(null); }

  return (
    <>
      {approving && <ApprovePayoutModal batch={approving} onCancel={handleModalCancel} onApprove={handleModalApprove} />}
      {successInfo && <ApprovalSuccessModal batchId={successInfo.batchId} batchName={successInfo.batchName} netPayout={successInfo.netPayout} approvedBy="Admin User" approvedAt={successInfo.approvedAt} onClose={handleSuccessClose} />}

      <div className="space-y-6">
        <button onClick={() => router.history.back()} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Gross Revenue (MTD)" value="₹8.4L" trend="+24%" icon={Wallet} tone="primary" />
          <KpiCard label="Net Payouts" value="₹6.6L" trend="+19%" icon={TrendingUp} tone="success" />
          <KpiCard label="Refunds Issued" value="₹42K" hint="14 refunds" icon={RefreshCw} tone="warning" />
          <KpiCard label="Pending Reconciliation" value="₹1.2L" hint="3 batches" icon={Receipt} tone="purple" />
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

        <Card title="Payout Batches" padded={false}>
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
                  <td className="px-5 py-3 font-mono text-[12px]">{p.id}</td>
                  <td className="px-5 py-3 font-medium">{p.batch}</td>
                  <td className="px-5 py-3">{p.nurses}</td>
                  <td className="px-5 py-3">{p.gross}</td>
                  <td className="px-5 py-3">{p.commission}</td>
                  <td className="px-5 py-3 font-semibold">{p.net}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.date}</td>
                  <td className="px-5 py-3"><StatusChip tone={p.status === "approved" ? "success" : "warning"} label={p.status} dot /></td>
                  <td className="px-5 py-3">{p.status === "pending" && <button onClick={() => handleApproveClick(p)} className="px-3 py-1.5 text-[12px] rounded-md bg-primary text-white hover:bg-primary/90 transition-colors">Approve</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                    <td className="px-5 py-3 font-mono text-[12px]">{e.entityId}</td>
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