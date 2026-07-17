import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { UserPlus, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/operations/staff")({
  component: StaffAccountsPage,
  head: () => ({ meta: [{ title: "Staff Accounts — NurseConnect" }] }),
});

interface StaffAccount {
  id: string; full_name: string; email: string; phone_e164: string; role: string;
}

interface RoleOption {
  role_key: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
}

const CREATABLE_ROLES = ["support", "clinical_training_lead", "clinical_trainer"];

function StaffAccountsPage() {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("support");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch("/api/admin/staff"),
      apiFetch("/api/admin/roles"),
    ])
      .then(([s, r]) => {
        setStaff(s);
        setRoleOptions((r as RoleOption[]).filter(ro => CREATABLE_ROLES.includes(ro.role_key)));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setFormError("All fields are required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone_e164: phone.trim(),
          password,
          role,
        }),
      });
      setFormSuccess(`${fullName.trim()} created as ${role.replace(/_/g, " ")}`);
      setFullName(""); setEmail(""); setPhone(""); setPassword("");
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-foreground">Staff Accounts</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Create accounts for support, clinical training lead, and clinical trainer roles.
        </p>
      </div>

      <Card title="Create Staff Account">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium text-foreground">Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40">
              {(roleOptions.length > 0 ? roleOptions : CREATABLE_ROLES.map(k => ({ role_key: k, display_name: k, description: null, is_active: true })))
                .filter(r => r.is_active)
                .map(r => (
                  <option key={r.role_key} value={r.role_key}>{r.display_name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Mobile number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="9999900001"
              className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[12px] font-medium text-foreground">Temporary password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
            <p className="mt-1 text-[11px] text-muted-foreground">8+ characters, with uppercase, lowercase, and a number.</p>
          </div>

          {formError && (
            <div className="sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</div>
          )}
          {formSuccess && (
            <div className="sm:col-span-2 text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{formSuccess}</div>
          )}

          <div className="sm:col-span-2">
            <button disabled={submitting} type="submit"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-md font-medium hover:opacity-95 disabled:opacity-60 transition text-[13px]">
              <UserPlus className="h-4 w-4" />
              {submitting ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="All Staff Accounts" padded={false}>
        {loading && <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Loading…</div>}
        {error && (
          <div className="px-5 py-8 text-center text-[13px] text-red-600">
            {error}
            <button onClick={load} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5">Name</th><th className="px-5 py-2.5">Email</th>
              <th className="px-5 py-2.5">Phone</th><th className="px-5 py-2.5">Role</th>
            </tr></thead>
            <tbody>
              {staff.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No staff accounts yet.</td></tr>
              )}
              {staff.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{s.full_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.email}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.phone_e164}</td>
                  <td className="px-5 py-3"><StatusChip tone="info" label={s.role.replace(/_/g, " ")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
