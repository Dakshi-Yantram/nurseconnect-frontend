/**
 * _app.services-catalogue.tsx — Admin Service Catalogue Management
 *
 * NEW (Provider Type project, Phase 4 — website). Previously every
 * ServiceCatalogue row was seed-script only (app/seed.py) — there was no
 * admin UI to create/edit a service or set which Provider Types
 * (Doctor / Dentist / Nurse / Physiotherapist / Caregiver / Mother & Baby
 * Caregiver) may ever qualify for it. This page wires up the
 * PATCH 5 backend endpoints added in Phase 3:
 *  - List services from GET /api/admin/services (category / provider_type /
 *    is_active filters)
 *  - Create via POST /api/admin/services
 *  - Edit via PUT /api/admin/services/:id
 *  - Toggle active/inactive via PATCH /api/admin/services/:id/toggle
 *  - Soft-delete via DELETE /api/admin/services/:id (blocked server-side
 *    while any worker holds an APPROVED qualification for the service)
 *
 * Mirrors the _app.care-packages.tsx page's structure/conventions so the
 * two admin catalogue screens feel consistent.
 *
 * Admin-only page.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Modal } from "@/components/shared/Modal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Edit2, Plus, RefreshCw, AlertTriangle, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/services-catalogue")({ component: ServicesCataloguePage });

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ─── Provider types — mirrors app/core/provider_types.py PROVIDER_TYPE_LABELS ─
const PROVIDER_TYPES: { value: string; label: string }[] = [
  { value: "nurse", label: "Nurse" },
  { value: "doctor", label: "Doctor" },
  { value: "dentist", label: "Dentist" },
  { value: "physiotherapist", label: "Physiotherapist" },
  { value: "caregiver", label: "Caregiver" },
  { value: "mother_baby_caregiver", label: "Mother & Baby Caregiver" },
];

const CATEGORIES = ["micro_visit", "nursing_visit", "therapy_session", "consultation", "package_visit"];
const TIERS = ["tier1", "tier2", "tier3", "tier4", "tier5"];
const GATES = [
  { value: "credential_only", label: "Gate 1 — Credential only" },
  { value: "theory_verified", label: "Gate 2 — Theory verified" },
  { value: "practical_verified", label: "Gate 3 — Practical verified" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServiceRow {
  id: string;
  service_code: string;
  name: string;
  description?: string | null;
  category: string;
  min_tier: string;
  duration_minutes: number;
  base_price: number;
  max_price?: number | null;
  commission_pct: number;
  requires_prescription: boolean;
  insurance_covered: boolean;
  gate: string;
  allowed_provider_types?: string[] | null;
  is_active: boolean;
  is_deleted: boolean;
  version: number;
}

interface ServiceFormValues {
  service_code: string;
  name: string;
  description: string;
  category: string;
  min_tier: string;
  duration_minutes: string;
  base_price: string;
  max_price: string;
  commission_pct: string;
  requires_prescription: boolean;
  insurance_covered: boolean;
  gate: string;
  allowed_provider_types: string[]; // empty = unrestricted, matches every provider type
}

const EMPTY_FORM: ServiceFormValues = {
  service_code: "",
  name: "",
  description: "",
  category: "micro_visit",
  min_tier: "tier1",
  duration_minutes: "30",
  base_price: "",
  max_price: "",
  commission_pct: "20",
  requires_prescription: false,
  insurance_covered: true,
  gate: "credential_only",
  allowed_provider_types: [],
};

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

function providerTypeLabels(codes?: string[] | null): string {
  if (!codes || codes.length === 0) return "All provider types";
  return codes.map(c => PROVIDER_TYPES.find(p => p.value === c)?.label ?? c).join(", ");
}

// ─── Main page ────────────────────────────────────────────────────────────────
function ServicesCataloguePage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = providerFilter ? `?provider_type=${providerFilter}` : "";
      const data = await apiFetch(`/api/admin/services${qs}`);
      setServices(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [providerFilter]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const openCreate = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit = (svc: ServiceRow) => { setEditTarget(svc); setEditorOpen(true); };

  const handleToggleActive = async (svc: ServiceRow) => {
    setToggling(svc.id);
    try {
      await apiFetch(`/api/admin/services/${svc.id}/toggle`, { method: "PATCH" });
      setServices(prev => prev.map(s => s.id === svc.id ? { ...s, is_active: !s.is_active } : s));
      toast.success(`Service ${svc.is_active ? "deactivated" : "activated"}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to toggle service");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (svc: ServiceRow) => {
    if (!confirm(`Delete "${svc.name}"? This is blocked if any worker currently holds an approved qualification for it.`)) return;
    setDeleting(svc.id);
    try {
      await apiFetch(`/api/admin/services/${svc.id}`, { method: "DELETE" });
      setServices(prev => prev.filter(s => s.id !== svc.id));
      toast.success("Service deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete service");
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (values: ServiceFormValues) => {
    setSaving(true);
    try {
      const payload = {
        service_code: values.service_code.trim().toLowerCase(),
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        category: values.category,
        min_tier: values.min_tier,
        duration_minutes: parseInt(values.duration_minutes, 10),
        base_price: parseFloat(values.base_price),
        max_price: values.max_price ? parseFloat(values.max_price) : undefined,
        commission_pct: parseFloat(values.commission_pct),
        requires_prescription: values.requires_prescription,
        insurance_covered: values.insurance_covered,
        gate: values.gate,
        allowed_provider_types: values.allowed_provider_types.length ? values.allowed_provider_types : null,
      };

      const isNew = !editTarget?.id;
      if (isNew) {
        const created = await apiFetch("/api/admin/services", { method: "POST", body: JSON.stringify(payload) });
        setServices(prev => [created, ...prev]);
        toast.success("Service created");
      } else {
        const updated = await apiFetch(`/api/admin/services/${editTarget.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setServices(prev => prev.map(s => s.id === editTarget.id ? updated : s));
        toast.success("Service updated");
      }
      setEditorOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save service");
    } finally {
      setSaving(false);
    }
  };

  const filterLabel = useMemo(
    () => providerFilter ? PROVIDER_TYPES.find(p => p.value === providerFilter)?.label : "All",
    [providerFilter],
  );

  return (
    <div className="space-y-6">
      <Card
        title="Service Catalogue"
        action={
          <div className="flex items-center gap-2">
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className="h-8 px-2 text-[12px] rounded-md border border-border bg-card"
              title="Filter by provider type"
            >
              <option value="">All provider types</option>
              {PROVIDER_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
            <button onClick={fetchServices} className="h-8 w-8 grid place-items-center rounded hover:bg-secondary" title="Refresh">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={openCreate} className="px-3 py-1.5 text-[12px] rounded-md bg-primary text-white inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Service
            </button>
          </div>
        }
      >
        {loading && <div className="py-12 text-center text-[13px] text-muted-foreground">Loading services…</div>}

        {!loading && error && (
          <div className="py-8 px-4">
            <div className="flex items-center gap-2 text-rose-600 text-[13px]"><AlertTriangle className="h-4 w-4" />{error}</div>
            <button onClick={fetchServices} className="mt-3 text-[12px] text-primary underline">Try again</button>
          </div>
        )}

        {!loading && !error && services.length === 0 && (
          <div className="py-10">
            <EmptyState icon={ListChecks} title="No services found" description={`No services match "${filterLabel}". Create one, or seed the catalogue via app/seed.py.`} />
          </div>
        )}

        {!loading && !error && services.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">Service</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Provider types</th>
                  <th className="py-2 px-3">Gate</th>
                  <th className="py-2 px-3">Price</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {services.map(svc => (
                  <tr key={svc.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-foreground">{svc.name}</div>
                      <div className="text-[11px] text-muted-foreground">{svc.service_code}</div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{svc.category}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{providerTypeLabels(svc.allowed_provider_types)}</td>
                    <td className="py-2.5 px-3">
                      {svc.gate !== "credential_only" && (
                        <StatusChip tone={svc.gate === "practical_verified" ? "danger" : "warning"} label={svc.gate === "practical_verified" ? "Gate 3" : "Gate 2"} />
                      )}
                    </td>
                    <td className="py-2.5 px-3">₹{Number(svc.base_price).toLocaleString("en-IN")}</td>
                    <td className="py-2.5 px-3">
                      <button onClick={() => handleToggleActive(svc)} disabled={toggling === svc.id} title={svc.is_active ? "Click to deactivate" : "Click to activate"}>
                        <StatusChip tone={svc.is_active ? "success" : "muted"} label={toggling === svc.id ? "…" : svc.is_active ? "Active" : "Inactive"} dot />
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(svc)} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary" title="Edit">
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(svc)} disabled={deleting === svc.id} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary" title="Delete">
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ServiceEditorModal open={editorOpen} svc={editTarget} saving={saving} onClose={() => setEditorOpen(false)} onSave={handleSave} />
    </div>
  );
}

// ─── Service editor modal ──────────────────────────────────────────────────────
function ServiceEditorModal({ open, svc, saving, onClose, onSave }: {
  open: boolean;
  svc: ServiceRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: ServiceFormValues) => void;
}) {
  const isNew = !svc?.id;
  const [form, setForm] = useState<ServiceFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (svc) {
      setForm({
        service_code: svc.service_code,
        name: svc.name,
        description: svc.description ?? "",
        category: svc.category,
        min_tier: svc.min_tier,
        duration_minutes: String(svc.duration_minutes ?? "30"),
        base_price: String(svc.base_price ?? ""),
        max_price: svc.max_price != null ? String(svc.max_price) : "",
        commission_pct: String(svc.commission_pct ?? "20"),
        requires_prescription: svc.requires_prescription ?? false,
        insurance_covered: svc.insurance_covered ?? true,
        gate: svc.gate ?? "credential_only",
        allowed_provider_types: svc.allowed_provider_types ?? [],
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [svc, open]);

  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleProviderType = (value: string) => {
    setForm(prev => ({
      ...prev,
      allowed_provider_types: prev.allowed_provider_types.includes(value)
        ? prev.allowed_provider_types.filter(v => v !== value)
        : [...prev.allowed_provider_types, value],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Service name is required");
    if (!form.service_code.trim()) return toast.error("Service code is required");
    if (!form.base_price || isNaN(parseFloat(form.base_price))) return toast.error("Valid base price is required");
    if (!form.duration_minutes || isNaN(parseInt(form.duration_minutes, 10))) return toast.error("Valid duration is required");
    onSave(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "New Service" : `Edit · ${svc?.name}`}
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] rounded-md border border-border">Cancel</button>
          <button type="submit" form="svc-editor-form" disabled={saving} className="px-4 py-2 text-[13px] rounded-md bg-primary text-white disabled:opacity-60">
            {saving ? "Saving…" : isNew ? "Create Service" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="svc-editor-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <label className="text-[11.5px] font-medium text-foreground">Service Name *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Wound Dressing" className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card" />
        </div>
        <div>
          <label className="text-[11.5px] font-medium text-foreground">Service Code *</label>
          <input value={form.service_code} onChange={e => set("service_code", e.target.value)} placeholder="e.g. wound_dressing" className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card" />
        </div>
        <div className="col-span-2">
          <label className="text-[11.5px] font-medium text-foreground">Description</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card" />
        </div>

        <div>
          <label className="text-[11.5px] font-medium text-foreground">Category</label>
          <select value={form.category} onChange={e => set("category", e.target.value)} className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11.5px] font-medium text-foreground">Min Worker Tier</label>
          <select value={form.min_tier} onChange={e => set("min_tier", e.target.value)} className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11.5px] font-medium text-foreground">Duration (minutes) *</label>
          <input type="number" value={form.duration_minutes} onChange={e => set("duration_minutes", e.target.value)} className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card" />
        </div>
        <div>
          <label className="text-[11.5px] font-medium text-foreground">Commission %</label>
          <input type="number" value={form.commission_pct} onChange={e => set("commission_pct", e.target.value)} className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card" />
        </div>
        <div>
          <label className="text-[11.5px] font-medium text-foreground">Base Price (₹) *</label>
          <input type="number" value={form.base_price} onChange={e => set("base_price", e.target.value)} className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card" />
        </div>
        <div>
          <label className="text-[11.5px] font-medium text-foreground">Max Price (₹)</label>
          <input type="number" value={form.max_price} onChange={e => set("max_price", e.target.value)} placeholder="optional" className="mt-1 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card" />
        </div>

        <div className="col-span-2 flex flex-wrap gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-[13px]">
            <input type="checkbox" checked={form.requires_prescription} onChange={e => set("requires_prescription", e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
            Requires prescription
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-[13px]">
            <input type="checkbox" checked={form.insurance_covered} onChange={e => set("insurance_covered", e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
            Insurance covered
          </label>
        </div>

        <div className="col-span-2 pt-3 mt-1 border-t border-border">
          <p className="text-[12px] font-semibold text-foreground mb-2">Qualification gate</p>
          <div className="grid grid-cols-1 gap-2">
            {GATES.map(g => (
              <label key={g.value} className={`flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition ${form.gate === g.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                <input type="radio" name="svc-gate" checked={form.gate === g.value} onChange={() => set("gate", g.value)} />
                <span className="text-[12.5px] font-medium text-foreground">{g.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="col-span-2 pt-3 mt-1 border-t border-border">
          <p className="text-[12px] font-semibold text-foreground mb-1">Allowed Provider Types</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            Leave all unchecked to allow every provider type (back-compat default — matches existing seeded rows). Only checked types will ever be able to qualify for or book this service.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDER_TYPES.map(pt => (
              <label key={pt.value} className="flex items-center gap-2 cursor-pointer text-[12.5px]">
                <input
                  type="checkbox"
                  checked={form.allowed_provider_types.includes(pt.value)}
                  onChange={() => toggleProviderType(pt.value)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {pt.label}
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
