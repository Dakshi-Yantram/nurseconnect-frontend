import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Eye, UserX, UserCheck, Search, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/users/nurses")({
  component: NursesPage,
  head: () => ({ meta: [{ title: "Nurses & Caregivers — NurseConnect" }] }),
});

type WorkerRow = {
  worker_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  tier: string;
  worker_type?: string;
  onboarding_status?: string;
  background_check_status: string | null;
  availability?: string;
  documents: { document_type: string; verification_status: string }[];
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending_review: "bg-amber-100 text-amber-700",
  documents_pending: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  onboarding: "bg-muted text-muted-foreground",
};

// Mirrors app/core/provider_types.py PROVIDER_TYPE_LABELS
const PROVIDER_TYPES: { value: string; label: string }[] = [
  { value: "nurse", label: "Nurse" },
  { value: "doctor", label: "Doctor" },
  { value: "dentist", label: "Dentist" },
  { value: "physiotherapist", label: "Physiotherapist" },
  { value: "caregiver", label: "Caregiver" },
  { value: "mother_baby_caregiver", label: "Mother & Baby Caregiver" },
];
const PROVIDER_TYPE_BADGE: Record<string, string> = {
  nurse: "bg-blue-100 text-blue-700",
  doctor: "bg-sky-100 text-sky-700",
  dentist: "bg-cyan-100 text-cyan-700",
  physiotherapist: "bg-teal-100 text-teal-700",
  caregiver: "bg-purple-100 text-purple-700",
  mother_baby_caregiver: "bg-pink-100 text-pink-700",
};

function NursesPage() {
  const [rows, setRows] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Fetch all workers (any onboarding status) from admin endpoint,
      // filtered server-side by provider_type when a filter is selected.
      const qs = providerFilter ? `?provider_type=${providerFilter}` : "";
      const data = await apiFetch(`/api/admin/workers/all${qs}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      // Fallback: fetch just the pending ones if /all isn't available yet
      try {
        const data = await apiFetch("/api/admin/workers/pending");
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) { setError(String(e?.message ?? e)); }
    } finally { setLoading(false); }
  }, [providerFilter]);

  // Live counts per provider type, independent of the current row filter —
  // powers the clickable summary cards above the table.
  const loadCounts = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/dashboard/providers");
      setCounts(data?.by_type ?? null);
    } catch {
      setCounts(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const filtered = rows.filter((r) =>
    `${r.full_name} ${r.email} ${r.phone} ${r.worker_type ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            onClick={() => setProviderFilter("")}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition",
              providerFilter === "" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30"
            )}
          >
            <div className="text-[11px] text-muted-foreground">All types</div>
            <div className="text-[18px] font-bold text-foreground">
              {Object.values(counts).reduce((a, b) => a + b, 0)}
            </div>
          </button>
          {PROVIDER_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setProviderFilter(pt.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition",
                providerFilter === pt.value ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30"
              )}
            >
              <div className="text-[11px] text-muted-foreground truncate">{pt.label}</div>
              <div className="text-[18px] font-bold text-foreground">{counts[pt.value] ?? 0}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or phone…"
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-[13px]" />
        </div>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12.5px]"
          title="Filter by provider type"
        >
          <option value="">All provider types</option>
          {PROVIDER_TYPES.map((pt) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
        </select>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] hover:bg-muted">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
          <p className="text-[13px] font-semibold text-foreground">No care professionals found</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {rows.length === 0
              ? "No nurses or caregivers have registered yet. They self-register via the app."
              : "No results match your search."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {["Name", "Type", "Contact", "Tier", "Onboarding", "Docs verified", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const verifiedCount = r.documents.filter((d) => d.verification_status === "verified").length;
                const totalDocs = r.documents.length;
                return (
                  <tr key={r.worker_id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{r.full_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                        PROVIDER_TYPE_BADGE[r.worker_type ?? "nurse"] ?? "bg-blue-100 text-blue-700")}>
                        {PROVIDER_TYPES.find((pt) => pt.value === r.worker_type)?.label ?? r.worker_type ?? "Nurse"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-muted-foreground text-[12px]">{r.email}</div>
                      <div className="text-muted-foreground text-[11.5px]">{r.phone}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{r.tier?.replace("tier", "Tier ") ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                        STATUS_STYLE[r.onboarding_status ?? ""] ?? "bg-muted text-muted-foreground")}>
                        {(r.onboarding_status ?? "unknown").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[12px] font-semibold", verifiedCount === totalDocs && totalDocs > 0 ? "text-emerald-700" : "text-amber-700")}>
                        {verifiedCount}/{totalDocs}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-[12px]">
                      {new Date(r.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/nurse-approval" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11.5px] hover:bg-muted">
                        <Eye size={12} /> Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}