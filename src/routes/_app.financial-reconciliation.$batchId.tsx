import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Timeline } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { PAYOUTS, LEDGER } from "@/lib/mock-data";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/financial-reconciliation/$batchId")({ component: BatchDetail });

function BatchDetail() {
  const { batchId } = useParams({ from: "/_app/financial-reconciliation/$batchId" });
  const nav = useNavigate();
  const p = PAYOUTS.find(x => x.id === batchId) ?? PAYOUTS[0];

  return (
    <DetailShell
      backTo="/financial-reconciliation" backLabel="Back to Reconciliation"
      eyebrow={`Payout Batch · ${p.id}`} title={p.batch}
      status={p.status}
      subtitle={`${p.nurses} nurses · processed ${p.date}`}
      actions={<>
        <ActionBtn onClick={() => toast.success("Statement exported")}><Download className="h-4 w-4" /> Export</ActionBtn>
        <ActionBtn onClick={() => toast.message("Reconciliation re-run")}><RefreshCw className="h-4 w-4" /> Re-run</ActionBtn>
        {p.status === "pending" && <ActionBtn tone="success" onClick={() => { toast.success("Batch approved"); nav({ to: "/financial-reconciliation" }); }}><CheckCircle2 className="h-4 w-4" /> Approve Batch</ActionBtn>}
      </>}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { l: "Gross", v: p.gross },
          { l: "Commission", v: p.commission },
          { l: "Net Payout", v: p.net, hl: true },
          { l: "Nurses", v: p.nurses },
        ].map(s => (
          <div key={s.l} className={`nc-card p-5 ${s.hl ? "border-primary/40" : ""}`}>
            <div className="text-[12px] text-muted-foreground">{s.l}</div>
            <div className={`mt-1 text-[22px] font-semibold ${s.hl ? "text-primary" : ""}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <Card title="Per-Nurse Breakdown" padded={false}>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-muted/40 text-muted-foreground text-left">
            <th className="px-5 py-2.5">Nurse</th><th className="px-5 py-2.5">Visits</th>
            <th className="px-5 py-2.5">Gross</th><th className="px-5 py-2.5">Commission</th>
            <th className="px-5 py-2.5">Adjustments</th><th className="px-5 py-2.5">Net</th><th className="px-5 py-2.5">Status</th>
          </tr></thead>
          <tbody>
            {[
              { n: "NUR-2001 · Priya Sharma", v: 22, g: "₹52,800", c: "₹7,920", a: "—", net: "₹44,880" },
              { n: "NUR-2002 · Sarah Johnson", v: 14, g: "₹33,600", c: "₹5,040", a: "—", net: "₹28,560" },
              { n: "NUR-2004 · Asha Nair", v: 18, g: "₹43,200", c: "₹6,480", a: "-₹600", net: "₹36,120" },
              { n: "NUR-2005 · Deepak Singh", v: 9, g: "₹21,600", c: "₹3,240", a: "—", net: "₹18,360" },
            ].map(r => (
              <tr key={r.n} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{r.n}</td>
                <td className="px-5 py-3">{r.v}</td>
                <td className="px-5 py-3">{r.g}</td>
                <td className="px-5 py-3">{r.c}</td>
                <td className="px-5 py-3 text-muted-foreground">{r.a}</td>
                <td className="px-5 py-3 font-semibold">{r.net}</td>
                <td className="px-5 py-3"><StatusChip tone="success" label="reconciled" dot /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Ledger Entries" padded={false}>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-muted/40 text-muted-foreground text-left">
            <th className="px-5 py-2.5">Entry</th><th className="px-5 py-2.5">Booking</th>
            <th className="px-5 py-2.5">Date</th><th className="px-5 py-2.5">Debit</th>
            <th className="px-5 py-2.5">Credit</th><th className="px-5 py-2.5">Amount</th>
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

      <Card title="Reconciliation Timeline">
        <Timeline items={[
          { ts: p.date, title: `Batch ${p.status === "approved" ? "approved & disbursed" : "pending approval"}`, tone: p.status === "approved" ? "success" : "warning" },
          { ts: p.date, title: "Auto-reconciliation completed", meta: "system", tone: "primary" },
          { ts: p.date, title: "Batch generated from completed visits", tone: "muted" },
        ]} />
      </Card>
    </DetailShell>
  );
}
