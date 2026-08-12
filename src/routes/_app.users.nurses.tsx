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

function NursesPage() {
  const [rows, setRows] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Fetch all workers (any onboarding status) from admin endpoint
      const data = await apiFetch("/api/admin/workers/all");
      setRows(Array.isArray(data) ? data : []);
    } catch {
      // Fallback: fetch just the pending ones if /all isn't available yet
      try {
        const data = await apiFetch("/api/admin/workers/pending");
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) { setError(String(e?.message ?? e)); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) =>
    `${r.full_name} ${r.email} ${r.phone} ${r.worker_type ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or phone…"
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-[13px]" />
        </div>
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
                      <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize",
                        r.worker_type === "caregiver" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700")}>
                        {r.worker_type ?? "nurse"}
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
