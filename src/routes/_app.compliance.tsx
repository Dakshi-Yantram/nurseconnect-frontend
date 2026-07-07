import { createFileRoute } from "@tanstack/react-router";
import { ComplianceOverviewCard } from "@/components/compliance/ComplianceOverviewCard";
import { ComplianceScoreCard } from "@/components/compliance/ComplianceScoreCard";
import { ComplianceQuickActions } from "@/components/compliance/ComplianceQuickActions";
import { ComplianceActivityTable } from "@/components/compliance/ComplianceActivityTable";

export const Route = createFileRoute("/_app/compliance")({ component: CompliancePage });

function CompliancePage() {
  return (
    <div className="space-y-6">
      <ComplianceOverviewCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComplianceScoreCard />
        <ComplianceQuickActions />
      </div>
      <ComplianceActivityTable />
    </div>
  );
}