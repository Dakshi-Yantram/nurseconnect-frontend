import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { EmptyState, LoadingState } from "@/components/shared/EmptyState";
import { apiFetch } from "@/lib/api";
import { MapPin, Users, Activity, ShieldCheck, Search, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/location-dashboard")({
  component: LocationDashboardPage,
  head: () => ({ meta: [{ title: "Location Dashboard — NurseConnect" }] }),
});

// Mirrors GET /api/admin/regions/detailed in app/api/v1/admin.py
interface CityRow {
  city: string;
  total_providers: number;
  by_provider_type: {
    doctors: number;
    dentists: number;
    nurses: number;
    physiotherapists: number;
    caregivers: number;
    mother_baby_caregivers: number;
  };
  active: number;
  available_now: number;
  qualified_for_package: number | null;
}
interface RegionsDetailedOut {
  package_filter: string | null;
  package_label: string | null;
  cities: CityRow[];
}

function LocationDashboardPage() {
  const [data, setData] = useState<RegionsDetailedOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packageInput, setPackageInput] = useState("");
  const [packageFilter, setPackageFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = packageFilter ? `?package=${encodeURIComponent(packageFilter)}` : "";
      const res = await apiFetch(`/api/admin/regions/detailed${qs}`);
      setData(res ?? null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [packageFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.cities.reduce(
    (acc, c) => ({
      providers: acc.providers + c.total_providers,
      nurses: acc.nurses + c.by_provider_type.nurses,
      active: acc.active + c.active,
      availableNow: acc.availableNow + c.available_now,
    }),
    { providers: 0, nurses: 0, active: 0, availableNow: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-foreground">Location Dashboard</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            City-wise provider counts, availability and package qualification — the CEO rollup view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={packageInput}
              onChange={(e) => setPackageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setPackageFilter(packageInput.trim());
              }}
              placeholder="Package/service code (e.g. injection)"
              className="w-64 rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-[12.5px]"
            />
          </div>
          <button
            onClick={() => setPackageFilter(packageInput.trim())}
            className="rounded-lg border border-border px-3 py-2 text-[12.5px] hover:bg-muted"
          >
            Apply
          </button>
          {packageFilter && (
            <button
              onClick={() => { setPackageInput(""); setPackageFilter(""); }}
              className="text-[12px] text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] hover:bg-muted">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Providers" value={totals.providers} icon={Users} tone="primary" />
          <KpiCard label="Total Nurses" value={totals.nurses} icon={ShieldCheck} tone="info" />
          <KpiCard label="Active" value={totals.active} icon={Activity} tone="success" hint="Approved & not offline" />
          <KpiCard label="Available Now" value={totals.availableNow} icon={MapPin} tone="warning" hint="Approved & online" />
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</div>}

      <Card
        title="By City"
        padded={false}
        action={
          data?.package_filter ? (
            <span className="text-muted-foreground">
              Qualified column: <span className="font-medium text-foreground">{data.package_label ?? data.package_filter}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Add a package code above to see qualified-provider counts</span>
          )
        }
      >
        {loading ? (
          <LoadingState label="Loading city rollup…" className="px-5 py-8" />
        ) : !data || data.cities.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No city data yet"
            description="Providers need a base_city set on their profile before they show up here."
            className="border-0 rounded-none"
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {["City", "Nurses", "Doctors", "Dentists", "Physio", "Caregivers", "M&B Caregivers", "Total", "Active", "Available Now"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
                {data.package_filter && (
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    Qualified
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.cities.map((c) => (
                <tr key={c.city} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin size={13} className="text-muted-foreground" />
                    {c.city}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{c.by_provider_type.nurses}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{c.by_provider_type.doctors}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{c.by_provider_type.dentists}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{c.by_provider_type.physiotherapists}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{c.by_provider_type.caregivers}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{c.by_provider_type.mother_baby_caregivers}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">{c.total_providers}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className="text-emerald-700 font-medium">{c.active}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className="text-sky-700 font-medium">{c.available_now}</span>
                  </td>
                  {data.package_filter && (
                    <td className="px-4 py-2.5 tabular-nums">
                      <span className="text-violet-700 font-medium">{c.qualified_for_package ?? 0}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
