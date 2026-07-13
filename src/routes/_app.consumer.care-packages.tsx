// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, Package, RefreshCw } from "lucide-react";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/consumer/care-packages")({
  component: ConsumerCarePackages,
  head: () => ({ meta: [{ title: "Care Packages - NurseConnect" }] }),
});

type CarePackage = {
  id: string;
  package_code: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  target_condition?: string | null;
  min_tier?: string | null;
  visits_per_cycle?: number | null;
  cycle_duration_days?: number | null;
  package_price?: number | string | null;
  insurance_covered?: boolean;
};

function money(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "Price on request";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function ConsumerCarePackages() {
  const [packages, setPackages] = useState<CarePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/care-packages");
      setPackages(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <Card
        title="Care Packages"
        action={
          <button onClick={load} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary" title="Refresh">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading packages
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
            {error}
          </div>
        ) : packages.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No care packages available"
            description="Active packages will appear here when the care team publishes them."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg) => (
              <article key={pkg.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-semibold text-foreground">{pkg.name}</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{pkg.package_code}</p>
                  </div>
                  {pkg.insurance_covered && <StatusChip tone="info" label="Insurance" />}
                </div>

                <p className="mt-3 line-clamp-2 min-h-[36px] text-[12.5px] leading-relaxed text-muted-foreground">
                  {pkg.tagline || pkg.description || pkg.target_condition || "Structured visits from verified care professionals."}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Visits" value={pkg.visits_per_cycle ?? "-"} />
                  <Stat label="Days" value={pkg.cycle_duration_days ?? "-"} />
                  <Stat label="Tier" value={String(pkg.min_tier ?? "-").replace("tier", "T")} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Package price</p>
                    <p className="text-[15px] font-semibold text-foreground">{money(pkg.package_price)}</p>
                  </div>
                  <Link
                    to="/consumer/bookings"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Book <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-secondary/60 px-2 py-2">
      <div className="text-[13px] font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
