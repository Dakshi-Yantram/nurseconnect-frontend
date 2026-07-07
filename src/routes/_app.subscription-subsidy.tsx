import { createFileRoute } from "@tanstack/react-router";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { SUBSCRIPTIONS, SUBSIDY_RECIPIENTS } from "@/lib/mock-data";
import { CreditCard, Users, TrendingUp, Heart } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/subscription-subsidy")({ component: SubsPage });

const MRR_TREND = [
  { m: "Dec", mrr: 18.2 }, { m: "Jan", mrr: 19.4 }, { m: "Feb", mrr: 20.1 },
  { m: "Mar", mrr: 21.3 }, { m: "Apr", mrr: 22.0 }, { m: "May", mrr: 22.5 },
];

function SubsPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Total Subscribers" value="2,144" trend="+11%" icon={Users} tone="primary" />
        <KpiCard label="MRR" value="₹22.5L" trend="+8%" icon={CreditCard} tone="success" />
        <KpiCard label="Avg. Churn" value="1.6%" hint="last 30 days" icon={TrendingUp} tone="warning" />
        <KpiCard label="Subsidy Recipients" value="386" hint="BPL + Senior" icon={Heart} tone="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="MRR Trend (₹ Lakhs)" className="lg:col-span-2">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MRR_TREND}>
                <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="m" fontSize={12} stroke="#94A3B8" /><YAxis fontSize={12} stroke="#94A3B8" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="mrr" stroke="#8B5CF6" fill="url(#ga)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Plan Breakdown">
          <ul className="space-y-3">
            {SUBSCRIPTIONS.map(s => (
              <li key={s.plan} className="p-3 rounded-md border border-border">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">{s.plan}</div>
                  <StatusChip tone="success" label={s.growth} />
                </div>
                <div className="text-[11px] text-muted-foreground">{s.price}</div>
                <div className="mt-2 grid grid-cols-3 text-center text-[12px]">
                  <div><b>{s.subscribers}</b><div className="text-[10px] text-muted-foreground">Subs</div></div>
                  <div><b>{s.mrr}</b><div className="text-[10px] text-muted-foreground">MRR</div></div>
                  <div><b>{s.churn}</b><div className="text-[10px] text-muted-foreground">Churn</div></div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Subsidy Recipients" padded={false}>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-muted/40 text-muted-foreground text-left">
            <th className="px-5 py-2.5">ID</th><th className="px-5 py-2.5">Patient</th><th className="px-5 py-2.5">Scheme</th>
            <th className="px-5 py-2.5">Verified</th><th className="px-5 py-2.5">Monthly Cap</th><th className="px-5 py-2.5">Used</th>
            <th className="px-5 py-2.5">Expires</th>
          </tr></thead>
          <tbody>
            {SUBSIDY_RECIPIENTS.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-[12px]">{r.id}</td>
                <td className="px-5 py-3 font-medium">{r.patient}</td>
                <td className="px-5 py-3"><StatusChip tone="purple" label={r.scheme} /></td>
                <td className="px-5 py-3">{r.verified ? <StatusChip tone="success" label="Verified" /> : <StatusChip tone="warning" label="Pending" />}</td>
                <td className="px-5 py-3">{r.monthlyCap}</td><td className="px-5 py-3">{r.used}</td>
                <td className="px-5 py-3 text-muted-foreground">{r.expires}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
