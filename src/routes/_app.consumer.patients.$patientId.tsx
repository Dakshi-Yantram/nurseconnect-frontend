import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, HeartPulse, Clock, History as HistoryIcon } from "lucide-react";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { useConsumerPatients } from "@/lib/domain";
import { useConsumerCareSnapshot } from "@/lib/orchestration";
import { bookingService, bookingArea, bookingStartedAt } from "@/lib/orchestration/links";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { useAuth } from "@/lib/auth-context";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/consumer/patients/$patientId")({
  component: PatientDetail,
  head: () => ({ meta: [{ title: "Patient — NurseConnect" }] }),
});

function PatientDetail() {
  const { patientId } = Route.useParams();
  const { user } = useAuth();
  const ownerId = user?.id ?? null;

  const patients = useConsumerPatients(ownerId);
  const care = useConsumerCareSnapshot(ownerId);

  const patient = patients.find(p => p.id === patientId);

  // Pull all bookings for this patient from the care snapshot
  const ledger =
    care.byPatientId.get(patientId) ??
    care.byPatient.get(patient?.name ?? "") ??
    [];

  const inCare    = ledger.filter(r => r.state === "active" || r.state === "in_progress");
  const upcoming  = ledger.filter(r => r.state === "pending" || r.state === "claimed");
  const completed = ledger.filter(r => r.state === "completed");

  if (!patient) {
    return (
      <div className="space-y-4">
        <Link
          to="/consumer/patients"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to patients
        </Link>
        <Card title="Patient not found">
          <EmptyState title="This patient could not be found." />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Back nav */}
      <Link
        to="/consumer/patients"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to patients
      </Link>

      {/* Patient summary card */}
      <Card title={`${patient.name} · ${patient.plan}`}>
        <div className="space-y-1 text-[13px]">
          {patient.age   && <div><span className="text-muted-foreground">Age:</span> {patient.age}</div>}
          {patient.gender && <div><span className="text-muted-foreground">Gender:</span> {patient.gender}</div>}
          {patient.city  && <div><span className="text-muted-foreground">City:</span> {patient.city}</div>}
          <div><span className="text-muted-foreground">Last visit:</span> {patient.lastVisit ?? "—"}</div>
        </div>
      </Card>

      {/* Visit buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <RuntimeBoundary label="In care now">
          <Card
            title={
              <span className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-emerald-600" /> In care now
              </span>
            }
            padded={false}
          >
            {inCare.length === 0
              ? <div className="p-5"><EmptyState title="No visits in progress" /></div>
              : inCare.map(r => <VisitRow key={r.id} r={r} rail="bg-emerald-500" />)}
          </Card>
        </RuntimeBoundary>

        <RuntimeBoundary label="Upcoming visits">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Upcoming visits
              </span>
            }
            padded={false}
          >
            {upcoming.length === 0
              ? <div className="p-5"><EmptyState title="No upcoming visits" /></div>
              : upcoming.map(r => <VisitRow key={r.id} r={r} rail="bg-primary" />)}
          </Card>
        </RuntimeBoundary>

      </div>

      <RuntimeBoundary label="Visit history">
        <Card
          title={
            <span className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-muted-foreground" /> Visit history
            </span>
          }
          padded={false}
        >
          {completed.length === 0
            ? <div className="p-5"><EmptyState title="No completed visits yet" description="Completed visits will appear here." /></div>
            : completed.map(r => <VisitRow key={r.id} r={r} rail="bg-muted-foreground/40" />)}
        </Card>
      </RuntimeBoundary>

    </div>
  );
}

function VisitRow({ r, rail }: { r: any; rail: string }) {
  const state   = bindStatus("booking", r.state);
  const started = bookingStartedAt(r);
  return (
    <Link
      to="/consumer/bookings/$bookingId"
      params={{ bookingId: r.id }}
      className="flex items-stretch gap-3 border-b border-border last:border-0 hover:bg-muted/30"
    >
      <span className={`w-1 shrink-0 ${rail}`} aria-hidden />
      <div className="flex items-center gap-3 flex-1 py-3 pr-4">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate">
            {bookingService(r) ?? "Service"}
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
}