import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { ArrowLeft, RefreshCw, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/roles-permissions")({
  component: RolesPermissionsPage,
  head: () => ({ meta: [{ title: "Roles & Permissions — NurseConnect" }] }),
});

interface RoleDef {
  id: string | null;
  role_key: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  is_active: boolean;
  updated_at: string | null;
}

function RoleEditor({ role, onSaved }: { role: RoleDef; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(role.display_name);
  const [description, setDescription] = useState(role.description ?? "");
  const [permissions, setPermissions] = useState(role.permissions.join(", "));
  const [isActive, setIsActive] = useState(role.is_active);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/roles/${role.role_key}`, {
        method: "PUT",
        body: JSON.stringify({
          role_key: role.role_key,
          display_name: displayName,
          description: description || null,
          permissions: permissions.split(",").map(p => p.trim()).filter(Boolean),
          is_active: isActive,
        }),
      });
      toast.success(`${displayName} updated`);
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{role.role_key}</span>
        <StatusChip tone={isActive ? "success" : "muted"} label={isActive ? "Active" : "Inactive"} dot />
      </div>
      <div>
        <label className="text-[12px] font-medium text-foreground">Display name</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)}
          className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
      </div>
      <div>
        <label className="text-[12px] font-medium text-foreground">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
      </div>
      <div>
        <label className="text-[12px] font-medium text-foreground">Permissions (comma-separated)</label>
        <input value={permissions} onChange={e => setPermissions(e.target.value)}
          className="mt-1.5 w-full px-3 py-2 text-[12.5px] font-mono rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        <p className="mt-1 text-[10.5px] text-muted-foreground">
          Descriptive only — actual access is enforced in backend route dependencies, not by this list.
        </p>
      </div>
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
        Active — visible in Operations' account-creation dropdown
      </label>
      <button onClick={save} disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-[12.5px] font-medium hover:opacity-95 disabled:opacity-60 transition">
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function CreateOperationsAccount() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      toast.error("All fields are required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/admin/staff/operations", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(), email: email.trim(), phone_e164: phone.trim(),
          password, role: "operations",
        }),
      });
      toast.success(`${fullName.trim()} created as Operations`);
      setFullName(""); setEmail(""); setPhone(""); setPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3.5 mb-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <UserPlus size={18} />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-foreground">Create Operations Account</p>
          <p className="text-[12px] text-muted-foreground">Only admin can create operations accounts.</p>
        </div>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name"
          className="px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
          className="px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number"
          className="px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Temporary password"
          className="px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        <div className="sm:col-span-2">
          <button disabled={submitting} type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-[12.5px] font-medium hover:opacity-95 disabled:opacity-60 transition">
            <UserPlus className="h-3.5 w-3.5" />
            {submitting ? "Creating…" : "Create Operations Account"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RolesPermissionsPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch("/api/admin/roles")
      .then(setRoles)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load roles"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <button onClick={() => router.history.back()} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-[20px] font-bold text-foreground">Roles &amp; Permissions</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Configure the staff roles operations can assign when creating accounts.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
        Adding a genuinely new role (beyond the four below) requires a small code change, since roles are
        backed by a fixed database enum — not something this screen can create on its own. This screen edits
        the display name, description, and permission list of the four staff roles that already exist:
        Operations, Support, Clinical Training Lead, and Clinical Trainer.
      </div>

      {loading && <div className="py-8 text-center text-[13px] text-muted-foreground">Loading…</div>}
      {error && (
        <div className="py-8 text-center text-[13px] text-red-600">
          {error}
          <button onClick={load} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(r => (
            <RoleEditor key={r.role_key} role={r} onSaved={load} />
          ))}
        </div>
      )}

      <CreateOperationsAccount />
    </div>
  );
}
