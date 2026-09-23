import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { ChevronRight, Search } from "lucide-react";

export const Route = createFileRoute("/_app/provider-agreements")({ component: ProviderAgreementsPage });

interface AgreementRow {
  worker_id: string;
  full_name: string;
  phone_e164: string | null;
  provider_type: string;
  provider_type_label: string;
  stage1_status: string;
  stage2_status: string;
  stage1_accepted_at: string | null;
  stage2_accepted_at: string | null;
  completed_visits_count: number;
  onboarding_fee_collected: number;
  onboarding_fee_target: number;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ProviderAgreementsPage() {
  const [rows, setRows] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | "stage1_pending" | "stage2_pending">("all");

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/contracts/admin")
      .then((data: AgreementRow[]) => setRows(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load provider agreements"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    const matchesQuery =
      !query ||
      r.full_name.toLowerCase().includes(query.toLowerCase()) ||
      (r.phone_e164 ?? "").includes(query);
    const matchesStage =
      stageFilter === "all" ||
      (stageFilter === "stage1_pending" && r.stage1_status !== "accepted") ||
      (stageFilter === "stage2_pending" && r.stage2_status === "pending");
    return matchesQuery && matchesStage;
  });

  const stage1PendingCount = rows.filter((r) => r.stage1_status !== "accepted").length;
  const stage2PendingCount = rows.filter((r) => r.stage2_status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold leading-tight">Provider Agreements</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Stage 1 in-app clickwrap and Stage 2 e-stamp Master Agreement acceptance, per provider.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Total Providers</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums">{rows.length}</div>
        </div>
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Stage 1 Pending</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-amber-600">{stage1PendingCount}</div>
        </div>
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Stage 2 Pending (unlocked, unsigned)</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-amber-600">{stage2PendingCount}</div>
        </div>
      </div>

      <Card
        title="All Providers"
        action={
          <div className="flex items-center gap-2">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
              className="text-[12px] border border-border rounded px-2 py-1 bg-background"
            >
              <option value="all">All</option>
              <option value="stage1_pending">Stage 1 pending</option>
              <option value="stage2_pending">Stage 2 pending</option>
            </select>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or phone"
                className="text-[12px] border border-border rounded pl-7 pr-2 py-1 bg-background"
              />
            </div>
          </div>
        }
        padded={false}
      >
        {loading ? (
          <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-6 text-[13px] text-rose-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-[13px] text-muted-foreground">No providers match this filter.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 sm:px-5 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Stage 1</th>
                <th className="px-4 py-2.5 font-medium">Stage 2</th>
                <th className="px-4 py-2.5 font-medium">Onboarding Fee</th>
                <th className="px-4 py-2.5 font-medium">First Booking</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.worker_id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 sm:px-5 py-2.5">
                    <div className="font-medium text-foreground">{r.full_name}</div>
                    <div className="text-muted-foreground text-[11.5px]">{r.phone_e164 ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2.5">{r.provider_type_label}</td>
                  <td className="px-4 py-2.5">
                    <StatusChip tone={statusToneFor(r.stage1_status)} label={r.stage1_status.replace("_", " ")} dot />
                    <div className="text-[11px] text-muted-foreground mt-0.5">{formatDate(r.stage1_accepted_at)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusChip
                      tone={r.stage2_status === "not_applicable" ? "muted" : statusToneFor(r.stage2_status)}
                      label={r.stage2_status.replace("_", " ")}
                      dot
                    />
                    <div className="text-[11px] text-muted-foreground mt-0.5">{formatDate(r.stage2_accepted_at)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.onboarding_fee_target > 0 ? (
                      <div className="min-w-[110px]">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>₹{r.onboarding_fee_collected}</span>
                          <span>₹{r.onboarding_fee_target}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.onboarding_fee_collected >= r.onboarding_fee_target ? "bg-emerald-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(100, (r.onboarding_fee_collected / r.onboarding_fee_target) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{r.completed_visits_count}</td>
                  <td className="px-4 sm:px-5 py-2.5 text-right">
                    <Link
                      to="/provider-agreements/$workerId"
                      params={{ workerId: r.worker_id }}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
