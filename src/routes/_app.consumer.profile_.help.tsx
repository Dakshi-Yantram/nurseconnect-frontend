import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/consumer/profile_/help")({
  component: HelpSupport,
  head: () => ({ meta: [{ title: "Help & Support — NurseConnect" }] }),
});

function HelpSupport() {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Link to="/consumer/profile" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
      </Link>
      <Card title="Help & Support">
        <p className="text-[13px] text-muted-foreground">Help & support coming soon.</p>
      </Card>
    </div>
  );
}