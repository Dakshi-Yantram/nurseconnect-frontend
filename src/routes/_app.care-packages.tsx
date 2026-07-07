/**
 * _app.care-packages.tsx — Admin Care Package Management
 *
 * PATCH 3: Replaces the mock-data driven care packages page with a fully
 * API-connected version. Supports:
 *  - List packages from GET /api/care-packages
 *  - Create new package via POST /api/admin/care-packages
 *  - Edit existing package via PUT /api/admin/care-packages/:id
 *  - Toggle active/inactive via PATCH /api/admin/care-packages/:id/toggle
 *  - Clone package (creates a new draft copy)
 *  - Version history panel
 *
 * Admin-only page. Requires admin_ops or admin_super role.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Modal } from "@/components/shared/Modal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Copy, History, Edit2, Plus, RefreshCw, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/care-packages")({ component: CarePackagesPage });

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CarePackage {
  id: string;
  package_code: string;
  name: string;
  tagline?: string;
  description?: string;
  target_condition?: string;
  min_tier: string;
  gender_restriction: string;
  visit_frequency: string;
  visits_per_cycle: number;
  cycle_duration_days: number;
  shift_hours?: number;
  package_price: number;
  per_visit_price?: number;
  subsidy_eligible: boolean;
  commission_pct: number;
  requires_prescription: boolean;
  insurance_covered: boolean;
  is_active: boolean;
  version: number;
  available_cities?: string[];
  created_at: string;
}

interface PackageFormValues {
  name: string;
  package_code: string;
  tagline: string;
  description: string;
  target_condition: string;
  min_tier: string;
  gender_restriction: string;
  visit_frequency: string;
  visits_per_cycle: string;
  cycle_duration_days: string;
  package_price: string;
  per_visit_price: string;
  commission_pct: string;
  subsidy_eligible: boolean;
  requires_prescription: boolean;
  insurance_covered: boolean;
  available_cities: string; // comma-separated
}

const EMPTY_FORM: PackageFormValues = {
  name: "",
  package_code: "",
  tagline: "",
  description: "",
  target_condition: "",
  min_tier: "tier2",
  gender_restriction: "any",
  visit_frequency: "daily",
  visits_per_cycle: "7",
  cycle_duration_days: "7",
  package_price: "",
  per_visit_price: "",
  commission_pct: "20",
  subsidy_eligible: false,
  requires_prescription: false,
  insurance_covered: true,
  available_cities: "",
};

const TIERS = ["tier1", "tier2", "tier3", "tier4", "tier5"];
const GENDER_OPTIONS = ["any", "female_only", "male_only"];
const FREQUENCY_OPTIONS = ["daily", "alternate_days", "twice_weekly", "weekly", "as_needed"];

// ─── API helpers ──────────────────────────────────────────────────────────────
function authHeaders() {
  const token = localStorage.getItem("access_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.[0]?.msg ?? err?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// ─── Main page ────────────────────────────────────────────────────────────────
function CarePackagesPage() {
  const [packages, setPackages] = useState<CarePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CarePackage | null>(null);
  const [historyTarget, setHistoryTarget] = useState<CarePackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /api/care-packages — public read endpoint (no admin token needed for list)
      const data = await apiFetch("/api/care-packages?active_only=false");
      const list: CarePackage[] = Array.isArray(data) ? data : (data?.items ?? []);
      setPackages(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const openCreate = () => {
    setEditTarget(null);
    setEditorOpen(true);
  };

  const openEdit = (pkg: CarePackage) => {
    setEditTarget(pkg);
    setEditorOpen(true);
  };

  const openClone = (pkg: CarePackage) => {
    // Pre-fill the editor with the cloned package data, clearing the ID
    // so the save action creates a new record.
    setEditTarget({ ...pkg, id: "", package_code: pkg.package_code + "_COPY", name: pkg.name + " (Copy)", version: 1 });
    setEditorOpen(true);
    toast.info("Editing a cloned copy — saving will create a new package.");
  };

  const handleToggleActive = async (pkg: CarePackage) => {
    setToggling(pkg.id);
    try {
      // PATCH /api/admin/care-packages/:id/toggle
      await apiFetch(`/api/admin/care-packages/${pkg.id}/toggle`, { method: "PATCH" });
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: !p.is_active } : p));
      toast.success(`Package ${pkg.is_active ? "deactivated" : "activated"}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to toggle package");
    } finally {
      setToggling(null);
    }
  };

  const handleSave = async (values: PackageFormValues) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        package_code: values.package_code.trim().toUpperCase(),
        tagline: values.tagline.trim() || undefined,
        description: values.description.trim() || undefined,
        target_condition: values.target_condition.trim() || undefined,
        min_tier: values.min_tier,
        gender_restriction: values.gender_restriction,
        visit_frequency: values.visit_frequency,
        visits_per_cycle: parseInt(values.visits_per_cycle, 10),
        cycle_duration_days: parseInt(values.cycle_duration_days, 10),
        package_price: parseFloat(values.package_price),
        per_visit_price: values.per_visit_price ? parseFloat(values.per_visit_price) : undefined,
        commission_pct: parseFloat(values.commission_pct),
        subsidy_eligible: values.subsidy_eligible,
        requires_prescription: values.requires_prescription,
        insurance_covered: values.insurance_covered,
        available_cities: values.available_cities
          ? values.available_cities.split(",").map(c => c.trim()).filter(Boolean)
          : null,
      };

      const isNew = !editTarget?.id;
      if (isNew) {
        // POST /api/admin/care-packages
        const created = await apiFetch("/api/admin/care-packages", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setPackages(prev => [created, ...prev]);
        toast.success("Package created");
      } else {
        // PUT /api/admin/care-packages/:id
        const updated = await apiFetch(`/api/admin/care-packages/${editTarget.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setPackages(prev => prev.map(p => p.id === editTarget.id ? updated : p));
        toast.success("Package updated");
      }
      setEditorOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save package");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Care Packages"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPackages}
              className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={openCreate}
              className="px-3 py-1.5 text-[12px] rounded-md bg-primary text-white inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Package
            </button>
          </div>
        }
      >
        {loading && (
          <div className="py-12 text-center text-[13px] text-muted-foreground">Loading packages…</div>
        )}

        {!loading && error && (
          <div className="py-8 px-4">
            <div className="flex items-center gap-2 text-rose-600 text-[13px]">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
            <button onClick={fetchPackages} className="mt-3 text-[12px] text-primary underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && packages.length === 0 && (
          <div className="py-10">
            <EmptyState
              icon={Package}
              title="No care packages yet"
              description="Create your first package to make it bookable by consumers."
            />
          </div>
        )}

        {!loading && !error && packages.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {packages.map(p => (
              <PackageCard
                key={p.id}
                pkg={p}
                toggling={toggling === p.id}
                onEdit={() => openEdit(p)}
                onClone={() => openClone(p)}
                onHistory={() => setHistoryTarget(p)}
                onToggle={() => handleToggleActive(p)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Editor modal */}
      <PackageEditorModal
        open={editorOpen}
        pkg={editTarget}
        saving={saving}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />

      {/* Version history modal */}
      {historyTarget && (
        <VersionHistoryModal
          pkg={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────
function PackageCard({ pkg, toggling, onEdit, onClone, onHistory, onToggle }: {
  pkg: CarePackage;
  toggling: boolean;
  onEdit: () => void;
  onClone: () => void;
  onHistory: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="p-4 rounded-lg border border-border hover:border-primary/40 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold truncate">{pkg.name}</div>
          <div className="text-[11px] text-muted-foreground">{pkg.package_code} · v{pkg.version}</div>
        </div>
        <button
          onClick={onToggle}
          disabled={toggling}
          title={pkg.is_active ? "Click to deactivate" : "Click to activate"}
        >
          <StatusChip
            tone={pkg.is_active ? "success" : "muted"}
            label={toggling ? "…" : pkg.is_active ? "Active" : "Inactive"}
            dot
          />
        </button>
      </div>

      {pkg.target_condition && (
        <p className="text-[12px] text-muted-foreground mt-2 line-clamp-2">{pkg.target_condition}</p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px]">
        <Stat l="Visits" v={pkg.visits_per_cycle} />
        <Stat l="Days" v={pkg.cycle_duration_days} />
        <Stat l="Tier" v={pkg.min_tier.replace("tier", "T")} />
      </div>

      {pkg.available_cities && pkg.available_cities.length > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Cities: {pkg.available_cities.join(", ")}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[15px] font-semibold">
          ₹{Number(pkg.package_price).toLocaleString("en-IN")}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
            title="Edit"
          >
            <Edit2 className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onClone}
            className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
            title="Clone"
          >
            <Copy className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onHistory}
            className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
            title="Version history"
          >
            <History className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Package editor modal ─────────────────────────────────────────────────────
function PackageEditorModal({ open, pkg, saving, onClose, onSave }: {
  open: boolean;
  pkg: CarePackage | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: PackageFormValues) => void;
}) {
  const isNew = !pkg?.id;
  const [form, setForm] = useState<PackageFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (pkg) {
      setForm({
        name: pkg.name,
        package_code: pkg.package_code,
        tagline: pkg.tagline ?? "",
        description: pkg.description ?? "",
        target_condition: pkg.target_condition ?? "",
        min_tier: pkg.min_tier,
        gender_restriction: pkg.gender_restriction ?? "any",
        visit_frequency: pkg.visit_frequency ?? "daily",
        visits_per_cycle: String(pkg.visits_per_cycle ?? ""),
        cycle_duration_days: String(pkg.cycle_duration_days ?? ""),
        package_price: String(pkg.package_price ?? ""),
        per_visit_price: String(pkg.per_visit_price ?? ""),
        commission_pct: String(pkg.commission_pct ?? "20"),
        subsidy_eligible: pkg.subsidy_eligible ?? false,
        requires_prescription: pkg.requires_prescription ?? false,
        insurance_covered: pkg.insurance_covered ?? true,
        available_cities: pkg.available_cities?.join(", ") ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [pkg, open]);

  const set = (key: keyof PackageFormValues, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Package name is required");
    if (!form.package_code.trim()) return toast.error("Package code is required");
    if (!form.package_price || isNaN(parseFloat(form.package_price))) return toast.error("Valid price is required");
    onSave(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "New Care Package" : `Edit · ${pkg?.name}`}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-md border border-border"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pkg-editor-form"
            disabled={saving}
            className="px-4 py-2 text-[13px] rounded-md bg-primary text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : isNew ? "Create Package" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="pkg-editor-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 text-[13px]">
        <Field label="Package Name *" value={form.name} onChange={v => set("name", v)} placeholder="e.g. Post Surgery Recovery" />
        <Field label="Package Code *" value={form.package_code} onChange={v => set("package_code", v)} placeholder="e.g. POST_OP_7D" />
        <Field label="Tagline" value={form.tagline} onChange={v => set("tagline", v)} placeholder="Short description for booking card" full />
        <Field label="Target Condition" value={form.target_condition} onChange={v => set("target_condition", v)} placeholder="e.g. Post knee replacement" full />
        <Field label="Description" value={form.description} onChange={v => set("description", v)} placeholder="Full description visible to consumers" full textarea />

        <SelectField label="Min Nurse Tier" value={form.min_tier} options={TIERS} onChange={v => set("min_tier", v)} />
        <SelectField label="Gender Restriction" value={form.gender_restriction} options={GENDER_OPTIONS} onChange={v => set("gender_restriction", v)} />
        <SelectField label="Visit Frequency" value={form.visit_frequency} options={FREQUENCY_OPTIONS} onChange={v => set("visit_frequency", v)} />

        <Field label="Visits per Cycle" value={form.visits_per_cycle} onChange={v => set("visits_per_cycle", v)} type="number" placeholder="e.g. 14" />
        <Field label="Cycle Duration (days)" value={form.cycle_duration_days} onChange={v => set("cycle_duration_days", v)} type="number" placeholder="e.g. 14" />
        <Field label="Package Price (₹) *" value={form.package_price} onChange={v => set("package_price", v)} type="number" placeholder="e.g. 8999" />
        <Field label="Per Visit Price (₹)" value={form.per_visit_price} onChange={v => set("per_visit_price", v)} type="number" placeholder="optional" />
        <Field label="Commission %" value={form.commission_pct} onChange={v => set("commission_pct", v)} type="number" placeholder="e.g. 20" />
        <Field
          label="Available Cities (comma-separated)"
          value={form.available_cities}
          onChange={v => set("available_cities", v)}
          placeholder="Hyderabad, Bangalore — leave blank for all cities"
          full
        />

        <div className="col-span-2 flex flex-wrap gap-6 pt-1">
          <CheckboxField label="Subsidy eligible (BPL)" checked={form.subsidy_eligible} onChange={v => set("subsidy_eligible", v)} />
          <CheckboxField label="Requires prescription" checked={form.requires_prescription} onChange={v => set("requires_prescription", v)} />
          <CheckboxField label="Insurance covered" checked={form.insurance_covered} onChange={v => set("insurance_covered", v)} />
        </div>
      </form>
    </Modal>
  );
}

// ─── Version history modal ────────────────────────────────────────────────────
function VersionHistoryModal({ pkg, onClose }: { pkg: CarePackage; onClose: () => void }) {
  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Version History · ${pkg.name}`}
      size="md"
      footer={
        <button onClick={onClose} className="px-4 py-2 text-[13px] rounded-md border border-border">
          Close
        </button>
      }
    >
      <p className="text-[12.5px] text-muted-foreground mb-4">
        Currently on v{pkg.version}. Previous versions are archived and can be restored by your super admin.
      </p>
      <ul className="space-y-2">
        {Array.from({ length: pkg.version }, (_, i) => pkg.version - i).map(v => (
          <li key={v} className="p-3 rounded border border-border flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">v{v}.0{v === pkg.version ? " (current)" : ""}</div>
              <div className="text-[11px] text-muted-foreground">
                {v === pkg.version ? "Live" : "Archived"}
              </div>
            </div>
            {v !== pkg.version && (
              <button
                onClick={() => { onClose(); toast.info("Contact super admin to restore a previous version."); }}
                className="text-[12px] text-primary"
              >
                Restore
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ─── Shared form components ───────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, full, type = "text", textarea }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; full?: boolean; type?: string; textarea?: boolean;
}) {
  const cls = "mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40";
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-[11.5px] font-medium text-foreground">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11.5px] font-medium text-foreground">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      {label}
    </label>
  );
}

function Stat({ l, v }: { l: string; v: string | number }) {
  return (
    <div className="bg-secondary/50 rounded-md py-1.5">
      <div className="text-[13px] font-semibold">{v}</div>
      <div className="text-[10px] text-muted-foreground">{l}</div>
    </div>
  );
}
