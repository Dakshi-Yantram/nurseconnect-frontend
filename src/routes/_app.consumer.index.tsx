import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { PortalBadge } from "@/components/shared/PortalBadge";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { useAuth } from "@/lib/auth-context";
import { useConsumerPatients } from "@/lib/domain";
import { useConsumerCareSnapshot } from "@/lib/orchestration";
import { bookingPatientName, bookingService, bookingArea, bookingStartedAt } from "@/lib/orchestration/links";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { CARE_PACKAGES } from "@/lib/mock-data";
import {
  CalendarCheck, ChevronRight, AlertTriangle, Clock, HeartPulse,
  Package as PackageIcon, History as HistoryIcon, Activity,
} from "lucide-react";

export const Route = createFileRoute("/_app/consumer/")({
  component: ConsumerHome,
  head: () => ({ meta: [{ title: "My Care — NurseConnect" }] }),
});

function ConsumerHome() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const care = useConsumerCareSnapshot(ownerId);
  const patients = useConsumerPatients(ownerId).slice(0, 4);
  const activePackages = CARE_PACKAGES.filter(p => p.active).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[18px] font-semibold">
            Care journey{user ? ` · ${user.name.split(" ")[0]}` : ""}
          </div>
          <div className="text-[12.5px] text-muted-foreground">
            A continuous view of care across your patients — visits in progress, what's coming next, and what's recently been delivered.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PortalBadge portal="consumer" />
          {user && <RoleBadge role={user.role} />}
        </div>
      </div>

      <ContinuityStrip
        upcoming={care.counts.upcoming}
        inCare={care.counts.inCare}
        completed={care.counts.completed}
        escalated={care.counts.escalated}
      />

      {care.escalated.length > 0 && (
        <RuntimeBoundary label="Care alerts">
          <Card title={<span className="flex items-center gap-2 text-rose-700"><AlertTriangle className="h-4 w-4" /> Care alerts</span>} padded={false}>
            {care.escalated.slice(0, 3).map(r => {
              const state = bindStatus("booking", r.state);
              return (
                <Link key={r.id} to="/consumer/bookings/$bookingId" params={{ bookingId: r.id }}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">#{r.id} · {bookingService(r) ?? "Service"} · {bookingPatientName(r) ?? "—"}</div>
                    <div className="text-[11.5px] text-muted-foreground">Escalated — your care team is actively reviewing this visit.</div>
                  </div>
                  <StatusBadge workflow="booking" state={state} />
                </Link>
              );
            })}
          </Card>
        </RuntimeBoundary>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RuntimeBoundary label="In care now">
          <JourneyList
            title={<span className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-emerald-600" /> In care now</span>}
            emptyTitle="No visits are in progress" emptyHint="When a nurse is en route or with a patient, the visit appears here."
            rows={care.inCare.slice(0, 5)} tone="emerald"
          />
        </RuntimeBoundary>
        <RuntimeBoundary label="Upcoming care">
          <JourneyList
            title={<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Upcoming care</span>}
            action={<Link to="/consumer/bookings" className="text-[12px] text-primary">View all</Link>}
            emptyTitle="No upcoming visits" emptyHint="Schedule a service to see it appear in the continuity timeline."
            rows={care.upcoming.slice(0, 5)} tone="primary"
          />
        </RuntimeBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RuntimeBoundary label="Recently completed">
          <JourneyList
            title={<span className="flex items-center gap-2"><HistoryIcon className="h-4 w-4 text-muted-foreground" /> Recently completed</span>}
            action={<Link to="/consumer/bookings" className="text-[12px] text-primary">Full history</Link>}
            emptyTitle="No completed visits yet" emptyHint="Completed visits will accumulate here as part of the care journey."
            rows={care.completed.slice(0, 5)} tone="muted"
          />
        </RuntimeBoundary>

        <Card
          title={<span className="flex items-center gap-2"><PackageIcon className="h-4 w-4 text-muted-foreground" /> Care packages in progress</span>}
          padded={false}
        >
          {activePackages.length === 0
            ? <div className="p-5"><EmptyState icon={PackageIcon} title="No active care packages" /></div>
            : activePackages.map(p => <PackageLifecycleRow key={p.id} pkg={p} care={care} />)}
        </Card>
      </div>

      <RuntimeBoundary label="Patients under care">
        <Card
          title={<span className="flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /> Patients under care</span>}
          action={<Link to="/consumer/patients" className="text-[12px] text-primary">View all</Link>}
          padded={false}
        >
          {patients.length === 0
            ? <div className="p-5"><EmptyState title="No patients yet" /></div>
            : patients.map(p => {
                const ledger = care.byPatientId.get(p.id) ?? care.byPatient.get(p.name) ?? [];
                const upcoming  = ledger.filter(r => r.state === "pending" || r.state === "claimed").length;
                const inCare    = ledger.filter(r => r.state === "active"  || r.state === "in_progress").length;
                const completed = ledger.filter(r => r.state === "completed").length;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                    <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                      <HeartPulse className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{p.name}</div>
                      <div className="text-[11.5px] text-muted-foreground truncate">
                        {p.plan} · last visit {p.lastVisit ?? "—"}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                      <span><span className="text-emerald-700 font-semibold">{inCare}</span> in care</span>
                      <span><span className="text-primary font-semibold">{upcoming}</span> upcoming</span>
                      <span><span className="text-foreground font-semibold">{completed}</span> done</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
        </Card>
      </RuntimeBoundary>
    </div>
  );
}

function ContinuityStrip({
  upcoming, inCare, completed, escalated,
}: { upcoming: number; inCare: number; completed: number; escalated: number }) {
  const cells: Array<{ label: string; value: number; tone: string; hint: string }> = [
    { label: "In care now",  value: inCare,    tone: "text-emerald-700 bg-emerald-50 border-emerald-200", hint: "Visits underway" },
    { label: "Upcoming",     value: upcoming,  tone: "text-primary bg-primary/5 border-primary/20",       hint: "Scheduled next" },
    { label: "Completed",    value: completed, tone: "text-foreground bg-muted border-border",            hint: "Recent care delivered" },
    { label: "Needs review", value: escalated, tone: "text-rose-700 bg-rose-50 border-rose-200",          hint: "Escalations open" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cells.map(c => (
        <div key={c.label} className={`rounded-lg border px-3 py-3 ${c.tone}`}>
          <div className="text-[10.5px] uppercase tracking-wide opacity-80">{c.label}</div>
          <div className="text-[22px] font-semibold leading-tight mt-0.5">{c.value}</div>
          <div className="text-[11px] opacity-75 mt-0.5">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}

function JourneyList({
  title, action, rows, emptyTitle, emptyHint, tone,
}: {
  title: React.ReactNode; action?: React.ReactNode;
  rows: ReturnType<typeof useConsumerCareSnapshot>["upcoming"];
  emptyTitle: string; emptyHint?: string;
  tone: "primary" | "emerald" | "muted";
}) {
  const railTone =
    tone === "emerald" ? "bg-emerald-500"
    : tone === "primary" ? "bg-primary"
    : "bg-muted-foreground/40";

  return (
    <Card title={title} action={action} padded={false}>
      {rows.length === 0
        ? <div className="p-5"><EmptyState icon={CalendarCheck} title={emptyTitle} description={emptyHint} /></div>
        : rows.map(r => {
            const state = bindStatus("booking", r.state);
            const started = bookingStartedAt(r);
            return (
              <Link key={r.id} to="/consumer/bookings/$bookingId" params={{ bookingId: r.id }}
                className="flex items-stretch gap-3 border-b border-border last:border-0 hover:bg-muted/30">
                <span className={`w-1 ${railTone}`} aria-hidden />
                <div className="flex items-center gap-3 flex-1 py-3 pr-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">
                      {bookingPatientName(r) ?? "—"} · {bookingService(r) ?? "Service"}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground truncate">
                      #{r.id} · {bookingArea(r) ?? "—"}{started ? ` · ${started}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge workflow="booking" state={state} />
                    <SLAIndicator workflow="booking" state={state} enteredAt={parseEnteredAt(r.enteredAt)} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            );
          })}
    </Card>
  );
}

function PackageLifecycleRow({
  pkg, care,
}: { pkg: typeof CARE_PACKAGES[number]; care: ReturnType<typeof useConsumerCareSnapshot> }) {
  const linked = care.all.filter(r => {
    const svc = String((r.data as any)?.service ?? "").toLowerCase();
    return svc.includes(pkg.name.split(" ")[0].toLowerCase());
  });
  const delivered = linked.filter(r => r.state === "completed").length;
  const planned   = Math.max(pkg.visits, delivered);
  const pct       = planned === 0 ? 0 : Math.min(100, Math.round((delivered / planned) * 100));

  return (
    <div className="px-4 py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate">{pkg.name}</div>
          <div className="text-[11.5px] text-muted-foreground truncate">{pkg.target} · {pkg.visits} visits / {pkg.days}d</div>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">{delivered}/{planned}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}