import { Card } from "@/components/shared/Card";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck, FileText, AlertTriangle, Download, RefreshCw, Eye } from "lucide-react";

const ACTIONS = [
    { icon: ShieldCheck, label: "Run Compliance Audit",  desc: "Trigger a full policy audit across all entities",    tone: "text-emerald-600 bg-emerald-50 border-emerald-200", to: "/audit-logs",              toastMsg: "Compliance audit triggered" },
    { icon: AlertTriangle, label: "Review Violations",   desc: "View and triage all open compliance violations",     tone: "text-amber-600 bg-amber-50 border-amber-200",       to: "/incidents",               toastMsg: null },
    { icon: FileText, label: "Generate Report",          desc: "Export full compliance report as PDF",               tone: "text-blue-600 bg-blue-50 border-blue-200",          to: "/financial-reconciliation", toastMsg: "Report generation started" },
    { icon: RefreshCw, label: "Sync Policy Rules",       desc: "Pull latest rule definitions from policy engine",    tone: "text-violet-600 bg-violet-50 border-violet-200",    to: "/clinical-rule-sets",      toastMsg: "Policy rules synced" },
    { icon: Download, label: "Export Audit Trail",       desc: "Download immutable audit log as CSV",                tone: "text-sky-600 bg-sky-50 border-sky-200",             to: "/audit-logs",              toastMsg: "Audit trail exported" },
    { icon: Eye, label: "Review Consents",               desc: "Check expiring and blocked consent records",         tone: "text-slate-600 bg-slate-50 border-slate-200",       to: "/insurance-review",        toastMsg: null },
];

export function ComplianceQuickActions() {
    const nav = useNavigate();

    return (
        <Card title="Quick Actions">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ACTIONS.map(a => (
                    <button
                        key={a.label}
                        onClick={() => {
                            if (a.toastMsg) toast.success(a.toastMsg);
                            nav({ to: a.to });
                        }}
                        className="text-left p-3 rounded-md border border-border hover:bg-muted/40 transition-colors"
                    >
                        <div className={`h-8 w-8 rounded-md border grid place-items-center mb-2 ${a.tone}`}>
                            <a.icon className="h-4 w-4" />
                        </div>
                        <div className="text-[13px] font-medium text-foreground">{a.label}</div>
                        <div className="text-[11.5px] text-muted-foreground mt-0.5">{a.desc}</div>
                    </button>
                ))}
            </div>
        </Card>
    );
}
