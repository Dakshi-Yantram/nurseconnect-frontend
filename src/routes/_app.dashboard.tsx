import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useAuth } from "@/lib/auth-context";
import type { Permission } from "@/lib/rbac";
import {
  Users, HeartPulse, Activity as ActivityIcon, Wallet, Star, CheckCircle2, Timer,
  ArrowRight, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  KPIS, BOOKING_TREND, SERVICE_DISTRIBUTION, REGIONS, ALERTS, ACTIVITY,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — NurseConnect" }] }),
});

const PIE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4"];

function DashboardPage() {
  const { user } = useAuth();
  const greeting = user ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome";

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
        <KpiCard label="Total Patients" value="2,847" trend="+12%" hint="+342 this month" icon={Users} tone="primary" />
        <KpiCard label="Active Nurses" value="156" trend="+8%" hint="12 pending approval" icon={HeartPulse} tone="success" />
        <KpiCard label="Active Visits Today" value="42" trend="Live" hint="86 completed today" icon={ActivityIcon} tone="warning" />
        <KpiCard label="Revenue This Month" value="₹8.4L" trend="+24%" hint="Target: ₹10L" icon={Wallet} tone="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Avg. Rating" value={<span>4.8 <span className="text-amber-500">★</span></span>} hint="Based on 1,247 reviews" icon={Star} tone="warning" />
        <KpiCard label="Completion Rate" value="97.5%" hint="2,456 / 2,520 visits" icon={CheckCircle2} tone="success" />
        <KpiCard label="Avg. Response Time" value="12 min" hint="Booking to assignment" icon={Timer} tone="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Booking Trends" className="lg:col-span-2" action={<select className="text-[12px] border rounded px-2 py-1 bg-card"><option>Last 7 days</option><option>Last 30 days</option></select>}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={BOOKING_TREND}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="bookings" stroke="#2563EB" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="completed" stroke="#10B981" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Service Distribution" action={<Link to="/visits" className="text-primary font-medium">View Details</Link>}>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={SERVICE_DISTRIBUTION} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={2}>
                  {SERVICE_DISTRIBUTION.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {SERVICE_DISTRIBUTION.map((s, i) => (
              <li key={s.name} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} /> {s.name}</span>
                <span className="text-muted-foreground"><b className="text-foreground">{s.value}</b> · {s.growth}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="System Alerts & Actions Required" className="lg:col-span-2">
          <ul className="divide-y divide-border -my-2">
            {ALERTS.map(a => (
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
            {ACTIVITY.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-[11px] font-semibold text-foreground shrink-0">
                  {a.who[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-foreground"><b>{a.who}</b> {a.what} <span className="text-primary">{a.target}</span></div>
                  <div className="text-[11px] text-muted-foreground">{a.when}</div>
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
              <th className="px-5 py-2.5 font-medium">Change</th>
              <th className="px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {REGIONS.map(r => (
              <tr key={r.city} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{r.city}</td>
                <td className="px-5 py-3">{r.nurses}</td>
                <td className="px-5 py-3">{r.patients}</td>
                <td className="px-5 py-3">{r.visits}</td>
                <td className="px-5 py-3">{r.revenue}</td>
                <td className="px-5 py-3"><StatusChip tone="success" label={`↗ +${r.change}%`} /></td>
                <td className="px-5 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
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
