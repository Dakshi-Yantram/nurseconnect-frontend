import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Users, UserPlus, HelpCircle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/operations/")({
  component: OperationsHome,
  head: () => ({ meta: [{ title: "Operations — NurseConnect" }] }),
});

interface StaffAccount {
  id: string; full_name: string; email: string; phone_e164: string; role: string;
}

function OperationsHome() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/admin/staff")
      .then(setStaff)
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    support: staff.filter(s => s.role === "support").length,
    clinical_training_lead: staff.filter(s => s.role === "clinical_training_lead").length,
    clinical_trainer: staff.filter(s => s.role === "clinical_trainer").length,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-foreground">Welcome, {user?.name ?? "Operations"}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage staff accounts and help-center content.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Support Staff" value={loading ? "—" : counts.support} icon={Users} tone="primary" />
        <KpiCard label="Training Leads" value={loading ? "—" : counts.clinical_training_lead} icon={Users} tone="success" />
        <KpiCard label="Clinical Trainers" value={loading ? "—" : counts.clinical_trainer} icon={Users} tone="purple" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/operations/staff" className="group flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 hover:border-primary/30 hover:bg-muted/40 transition-all">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <UserPlus size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-foreground group-hover:text-primary transition-colors">Staff Accounts</p>
            <p className="text-[12px] text-muted-foreground">Create support, training lead, and trainer accounts</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </Link>

        <Link to="/operations/faq" className="group flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 hover:border-primary/30 hover:bg-muted/40 transition-all">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <HelpCircle size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-foreground group-hover:text-primary transition-colors">FAQ Management</p>
            <p className="text-[12px] text-muted-foreground">Manage help-center FAQs for consumers and nurses</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </Link>
      </div>

      <Card title="Recently Added Staff" padded={false}>
        {loading ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : staff.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">No staff accounts yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5">Name</th><th className="px-5 py-2.5">Email</th><th className="px-5 py-2.5">Role</th>
            </tr></thead>
            <tbody>
              {staff.slice(0, 8).map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{s.full_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.email}</td>
                  <td className="px-5 py-3 capitalize">{s.role.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
