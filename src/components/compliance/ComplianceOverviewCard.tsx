import { KpiCard } from "@/components/shared/Card";
import { ShieldCheck, AlertTriangle, FileText, Clock } from "lucide-react";

export function ComplianceOverviewCard() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Overall Compliance" value="94.2%" trend="+2.1% this month" hint="Across all active policies" icon={ShieldCheck} tone="success" />
      <KpiCard label="Open Violations" value="7" trend="-3 from last week" hint="Requires immediate attention" icon={AlertTriangle} tone="warning" />
      <KpiCard label="Policies Active" value="24" hint="3 pending review" icon={FileText} tone="info" />
      <KpiCard label="Avg Resolution Time" value="18h" trend="-4h improvement" hint="Violation to closure" icon={Clock} tone="primary" />
    </div>
  );
}
