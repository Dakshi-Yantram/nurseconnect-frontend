import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { EmptyState } from "@/components/shared/EmptyState";
import { OperationsLifecycleStrip } from "@/components/journey/OperationsLifecycleStrip";
import { apiFetch } from "@/lib/api";
import {
  Activity as ActivityIcon, Clock, Users, MapPin,
  ShieldAlert, Inbox, ArrowRight, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_app/ops-dashboard")({
  component: OpsDashboardPage,
  head: () => ({ meta: [{ title: "Operations Command Center — NurseConnect" }] }),
});

// ─── Types (mirror app/api/v1/admin.py GET /admin/ops-snapshot) ───────────────

interface PriorityItem {
  workflow: string;
  id: string;
  title: string;
  subtitle: string;
  priority: "urgent" | "high" | "normal" | "low";
  state: string;
  entered_at: string;
}
interface InterventionItem {
  id: string;
  workflow: string;
  entity_id: string | null;
  action: string;
  actor: string;
  at: string;
}
interface OpsSnapshot {
  dispatch: { unclaimed: number; claimed: number };
  escalations: { active: number; opened_24h: number; recovered_24h: number };
  sla_breached: number;
  disputes_open: number;
  urgent: number;
  priority_feed: PriorityItem[];
  intervention_feed: InterventionItem[];
  last_intervention_at: string | null;
}
interface RegionRow { city: string; nurses: number; patients: number; visits: number; revenue: number }
interface LiveVisitRow {
  id: string; patient: string; nurse: string | null; status: string;
  area: string; scheduled_date: string; scheduled_time: string; amount: number; is_urgent: boolean;
}

const PRIORITY_TONE: Record<PriorityItem["priority"], string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
  high:   "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-sky-50 text-sky-700 border-sky-200",
  low:    "bg-slate-50 text-slate-600 border-slate-200",
};

function linkFor(it: PriorityItem): string | undefined {
  if (it.workflow === "escalation") return `/clinical-escalation/${it.id}`;
  if (it.workflow === "dispute") return `/disputes/${it.id}`;
  return undefined;
}

