import { createFileRoute, Link } from "@tanstack/react-router";
import { getChecklistForBooking, getDocumentationForBooking } from "@/lib/forms/templates";
import { useEntities, useOrchestration } from "@/lib/orchestration";
import { bookingPatientName, bookingService } from "@/lib/orchestration/links";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OperationalHistoryPanel } from "@/components/journey/JourneyPanels";
import { bindStatus } from "@/lib/workflow-bind";
import { useState, useCallback } from "react";

export const Route = createFileRoute("/_app/worker/documentation")({
  component: WorkerDocumentation,
  head: () => ({ meta: [{ title: "Documentation — NurseConnect" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "pre-visit" | "during-visit" | "post-visit";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
}

// ─── Static checklist definitions ─────────────────────────────────────────────

const PRE_VISIT_ITEMS: ChecklistItem[] = [
  { id: "consent", title: "Patient Consent Obtained", description: "Verbal or written consent for care" },
  { id: "identity", title: "Patient Identity Verified", description: "Confirmed name, age, and booking details" },
  { id: "env", title: "Safe Environment Confirmed", description: "Clean, well-lit, appropriate for care" },
  { id: "emergency", title: "Emergency Contact Available", description: "Family member or caregiver present" },
];

const DURING_VISIT_ITEMS: ChecklistItem[] = [
  { id: "vitals", title: "Vitals Recorded", description: "BP, heart rate, temperature, SpO₂ captured" },
  { id: "assessment", title: "Patient Assessment Done", description: "Alert orientation and pain level noted" },
  { id: "meds", title: "Medications Administered", description: "Prescribed medications given as planned" },
  { id: "procedure", title: "Procedure / Care Delivered", description: "All planned care steps completed" },
];

const POST_VISIT_ITEMS: ChecklistItem[] = [
  { id: "notes", title: "Clinical Notes Documented", description: "Observations and findings recorded" },
  { id: "handover", title: "Handover Information Given", description: "Family / next caregiver briefed" },
  { id: "followup", title: "Follow-up Scheduled", description: "Next visit or escalation arranged" },
  { id: "closeout", title: "Visit Closed Out", description: "All records finalised and submitted" },
];

const PHASE_META: Record<Phase, { label: string; items: ChecklistItem[]; next: string; nextPhase?: Phase }> = {
  "pre-visit": { label: "Pre-Visit", items: PRE_VISIT_ITEMS, next: "Proceed to Vitals Entry", nextPhase: "during-visit" },
  "during-visit": { label: "During Visit", items: DURING_VISIT_ITEMS, next: "Proceed to Assessment", nextPhase: "post-visit" },
  "post-visit": { label: "Post-Visit", items: POST_VISIT_ITEMS, next: "Complete Visit", nextPhase: undefined },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseTab({ phase, active, done, onClick }: { phase: Phase; active: boolean; done: boolean; onClick: () => void }) {
  const { label } = PHASE_META[phase];
  return (
    <button
      onClick={onClick}
      className={[
        "relative flex-1 py-2.5 text-[13px] font-semibold rounded-lg transition-all duration-200 focus:outline-none",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : done
            ? "text-primary bg-primary/8 hover:bg-primary/12"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      ].join(" ")}
    >
      {done && !active && (
        <span className="absolute top-1.5 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15">
          <svg className="h-2.5 w-2.5 text-emerald-600" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {label}
    </button>
  );
}

function ChecklistCard({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={[
        "w-full text-left flex items-start gap-3.5 rounded-xl border px-4 py-3.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        checked
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/40",
      ].join(" ")}
    >
      {/* Checkbox */}
      <span
        className={[
          "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked
            ? "border-primary bg-primary"
            : "border-border bg-background",
        ].join(" ")}
      >
        {checked && (
          <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={["text-[13.5px] font-semibold leading-snug", checked ? "text-primary" : "text-foreground"].join(" ")}>
          {item.title}
        </span>
        <span className="text-[12px] text-muted-foreground leading-snug">{item.description}</span>
      </span>
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function WorkerDocumentation() {
  const rows = useEntities("booking");
  const [visitId, setVisitId] = useState(rows[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("pre-visit");
  const [donePhases, setDone] = useState<Set<Phase>>(new Set());
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [visitCompleted, setVisitCompleted] = useState(false);
  const visit = rows.find(v => v.id === visitId);
  const store = useOrchestration();
  const { user } = useAuth();
  const role = user?.role ?? null;
  const actor = user?.email ?? "worker@nurseconnect.in";

  const v: any = visit?.data ?? {};
  // Keep schemas alive for any downstream submission side-effects
  getChecklistForBooking(v);
  getDocumentationForBooking(v);

  const stamp = useCallback((patch: Record<string, any>, notes: string) => {
    if (!visit) return;
    store.repos.booking.upsert({ ...visit, data: { ...visit.data, ...patch } });
    store.annotate("booking", visit.id, actor, role, notes);
  }, [visit, store, actor, role]);

  const currentItems = PHASE_META[phase].items;
  const checkedCount = currentItems.filter(i => checked[i.id]).length;
  const allChecked = checkedCount === currentItems.length;
  const progressPct = currentItems.length ? Math.round((checkedCount / currentItems.length) * 100) : 0;

  const toggleItem = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const handleNext = () => {
    const meta = PHASE_META[phase];
    if (phase === "pre-visit") {
      stamp({ checklistComplete: true, checklistAt: new Date().toISOString() }, `Pre-visit checklist completed`);
    } else if (phase === "during-visit") {
      stamp({ vitalsComplete: true, vitalsAt: new Date().toISOString() }, `During-visit documentation completed`);
    } else {
      stamp({ documentationComplete: true, documentationAt: new Date().toISOString() }, "Visit documentation submitted");
      setDone(prev => new Set([...prev, phase]));
      setVisitCompleted(true);
      return;
    }
    setDone(prev => new Set([...prev, phase]));
    if (meta.nextPhase) setPhase(meta.nextPhase);
  };

  const phases: Phase[] = ["pre-visit", "during-visit", "post-visit"];
  const phaseIndex = phases.indexOf(phase);

  const bannerInstructions: Record<Phase, string> = {
    "pre-visit": "Complete all items before starting the visit",
    "during-visit": "Record vitals, observations and care delivered",
    "post-visit": "Finalise notes, handover and close out the visit",
  };
  if (visitCompleted) return (
  <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
    <div className="max-w-md w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center space-y-4">
      <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto">
        <svg className="h-8 w-8 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="text-[20px] font-bold text-emerald-700">Visit Completed!</h2>
      <p className="text-[13px] text-emerald-600">All documentation has been submitted successfully.</p>
      <button
        onClick={() => { setVisitCompleted(false); setPhase("pre-visit"); setDone(new Set()); setChecked({}); }}
        className="w-full rounded-xl bg-emerald-600 text-white py-3 text-[14px] font-semibold hover:bg-emerald-700 transition-colors"
      >
        Start New Visit
      </button>
    </div>
  </div>
);
  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Visit selector bar ── */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3">
          <label className="text-[13px] font-medium text-muted-foreground shrink-0">Select visit</label>
          <select
            className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={visitId}
            onChange={e => { setVisitId(e.target.value); setPhase("pre-visit"); setDone(new Set()); setChecked({}); }}
          >
            {rows.map(r => (
              <option key={r.id} value={r.id}>
                #{r.id} · {bookingPatientName(r) ?? "—"} · {bookingService(r) ?? ""}
              </option>
            ))}
          </select>
          {visit && <StatusBadge workflow="booking" state={bindStatus("booking", visit.state)} />}
          {visit && (
            <Link
              to="/worker/visits/$visitId"
              params={{ visitId: visit.id }}
              className="ml-auto text-[12px] font-medium text-primary hover:underline shrink-0"
            >
              Open visit workspace →
            </Link>
          )}
        </div>
      </div>

      {/* ── Clinical workflow panel ── */}
      <div className="relative mx-auto max-w-2xl px-4 py-8 space-y-5">

        {/* Header */}
        <div>
          <h2 className="text-[17px] font-bold text-foreground tracking-tight">Visit Clinical Checklist</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Capture vitals and observations for the current visit.</p>
        </div>

        {/* Phase tabs */}
        <div className="flex items-center gap-1.5 rounded-xl bg-muted/60 p-1.5 border border-border">
          {phases.map(p => (
            <PhaseTab
              key={p}
              phase={p}
              active={phase === p}
              done={donePhases.has(p)}
              onClick={() => setPhase(p)}
            />
          ))}
        </div>

        {/* Overall step indicator */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-muted-foreground font-medium">
            Step {phaseIndex + 1} of {phases.length}
          </span>
          <div className="flex-1">
            <ProgressBar value={Math.round(((phaseIndex) / phases.length) * 100 + progressPct / phases.length)} />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
            {checkedCount}/{currentItems.length} items
          </span>
        </div>

        {/* Instruction banner */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/6 px-4 py-3.5">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
            <svg className="h-3 w-3 text-primary" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z" />
            </svg>
          </span>
          <div>
            <p className="text-[13px] font-semibold text-primary">
              {PHASE_META[phase].label} Checklist
            </p>
            <p className="text-[12px] text-primary/80 mt-0.5">
              {bannerInstructions[phase]}
            </p>
          </div>
        </div>

        {/* Checklist items */}
        <div className="space-y-2.5">
          {currentItems.map(item => (
            <ChecklistCard
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </div>

        {/* Phase progress bar */}
        <div className="space-y-1.5">
          <ProgressBar value={progressPct} />
          <p className="text-[11.5px] text-muted-foreground text-right">
            {progressPct}% complete
          </p>
        </div>

        {/* Action button */}
        <button
          disabled={!allChecked}
          onClick={handleNext}
          className={[
            "w-full rounded-xl py-3.5 text-[14px] font-semibold tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            allChecked
              ? "bg-primary text-primary-foreground shadow-md hover:opacity-90 active:scale-[0.99]"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          ].join(" ")}
        >
          {PHASE_META[phase].next}
        </button>

        {/* Completed phases summary chips */}
        {donePhases.size > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {[...donePhases].map(dp => (
              <span
                key={dp}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11.5px] font-medium text-emerald-700"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {PHASE_META[dp].label} complete
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Visit activity log — rendered OUTSIDE the space-y-5 container to prevent stacking/overlap issues */}
      {visit && (
        <div className="mx-auto max-w-2xl px-4 pb-8" style={{ isolation: "isolate" }}>
          <OperationalHistoryPanel workflow="booking" entityId={visit.id} title="Visit activity" />
        </div>
      )}
    </div>
  );
}