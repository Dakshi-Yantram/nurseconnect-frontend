import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { Permission } from "@/lib/rbac";
import {
  Users, HeartPulse, Activity as ActivityIcon, Wallet, Star, CheckCircle2, Timer,
  ArrowRight, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — NurseConnect" }] }),
});

const PIE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4"];

interface Kpis {
  total_patients: number; active_nurses: number; active_visits: number;
  revenue: number; avg_rating: number; completion_rate: number;
}
interface TrendRow { date: string; bookings: number; completed: number }
interface DistRow { name: string; value: number; pct: number }
interface AlertRow { id: string; label: string; priority: string; action: string; to: string }
interface ActivityRow { who: string; what: string; target: string; when: string }
interface RegionRow { city: string; nurses: number; patients: number; visits: number; revenue: number }

function DashboardPage() {
  const { user } = useAuth();
  const greeting = user ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome";

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [distribution, setDistribution] = useState<DistRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/admin/dashboard/kpis").catch(() => null),
      apiFetch("/api/admin/dashboard/booking-trend").catch(() => []),
      apiFetch("/api/admin/dashboard/service-distribution").catch(() => []),
      apiFetch("/api/admin/dashboard/alerts").catch(() => []),
      apiFetch("/api/admin/dashboard/activity").catch(() => []),
      apiFetch("/api/admin/regions").catch(() => []),
    ]).then(([k, t, d, a, act, r]) => {
      setKpis(k); setTrend(t); setDistribution(d); setAlerts(a); setActivity(act); setRegions(r);
    }).finally(() => setLoading(false));
  }, []);

  const quickActions: { label: string; to: string; permission: Permission }[] = [
    { label: "Approve Nurses",     to: "/nurse-approval",            permission: "users.approve" },
    { label: "Manage Users",       to: "/users/patients",            permission: "users.view" },
    { label: "Clinical Escalations", to: "/clinical-escalation",     permission: "clinical.escalation" },
    { label: "View Financials",    to: "/financial-reconciliation",  permission: "finance.reconciliation" },
    { label: "Open Incidents",     to: "/incidents",                 permission: "trust.incidents" },
    { label: "Audit Logs",         to: "/audit-logs",                permission: "compliance.audit" },
  ];
  const visibleActions = quickActions.filter((q) => user && (
    // inline check via context — keeps page free of role literals
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    true
  ));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[18px] font-semibold text-foreground">{greeting}</div>
          <div className="text-[12.5px] text-muted-foreground">
            Operational overview tailored to your role.
          </div>
        </div>
        {user && <RoleBadge role={user.role} />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Patients" value={loading ? "—" : (kpis?.total_patients ?? 0).toLocaleString()} icon={Users} tone="primary" />
        <KpiCard label="Active Nurses" value={loading ? "—" : (kpis?.active_nurses ?? 0).toLocaleString()} icon={HeartPulse} tone="success" />
        <KpiCard label="Active Visits Now" value={loading ? "—" : kpis?.active_visits ?? 0} icon={ActivityIcon} tone="warning" />
        <KpiCard label="Revenue (captured)" value={loading ? "—" : `₹${((kpis?.revenue ?? 0) / 100000).toFixed(1)}L`} icon={Wallet} tone="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiCard label="Avg. Nurse Rating" value={loading ? "—" : <span>{kpis?.avg_rating ?? 0} <span className="text-amber-500">★</span></span>} icon={Star} tone="warning" />
        <KpiCard label="Completion Rate" value={loading ? "—" : `${kpis?.completion_rate ?? 0}%`} icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Booking Trends (7 days)" className="lg:col-span-2">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="bookings" stroke="#2563EB" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="completed" stroke="#10B981" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Service Distribution" action={<Link to="/visits" className="text-primary font-medium">View Details</Link>}>
          {distribution.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-muted-foreground">No completed bookings yet.</div>
          ) : (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={2}>
                      {distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {distribution.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {s.name}</span>
                    <span className="text-muted-foreground"><b className="text-foreground">{s.value}</b> · {s.pct}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="System Alerts & Actions Required" className="lg:col-span-2">
          <ul className="divide-y divide-border -my-2">
            {alerts.length === 0 && <li className="py-3 text-[12.5px] text-muted-foreground">No alerts.</li>}
            {alerts.map(a => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusChip
                    tone={a.priority === "high" ? "danger" : a.priority === "medium" ? "warning" : "success"}
                    label={a.priority === "high" ? "High" : a.priority === "medium" ? "Medium" : "Low"}
                    dot
                  />
                  <span className="text-[13px] text-foreground font-medium truncate">{a.label}</span>
                </div>
                <Link to={a.to} className="text-[12px] text-primary font-medium inline-flex items-center gap-1 whitespace-nowrap">
                  {a.action} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recent Admin Activity" action={<Link to="/audit-logs" className="text-primary font-medium">View All</Link>}>
          <ul className="space-y-3">
            {activity.length === 0 && <li className="text-[12.5px] text-muted-foreground">No recent activity.</li>}
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-[11px] font-semibold text-foreground shrink-0">
                  {a.who[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-foreground"><b>{a.who}</b> {a.what} <span className="text-primary">{a.target}</span></div>
                  <div className="text-[11px] text-muted-foreground">{new Date(a.when).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Regional Performance" action={<Link to="/ops-dashboard" className="text-primary font-medium">Open Live Ops →</Link>} padded={false}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5 font-medium">Location</th>
              <th className="px-5 py-2.5 font-medium">Nurses</th>
              <th className="px-5 py-2.5 font-medium">Patients</th>
              <th className="px-5 py-2.5 font-medium">Visits</th>
              <th className="px-5 py-2.5 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {regions.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No regional data yet.</td></tr>
            )}
            {regions.map(r => (
              <tr key={r.city} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{r.city}</td>
                <td className="px-5 py-3">{r.nurses}</td>
                <td className="px-5 py-3">{r.patients}</td>
                <td className="px-5 py-3">{r.visits}</td>
                <td className="px-5 py-3">₹{r.revenue.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {visibleActions.map((q) => (
            <PermissionGate key={q.to} permission={q.permission}>
              <Link to={q.to} className="px-4 py-4 rounded-md border border-border hover:bg-muted/40 hover:border-primary/40 transition text-[13px] font-medium text-foreground flex items-center justify-between">
                {q.label} <ArrowRight className="h-4 w-4 text-primary" />
              </Link>
            </PermissionGate>
          ))}
        </div>
      </Card>
    </div>
  );
}
