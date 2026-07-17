import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { Heart, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/subscription-subsidy")({ component: SubsPage });

interface SubsidyRow {
  id: string;
  patient: string;
  scheme: string;
  verified: boolean;
  subsidy_percent: number;
  expires: string | null;
}

// Note: there is no subscription/billing-plan feature in the backend today
// (no Subscription model, no plan tiers) — this page only covers the
// government/scheme subsidy program, which does have a real backend model
// (SubsidyEligibility). If a paid-subscription product is planned, that's
// net-new scope, not a data migration.
function SubsPage() {
  const [recipients, setRecipients] = useState<SubsidyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/admin/subsidy-recipients")
      .then(setRecipients)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load subsidy recipients"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const verifiedCount = recipients.filter(r => r.verified).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiCard label="Subsidy Recipients" value={recipients.length} hint="BPL + Senior + state schemes" icon={Heart} tone="purple" />
        <KpiCard label="Verified" value={verifiedCount} hint={`of ${recipients.length} total`} icon={Heart} tone="success" />
      </div>

      <Card title="Subsidy Recipients" padded={false}>
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
              <th className="px-5 py-2.5">Patient</th><th className="px-5 py-2.5">Scheme</th>
              <th className="px-5 py-2.5">Verified</th><th className="px-5 py-2.5">Subsidy %</th>
              <th className="px-5 py-2.5">Expires</th>
            </tr></thead>
            <tbody>
              {recipients.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No subsidy recipients yet.</td></tr>
              )}
              {recipients.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{r.patient}</td>
                  <td className="px-5 py-3"><StatusChip tone="purple" label={r.scheme} /></td>
                  <td className="px-5 py-3">{r.verified ? <StatusChip tone="success" label="Verified" /> : <StatusChip tone="warning" label="Pending" />}</td>
                  <td className="px-5 py-3">{r.subsidy_percent}%</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.expires ? new Date(r.expires).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
