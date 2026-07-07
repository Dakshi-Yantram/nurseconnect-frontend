import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/consumer/profile_/personal")({
  component: PersonalInformation,
  head: () => ({ meta: [{ title: "Personal Information — NurseConnect" }] }),
});

function PersonalInformation() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Link
        to="/consumer/profile"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Profile
      </Link>

      <Card title="Personal Information">
        <div className="space-y-4 text-[13px]">
          <Field label="Full Name"     value={user.name} />
          <Field label="Email Address" value={user.email} />
          <Field label="Role"          value={user.role} />
          <Field label="Account ID"    value={user.id} />
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}