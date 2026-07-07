import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Card title="Profile">
        <div className="grid grid-cols-2 gap-4 text-[13px]">
          <Field label="Full Name" defaultValue="Admin User" />
          <Field label="Email" defaultValue="admin@nurseconnect.in" />
          <Field label="Role" defaultValue="Super Admin" disabled />
          <Field label="Phone" defaultValue="+91 98765 43210" />
        </div>
      </Card>
      <Card title="Notifications">
        {["Critical clinical escalations", "New nurse applications", "Payout batch ready", "Audit log alerts"].map(n => (
          <label key={n} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 text-[13px]">
            {n}
            <input type="checkbox" defaultChecked className="h-4 w-4" />
          </label>
        ))}
      </Card>
      <Card title="Security">
        <div className="space-y-3 text-[13px]">
          <button className="px-4 py-2 rounded-md border border-border">Change Password</button>
          <button className="px-4 py-2 rounded-md border border-border ml-2">Enable 2FA</button>
        </div>
      </Card>
    </div>
  );
}
function Field({ label, defaultValue, disabled }: any) {
  return (
    <div>
      <label className="text-[12px] font-medium">{label}</label>
      <input defaultValue={defaultValue} disabled={disabled} className="mt-1.5 w-full px-3 py-2 rounded-md border border-border bg-card disabled:opacity-60" />
    </div>
  );
}
