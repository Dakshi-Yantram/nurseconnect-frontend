import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { QueuePanel } from "@/components/shared/QueuePanel";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { OperationsLifecycleStrip } from "@/components/journey/OperationsLifecycleStrip";
import { useAdminOperationsSnapshot, type QueueItem } from "@/lib/orchestration";
import { bookingPatientName } from "@/lib/orchestration/links";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { useHydrated } from "@/hooks/use-hydrated";
import { ACTIVE_VISITS, REGIONS } from "@/lib/mock-data";
import {
  Activity as ActivityIcon, Clock, Users, MapPin,
  ShieldAlert, Inbox, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_app/ops-dashboard")({
  component: OpsDashboardPage,
  head: () => ({ meta: [{ title: "Operations Command Center — NurseConnect" }] }),
});

/**
 * Phase 9A — Admin operations command-center surface.
 *
 * Reads through `useAdminOperationsSnapshot()` so the page coordinates
 * dispatch / escalation / moderation / dispute / SLA visibility from a single
 * memoized derivation. The page now leads with operational continuity
 * (lifecycle strip + prioritized actionable feed + recent intervention
 * timeline) before falling back to per-queue rollups — admin runtime
 * reads as a coordinated command center, not an ERP module grid.
 */
function OpsDashboardPage() {
  const hydrated = useHydrated();
  const snap = useAdminOperationsSnapshot();
  const {
    counts, dispatch, escalationLifecycle, interventionLifecycle, priorityFeed,
  } = snap;

  return (
    <div className="space-y-6">
      {/* Command-center chrome */}
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

      {hydrated && (
        <OperationsLifecycleStrip
          actionable={counts.actionable}
          decidedRecent={interventionLifecycle.decidedRecent}
          urgent={counts.urgent}
          breached={counts.breached}
          activeEscalations={escalationLifecycle.active}
          recoveredEscalations={escalationLifecycle.recovered24h}
          dispatchInFlight={dispatch.unclaimed + dispatch.claimed}
          lastInterventionAt={interventionLifecycle.lastAt}
          nextLabel={
            counts.urgent > 0 ? "Resolve urgent items"
            : escalationLifecycle.active > 0 ? "Clear escalations"
            : dispatch.unclaimed > 0 ? "Dispatch open bookings"
            : "Operator dispatch"
          }
        />
      )}

      {/* Operational KPIs — re-framed around continuity, not isolated modules. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Dispatch in flight"
          value={String(dispatch.unclaimed + dispatch.claimed)}
          icon={ActivityIcon} tone="primary"
          hint={`${dispatch.unclaimed} open · ${dispatch.claimed} claimed`} />
        <KpiCard label="Active escalations"
          value={String(escalationLifecycle.active)}
          icon={ShieldAlert} tone="warning"
          hint={`${escalationLifecycle.recovered24h} recovered · ${escalationLifecycle.opened24h} opened (24h)`} />
        <KpiCard label="SLA breached"
          value={String(counts.slaBreached)}
          icon={Clock} tone={counts.slaBreached > 0 ? "warning" : "success"}
          hint="Across workflows" />
        <KpiCard label="Open disputes"
          value={String(counts.dispute)}
          icon={Users} tone="info" hint="Awaiting resolution" />
      </div>

      {/* Priority + intervention continuity — the command-center heart. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RuntimeBoundary label="Operational priorities">
          <Card title={
            <span className="flex items-center gap-2">
              Operational priorities
              <span className="text-[11px] font-normal text-muted-foreground">
                ({priorityFeed.length})
              </span>
            </span>
          } padded={false} className="lg:col-span-2">
            {!hydrated ? (
              <div className="p-5 text-[12.5px] text-muted-foreground">Loading…</div>
            ) : priorityFeed.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Inbox} title="No actionable items right now" />
              </div>
            ) : (
              <ul>
                {priorityFeed.map(it => (
                  <PriorityRow key={`${it.workflow}:${it.id}`} item={it} />
                ))}
              </ul>
            )}
          </Card>
        </RuntimeBoundary>

        <RuntimeBoundary label="Intervention continuity">
          <Card title="Intervention continuity"
            action={<Link to="/audit-logs" className="text-primary font-medium">All activity →</Link>}>
            {!hydrated ? (
              <div className="text-[12.5px] text-muted-foreground">Loading…</div>
            ) : interventionLifecycle.feed.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No recent interventions" />
            ) : (
              <ul className="-my-1 divide-y divide-border">
                {interventionLifecycle.feed.slice(0, 8).map(e => (
                  <li key={e.id} className="py-2.5 flex items-start gap-2.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                      e.tone === "danger" ? "bg-rose-500" :
                      e.tone === "warning" ? "bg-amber-500" :
                      e.tone === "success" ? "bg-emerald-500" : "bg-sky-500"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-foreground truncate">
                        <span className="font-medium">#{e.entityId}</span>
                        <span className="text-muted-foreground"> · {e.workflow}</span>
                        <span className="text-muted-foreground"> · {e.from ?? "?"} → {e.to ?? "?"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        by {e.actor}{e.notes ? ` · ${e.notes}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </RuntimeBoundary>
      </div>

      {/* Per-queue rollups — preserved for operator drill-down, but framed
          as supporting context now that priorities/continuity lead. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RuntimeBoundary label="Assignment queue">
          <QueuePanel name="assignment" />
        </RuntimeBoundary>
        <RuntimeBoundary label="Escalation queue">
          <QueuePanel name="escalation" linkFor={(it) => `/clinical-escalation/${it.id}`} />
        </RuntimeBoundary>
        <RuntimeBoundary label="Moderation queue">
          <QueuePanel name="moderation" linkFor={(it) =>
            it.workflow === "incident"  ? `/incidents/${it.id}` :
            it.workflow === "complaint" ? `/complaints/${it.id}` : undefined
          } />
        </RuntimeBoundary>
        <RuntimeBoundary label="SLA breached">
          <QueuePanel name="sla_breached" emptyTitle="No SLA breaches" />
        </RuntimeBoundary>
        <RuntimeBoundary label="Dispute queue">
          <QueuePanel name="dispute" linkFor={(it) => `/disputes/${it.id}`} />
        </RuntimeBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Live Operations Map" className="lg:col-span-2" padded={false}>
          <div className="relative h-[420px] bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50 rounded-b-lg overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 40%, #2563EB22 1px, transparent 2px), radial-gradient(circle at 60% 60%, #10B98122 1px, transparent 2px)", backgroundSize: "30px 30px" }} />
            {[
              { city: "Bangalore", x: 45, y: 65, count: 18 },
              { city: "Mumbai", x: 22, y: 55, count: 11 },
              { city: "Delhi NCR", x: 38, y: 25, count: 8 },
              { city: "Chennai", x: 55, y: 78, count: 5 },
            ].map(p => (
              <div key={p.city} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping h-10 w-10" />
                  <div className="relative h-10 w-10 rounded-full bg-primary text-white grid place-items-center font-semibold text-[12px] shadow-lg">{p.count}</div>
                </div>
                <div className="mt-1 text-[11px] font-medium text-foreground bg-card/80 backdrop-blur px-1.5 py-0.5 rounded">{p.city}</div>
              </div>
            ))}
            <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground bg-card/80 px-2 py-1 rounded">Integration: Google Maps / Mapbox</div>
          </div>
        </Card>

        <Card title="Regional Capacity">
          <ul className="space-y-3">
            {REGIONS.map(r => {
              const load = Math.min(100, Math.round((r.visits / r.nurses) * 4));
              return (
                <li key={r.city}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{r.city}</span>
                    <span className="text-muted-foreground">{load}% load</span>
                  </div>
                  <div className="mt-1.5 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${load > 80 ? "bg-rose-500" : load > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${load}%` }} />
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-1">{r.nurses} nurses · {r.visits} visits today</div>
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
              <th className="px-5 py-2.5 font-medium">Service</th>
              <th className="px-5 py-2.5 font-medium">Started</th>
              <th className="px-5 py-2.5 font-medium">Duration</th>
              <th className="px-5 py-2.5 font-medium">Area</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVE_VISITS.map(v => (
              <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-[12px]">#{v.id}</td>
                <td className="px-5 py-3 font-medium">{v.patient}</td>
                <td className="px-5 py-3">{v.nurse}</td>
                <td className="px-5 py-3">{v.service}</td>
                <td className="px-5 py-3">{v.started}</td>
                <td className="px-5 py-3">{v.duration}</td>
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

const PRIORITY_TONE: Record<QueueItem["priority"], string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
  high:   "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-sky-50 text-sky-700 border-sky-200",
  low:    "bg-slate-50 text-slate-600 border-slate-200",
};

function itemLabel(it: QueueItem): string {
  const d: any = it.record.data;
  return d?.title ?? d?.service ?? d?.subject ?? d?.name ?? `#${it.id}`;
}
function itemSubLabel(it: QueueItem): string {
  const d: any = it.record.data;
  return bookingPatientName(it.record) ?? d?.reporter ?? d?.from ?? d?.area ?? "—";
}
function linkFor(it: QueueItem): string | undefined {
  if (it.workflow === "escalation") return `/clinical-escalation/${it.id}`;
  if (it.workflow === "incident")   return `/incidents/${it.id}`;
  if (it.workflow === "complaint")  return `/complaints/${it.id}`;
  if (it.workflow === "dispute")    return `/disputes/${it.id}`;
  if (it.workflow === "booking")    return `/bookings/${it.id}`;
  return undefined;
}

function PriorityRow({ item }: { item: QueueItem }) {
  const href = linkFor(item);
  const content = (
    <>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${PRIORITY_TONE[item.priority]}`}>
        {item.priority}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium truncate">
          #{item.id} · {itemLabel(item)}
        </div>
        <div className="text-[11.5px] text-muted-foreground truncate">
          {item.workflow} · {itemSubLabel(item)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge workflow={item.workflow} state={bindStatus(item.workflow, item.state)} />
        <SLAIndicator workflow={item.workflow} state={item.state}
          enteredAt={parseEnteredAt(item.enteredAt)} />
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

