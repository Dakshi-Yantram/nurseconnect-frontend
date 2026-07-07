import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/shared/EmptyState";
import { WorkflowActionButton } from "@/components/shared/WorkflowActionButton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import {
  useTransition, useClaim, useRelease,
  useWorkerExecutionSnapshot, useUnclaimedEntities, type QueueItem,
} from "@/lib/orchestration";
import { bookingPatientName, bookingService, bookingArea, bookingStartedAt } from "@/lib/orchestration/links";
import { useWorkerEligibility } from "@/lib/competency";
import { useAuth } from "@/lib/auth-context";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { actionsForState } from "@/lib/workflows";
import { can } from "@/lib/actions";
type Role = Parameters<typeof can>[0];
import {
  Briefcase, HandHeart, ShieldAlert, Clock, MapPin,
  IndianRupee, Calendar, ChevronRight, UserRound, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const PRIORITY_CHIP: Record<QueueItem["priority"], string> = {
  urgent: "bg-rose-50 text-rose-700 border border-rose-200",
  high:   "bg-amber-50 text-amber-700 border border-amber-200",
  normal: "bg-sky-50 text-sky-700 border border-sky-200",
  low:    "bg-slate-50 text-slate-600 border border-slate-200",
};
function PriorityChip({ p }: { p: QueueItem["priority"] }) {
  return (
    <span className={`text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded-full ${PRIORITY_CHIP[p]}`}>
      {p}
    </span>
  );
}

type Tab = "new_requests" | "my_schedule";

function TabBar({ active, onChange, newCount, myCount }: {
  active: Tab; onChange: (t: Tab) => void; newCount: number; myCount: number;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted/40 border border-border rounded-lg w-fit">
      {([
        { id: "new_requests" as Tab, label: "New Requests", count: newCount },
        { id: "my_schedule"  as Tab, label: "Today's Schedule", count: myCount },
      ] as const).map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={[
            "relative px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
            active === id
              ? "bg-[#1a2744] text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          ].join(" ")}
        >
          {label}
          {count > 0 && (
            <span className={[
              "ml-1.5 inline-flex items-center justify-center text-[10px] font-bold rounded-full w-4 h-4",
              active === id ? "bg-teal-400 text-[#1a2744]" : "bg-muted-foreground/20 text-muted-foreground",
            ].join(" ")}>
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface RequestCardProps {
  id: string;
  patientName: string;
  age?: string | number;
  service: string;
  dateTime?: string;
  duration?: string;
  location?: string;
  distance?: string;
  amount?: string | number;
  priority?: QueueItem["priority"];
  state: string;
  enteredAt?: string | Date | null;
  onClaim: () => void;
  onDecline: () => void;
  role: Role | null;
}

function RequestCard({
  id, patientName, age, service, dateTime, duration,
  location, distance, amount, priority, state, enteredAt,
  onClaim, onDecline, role,
}: RequestCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1a2744]/10 flex items-center justify-center shrink-0 mt-0.5">
            <UserRound className="w-4 h-4 text-[#1a2744]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-foreground leading-tight">{patientName}</span>
              {age && <span className="text-[12px] text-muted-foreground font-normal">{age} yrs</span>}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Stethoscope className="w-3 h-3 text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">{service}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge workflow="booking" state={state} />
          {priority && <PriorityChip p={priority} />}
        </div>
      </div>

      <div className="h-px bg-border mx-4" />

      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {dateTime && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{dateTime}{duration ? ` · ${duration}` : ""}</span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{location}</span>
            {distance && <span className="ml-auto text-[11px] font-medium text-teal-600 shrink-0">{distance}</span>}
          </div>
        )}
        {enteredAt && (
          <div className="col-span-2">
            <SLAIndicator
              workflow="booking" state={state}
              enteredAt={parseEnteredAt(typeof enteredAt === "string" ? enteredAt : undefined)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border">
        {amount ? (
          <div className="flex items-center gap-0.5 text-[15px] font-semibold text-[#1a2744]">
            <IndianRupee className="w-3.5 h-3.5" />{amount}
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground">—</span>
        )}

        <div className="flex items-center gap-2">
          {can(role, "worker.claim_assignment") && (
            <>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-border text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={onDecline}
              >
                Decline
              </button>
              {/* Accept — no eligibility gate */}
              <button
                type="button"
                onClick={onClaim}
                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-[12.5px] font-medium hover:bg-teal-700 transition-colors"
              >
                Accept
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ScheduleCardProps {
  id: string;
  patientName: string;
  service: string;
  dateTime?: string;
  location?: string;
  priority?: QueueItem["priority"];
  state: string;
  enteredAt?: string | Date | null;
  role: Role | null;
  actor: string;
  onAccept: () => void;
  onRelease: () => void;
  allowedActions: string[];
}

function ScheduleCard({
  id, patientName, service, dateTime, location,
  priority, state, enteredAt, role, onAccept, onRelease, allowedActions,
}: ScheduleCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="w-1 self-stretch rounded-full bg-teal-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link
                to="/worker/visits/$visitId"
                params={{ visitId: id }}
                className="text-[13.5px] font-semibold text-foreground hover:text-primary transition-colors"
              >
                {patientName}
              </Link>
              <div className="flex items-center gap-1 mt-0.5">
                <Stethoscope className="w-3 h-3 text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">{service}</span>
                <span className="text-muted-foreground/40 mx-1">·</span>
                <span className="text-[11px] text-muted-foreground/60">#{id}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge workflow="booking" state={state} />
              {priority && <PriorityChip p={priority} />}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {dateTime && (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <Clock className="w-3 h-3" />{dateTime}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <MapPin className="w-3 h-3" />{location}
              </span>
            )}
            {enteredAt && (
              <SLAIndicator workflow="booking" state={state}
                enteredAt={parseEnteredAt(typeof enteredAt === "string" ? enteredAt : undefined)} />
            )}
          </div>

          {(allowedActions.includes("worker.accept_assignment") || allowedActions.includes("worker.release_assignment")) && (
            <div className="flex gap-2 mt-3">
              {allowedActions.includes("worker.accept_assignment") && state === "claimed" && (
                <WorkflowActionButton action="worker.accept_assignment" onClick={onAccept}>
                  Accept
                </WorkflowActionButton>
              )}
              {allowedActions.includes("worker.release_assignment") && (
                <WorkflowActionButton action="worker.release_assignment" variant="secondary" onClick={onRelease}>
                  Release
                </WorkflowActionButton>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/worker/assignments")({
  component: WorkerAssignments,
  head: () => ({ meta: [{ title: "Assignments — NurseConnect" }] }),
});

function WorkerAssignments() {
  const { user } = useAuth();
  const role = (user?.role ?? null) as Role | null;
  const claimantId = user?.id ?? "worker-anon";
  const actor = user?.email ?? "worker@nurseconnect.in";

  const { mine, priorityFor } = useWorkerExecutionSnapshot(claimantId);

  const CLAIMABLE_STATES = new Set(["pending", "active", "claimed"]);
  const unclaimedAll = useUnclaimedEntities("booking");
  const open = unclaimedAll.filter(r => CLAIMABLE_STATES.has(r.state));

  const claim = useClaim();
  const release = useRelease();
  const transition = useTransition();

  // eligibility still read (for banner display) but NOT used to gate claiming
  const eligibility = useWorkerEligibility(claimantId);

  const [activeTab, setActiveTab] = useState<Tab>("new_requests");
  // Track locally declined cards so they disappear from UI
  const [declined, setDeclined] = useState<Set<string>>(new Set());

  const tryClaim = (id: string) => {
    // ← eligibility check removed — Accept works regardless of training status
    claim(
      {
        workflow: "booking", entityId: id,
        claimantId, claimantName: user?.name ?? actor, role,
      },
      { successMessage: `Assignment #${id} accepted` },
    );
  };

  const handleDecline = (id: string) => {
    setDeclined(prev => new Set(prev).add(id));
    toast("Assignment declined.");
  };

  const visibleOpen = open.filter(r => !declined.has(r.id));

  return (
    <div className="space-y-5">

      {/* Eligibility banner — still shown as info, but no longer blocks Accept */}
      {!eligibility.eligible && (
        <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2.5 text-[12.5px] flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">Training incomplete</div>
            <div>
              {eligibility.approved}/{eligibility.total} competencies approved. Complete your training when possible.
            </div>
          </div>
          <Link to="/worker/training" className="text-[12px] font-medium underline whitespace-nowrap">
            Open training
          </Link>
        </div>
      )}

      {/* DEV debug panel */}
      {import.meta.env.DEV && (
        <details className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
          <summary className="cursor-pointer font-semibold">
            Debug: {unclaimedAll.length} unclaimed · {open.length} claimable · worker: {claimantId}
          </summary>
          <div className="mt-1.5 space-y-0.5">
            {unclaimedAll.length === 0
              ? <span className="text-blue-600">No unclaimed bookings.</span>
              : unclaimedAll.map(r => (
                  <div key={r.id} className="font-mono">
                    #{r.id} state=<strong>{r.state}</strong> claimantId={String((r as any).claimantId ?? "—")}
                  </div>
                ))}
          </div>
        </details>
      )}

      {/* Tab bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabBar
          active={activeTab}
          onChange={setActiveTab}
          newCount={visibleOpen.length}
          myCount={mine.length}
        />
        <p className="text-[12px] text-muted-foreground">
          {activeTab === "new_requests"
            ? `${visibleOpen.length} open assignment${visibleOpen.length !== 1 ? "s" : ""} available`
            : `${mine.length} assignment${mine.length !== 1 ? "s" : ""} in your schedule`}
        </p>
      </div>

      {/* New Requests */}
      {activeTab === "new_requests" && (
        visibleOpen.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-2">
            <Briefcase className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-[14px] font-medium text-foreground">Queue is empty</p>
            <p className="text-[12px] text-muted-foreground">New assignments will appear here as they come in.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleOpen.map((r) => {
              const state   = bindStatus("booking", r.state);
              const p       = priorityFor(r.id);
              const service = bookingService(r) ?? "Service";
              const started = bookingStartedAt(r);
              const patient = bookingPatientName(r) ?? "—";
              const area    = bookingArea(r) ?? undefined;
              return (
                <RequestCard
                  key={r.id}
                  id={r.id}
                  patientName={patient}
                  service={service}
                  dateTime={started}
                  location={area}
                  priority={p ?? undefined}
                  state={state}
                  enteredAt={r.enteredAt}
                  onClaim={() => tryClaim(r.id)}
                  onDecline={() => handleDecline(r.id)}
                  role={role}
                />
              );
            })}
          </div>
        )
      )}

      {/* Today's Schedule */}
      {activeTab === "my_schedule" && (
        mine.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-2">
            <HandHeart className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-[14px] font-medium text-foreground">Nothing claimed yet</p>
            <p className="text-[12px] text-muted-foreground">Claim an open assignment from New Requests to start working.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mine.map((r) => {
              const state   = bindStatus("booking", r.state);
              const allowed = actionsForState("booking", state).filter((a) => can(role, a));
              const mp      = priorityFor(r.id);
              const started = bookingStartedAt(r);
              const service = bookingService(r) ?? "Service";
              const patient = bookingPatientName(r) ?? "—";
              const area    = bookingArea(r) ?? undefined;
              return (
                <ScheduleCard
                  key={r.id}
                  id={r.id}
                  patientName={patient}
                  service={service}
                  dateTime={started}
                  location={area}
                  priority={mp ?? undefined}
                  state={state}
                  enteredAt={r.enteredAt}
                  role={role}
                  actor={actor}
                  allowedActions={allowed}
                  onAccept={() =>
                    transition(
                      { workflow: "booking", entityId: r.id, to: "active", actor, role, action: "worker.accept_assignment" },
                      { successMessage: `Accepted #${r.id}` },
                    )
                  }
                  onRelease={() =>
                    release(
                      { workflow: "booking", entityId: r.id, actor, role },
                      { successMessage: `Released #${r.id}` },
                    )
                  }
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );
}