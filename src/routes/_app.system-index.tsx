import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { Users, HeartPulse, Activity, Wallet, Network, ShieldCheck, AlertOctagon, CreditCard, Package, FileSearch, Database, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_app/system-index")({ component: SystemIndexPage });

const FLOWS = [
  { title: "Consumer Booking Flow", steps: ["Patient signs up", "Selects care package", "Books visit slot", "Nurse matched", "Visit completed", "Payment + rating"] },
  { title: "Nurse Onboarding Flow", steps: ["Application submitted", "Document verification", "Background check", "Reference check", "Final approval", "Active on roster"] },
  { title: "Clinical Escalation Flow", steps: ["Vital trigger detected", "Severity scored", "Notify family + doctor", "Resolution recorded", "Audit log written"] },
  { title: "Financial Reconciliation", steps: ["Visit completed", "Ledger entry", "Commission split", "Payout batch", "Bank settlement", "Audit"] },
];

const MODULES = [
  { icon: Users, label: "User Management", to: "/users/patients", color: "bg-blue-50 text-blue-600" },
  { icon: HeartPulse, label: "Nurse Management", to: "/users/nurses", color: "bg-emerald-50 text-emerald-600" },
  { icon: Activity, label: "Live Operations", to: "/ops-dashboard", color: "bg-amber-50 text-amber-600" },
  { icon: AlertOctagon, label: "Clinical Desk", to: "/clinical-escalation", color: "bg-rose-50 text-rose-600" },
  { icon: Wallet, label: "Financial Ops", to: "/financial-reconciliation", color: "bg-violet-50 text-violet-600" },
  { icon: Package, label: "Care Packages", to: "/care-packages", color: "bg-sky-50 text-sky-600" },
  { icon: FileSearch, label: "Insurance Review", to: "/insurance-review", color: "bg-fuchsia-50 text-fuchsia-600" },
{ icon: ShieldCheck, label: "Compliance", to: "/compliance", color: "bg-teal-50 text-teal-600" },
  { icon: Database, label: "Data Retention", to: "/retention-dashboard", color: "bg-indigo-50 text-indigo-600" },
  { icon: CreditCard, label: "Subscriptions", to: "/subscription-subsidy", color: "bg-pink-50 text-pink-600" },
  { icon: ScrollText, label: "Audit Logs", to: "/audit-logs", color: "bg-cyan-50 text-cyan-600" },
  { icon: Network, label: "System Index", to: "/system-index", color: "bg-orange-50 text-orange-600" },
];

function SystemIndexPage() {
  return (
    <div className="space-y-6">
      <Card title="Platform Overview">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "Modules Live", v: "20+" }, { l: "Active Workflows", v: "47" },
            { l: "API Endpoints", v: "186" }, { l: "Avg. Uptime (90d)", v: "99.97%" },
          ].map(s => (
            <div key={s.l} className="px-4 py-3 rounded-md bg-secondary">
              <div className="text-[11px] text-muted-foreground">{s.l}</div>
              <div className="text-[20px] font-semibold mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="System Modules">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MODULES.map(m => (
            <Link key={m.label} to={m.to} className="p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition flex items-center gap-3">
              <div className={`h-10 w-10 rounded-md grid place-items-center ${m.color}`}><m.icon className="h-5 w-5" /></div>
              <span className="text-[13px] font-medium">{m.label}</span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FLOWS.map(f => (
          <Card key={f.title} title={f.title}>
            <ol className="space-y-2">
              {f.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[11px] font-semibold">{i + 1}</div>
                  <div className="text-[13px] text-foreground">{s}</div>
                  {i < f.steps.length - 1 && <div className="flex-1 border-t border-dashed border-border" />}
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