function PriorityRow({ item }: { item: PriorityItem }) {
  const href = linkFor(item);
  const content = (
    <>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${PRIORITY_TONE[item.priority]}`}>
        {item.priority}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium truncate">
          #{item.id} · {item.title}
        </div>
        <div className="text-[11.5px] text-muted-foreground truncate">
          {item.workflow} · {item.subtitle} · {item.state}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10.5px] text-muted-foreground">{new Date(item.entered_at).toLocaleString()}</span>
        {href && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
    </>
  );

  return href ? (
    <Link to={href} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30">
      {content}
    </Link>
  ) : (
    <li className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
      {content}
    </li>
  );
}

const CITY_POSITIONS: Record<string, { x: number; y: number }> = {
  "Bangalore": { x: 45, y: 65 },
  "Mumbai": { x: 22, y: 55 },
  "Delhi NCR": { x: 38, y: 25 },
  "Chennai": { x: 55, y: 78 },
};

function OpsDashboardPage() {
  const [snap, setSnap] = useState<OpsSnapshot | null>(null);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [liveVisits, setLiveVisits] = useState<LiveVisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch("/api/admin/ops-snapshot"),
      apiFetch("/api/admin/regions"),
      apiFetch("/api/admin/live-visits"),
    ])
      .then(([s, r, v]) => { setSnap(s); setRegions(r); setLiveVisits(v); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load operations snapshot"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-16 text-center text-[13px] text-muted-foreground">Loading operations snapshot…</div>;
  }
  if (error || !snap) {
    return (
      <div className="py-16 text-center text-[13px] text-red-600">
        {error ?? "Failed to load"}
        <button onClick={load} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  const dispatchInFlight = snap.dispatch.unclaimed + snap.dispatch.claimed;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md grid place-items-center bg-sky-100 text-sky-700">
          <ActivityIcon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[15px] font-semibold">Operations command center</div>
          <div className="text-[12px] text-muted-foreground">
            Coordinated dispatch, escalation, and intervention visibility across portals.
          </div>
        </div>
      </div>

      <OperationsLifecycleStrip
        actionable={snap.priority_feed.length}
        decidedRecent={snap.intervention_feed.length}
        urgent={snap.urgent}
        breached={snap.sla_breached}
        activeEscalations={snap.escalations.active}
        recoveredEscalations={snap.escalations.recovered_24h}
        dispatchInFlight={dispatchInFlight}
        lastInterventionAt={snap.last_intervention_at ?? undefined}
        nextLabel={
          snap.urgent > 0 ? "Resolve urgent items"
          : snap.escalations.active > 0 ? "Clear escalations"
          : snap.dispatch.unclaimed > 0 ? "Dispatch open bookings"
          : "Operator dispatch"
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Dispatch in flight"
          value={String(dispatchInFlight)}
          icon={ActivityIcon} tone="primary"
          hint={`${snap.dispatch.unclaimed} open · ${snap.dispatch.claimed} claimed`} />
        <KpiCard label="Active escalations"
          value={String(snap.escalations.active)}
          icon={ShieldAlert} tone="warning"
          hint={`${snap.escalations.recovered_24h} recovered · ${snap.escalations.opened_24h} opened (24h)`} />
        <KpiCard label="SLA breached"
          value={String(snap.sla_breached)}
          icon={Clock} tone={snap.sla_breached > 0 ? "warning" : "success"}
          hint="Escalations past SLA" />
        <KpiCard label="Open disputes"
          value={String(snap.disputes_open)}
          icon={Users} tone="info" hint="Awaiting resolution" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={
          <span className="flex items-center gap-2">
            Operational priorities
            <span className="text-[11px] font-normal text-muted-foreground">
              ({snap.priority_feed.length})
            </span>
          </span>
        } padded={false} className="lg:col-span-2">
          {snap.priority_feed.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Inbox} title="No actionable items right now" />
            </div>
          ) : (
            <ul>
              {snap.priority_feed.map(it => (
                <PriorityRow key={`${it.workflow}:${it.id}`} item={it} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Intervention continuity"
          action={<Link to="/audit-logs" className="text-primary font-medium">All activity →</Link>}>
          {snap.intervention_feed.length === 0 ? (
            <EmptyState icon={ActivityIcon} title="No recent interventions" />
          ) : (
            <ul className="-my-1 divide-y divide-border">
              {snap.intervention_feed.slice(0, 8).map(e => (
                <li key={e.id} className="py-2.5 flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-sky-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-foreground truncate">
                      <span className="font-medium">{e.workflow}</span>
                      <span className="text-muted-foreground"> · {e.action}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      by {e.actor} · {new Date(e.at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Live Operations Map" className="lg:col-span-2" padded={false}>
          <div className="relative h-[420px] bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50 rounded-b-lg overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 40%, #2563EB22 1px, transparent 2px), radial-gradient(circle at 60% 60%, #10B98122 1px, transparent 2px)", backgroundSize: "30px 30px" }} />
            {regions.filter(r => CITY_POSITIONS[r.city]).map(r => {
              const pos = CITY_POSITIONS[r.city];
              return (
                <div key={r.city} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping h-10 w-10" />
                    <div className="relative h-10 w-10 rounded-full bg-primary text-white grid place-items-center font-semibold text-[12px] shadow-lg">{r.visits}</div>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-foreground bg-card/80 backdrop-blur px-1.5 py-0.5 rounded">{r.city}</div>
                </div>
              );
            })}
            <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground bg-card/80 px-2 py-1 rounded">Integration: Google Maps / Mapbox</div>
          </div>
        </Card>

        <Card title="Regional Capacity">
          <ul className="space-y-3">
            {regions.length === 0 && <li className="text-[12.5px] text-muted-foreground">No regional data yet.</li>}
            {regions.map(r => {
              const load = r.nurses > 0 ? Math.min(100, Math.round((r.visits / r.nurses) * 4)) : 0;
              return (
                <li key={r.city}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{r.city}</span>
                    <span className="text-muted-foreground">{load}% load</span>
                  </div>
                  <div className="mt-1.5 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${load > 80 ? "bg-rose-500" : load > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${load}%` }} />
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-1">{r.nurses} nurses · {r.visits} visits</div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card title="Live Bookings" padded={false}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5 font-medium">Booking</th>
              <th className="px-5 py-2.5 font-medium">Patient</th>
              <th className="px-5 py-2.5 font-medium">Nurse</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Time</th>
              <th className="px-5 py-2.5 font-medium">Area</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {liveVisits.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No live bookings right now.</td></tr>
            )}
            {liveVisits.map(v => (
              <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-[12px]">#{v.id}</td>
                <td className="px-5 py-3 font-medium">{v.patient}</td>
                <td className="px-5 py-3">{v.nurse ?? "Unassigned"}</td>
                <td className="px-5 py-3">{v.scheduled_date}</td>
                <td className="px-5 py-3">{v.scheduled_time}</td>
                <td className="px-5 py-3 text-muted-foreground">{v.area}</td>
                <td className="px-5 py-3"><StatusChip tone={statusToneFor(v.status)} label={v.status.replace("_"," ")} dot /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
