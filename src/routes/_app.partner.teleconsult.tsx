/**
 * Tele-Doctor provider workflow: available queue -> accept -> video
 * consultation -> stage progression -> e-prescription -> complete.
 *
 * Content-level gated on the signed-in worker's own provider type (see
 * isTeleCapable below), the same way the backend's _require_tele_doctor
 * gates every /teleconsult/* endpoint — a Physical Doctor or Nurse who
 * lands on this page (nav item is role-wide, not sub-role-filtered, same
 * as every other item in the Partner nav) sees a clear explanation instead
 * of a broken or empty screen.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Stethoscope, Loader2, Video, VideoOff, Mic, MicOff, PhoneOff,
  ChevronDown, ChevronUp, CheckCircle2, Plus, X, ShieldAlert,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  teleconsultService,
  eprescriptionsService,
  type TeleConsultOut,
  type TeleConsultStage,
  type AvailableTeleBooking,
  type DrugLine,
} from "@/lib/teleconsult";
import { useVideoCall } from "@/hooks/useVideoCall";
import { VideoTile } from "@/components/calling/VideoTile";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/partner/teleconsult")({
  component: TeleconsultWorkspace,
  head: () => ({ meta: [{ title: "Teleconsult — NurseConnect" }] }),
});

// Mirrors app/core/provider_types.py::is_tele_capable — 'doctor' is the
// legacy generic type kept tele-capable for backward compatibility, plus
// the dedicated 'tele_doctor' type.
function isTeleCapable(workerType: string | null | undefined): boolean {
  return workerType === "doctor" || workerType === "tele_doctor";
}

const STAGE_LABEL: Record<TeleConsultStage, string> = {
  waiting: "Waiting",
  diet_review: "Diet review",
  patient_assessment: "Patient assessment",
  prescription: "Ready for e-Rx",
  completed: "Completed",
};

const STAGE_TONE: Record<TeleConsultStage, string> = {
  waiting: "text-slate-500 bg-slate-100",
  diet_review: "text-amber-700 bg-amber-50",
  patient_assessment: "text-sky-700 bg-sky-50",
  prescription: "text-violet-700 bg-violet-50",
  completed: "text-emerald-700 bg-emerald-50",
};

// ---------------------------------------------------------------------------
// Video consultation panel — start/join, render tiles, mute/camera, hang up.
// ---------------------------------------------------------------------------
function VideoConsultationPanel({ bookingId, onEnded }: { bookingId: string; onEnded: () => void }) {
  const call = useVideoCall();

  useEffect(() => {
    call.startCall(bookingId);
    // Only ever start once per mount — re-running on every render would
    // spin up a new meeting each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (call.phase === "ended") onEnded();
  }, [call.phase, onEnded]);

  if (call.phase === "connecting" || call.phase === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-900 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
        <span className="text-[13px] text-slate-300">Connecting to the patient…</span>
      </div>
    );
  }

  if (call.error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-700">
        {call.error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-[360px]">
        {call.remoteParticipants.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl bg-slate-900 text-slate-400 text-[13px]">
            Waiting for the patient to join…
          </div>
        ) : (
          call.remoteParticipants.map((p) => (
            <VideoTile key={p.id} track={p.videoTrack} label={p.name} />
          ))
        )}
        <VideoTile track={call.selfVideoTrack} label="You" muted mirrored />
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={call.toggleMute}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary/60"
          title={call.isMuted ? "Unmute" : "Mute"}
        >
          {call.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          onClick={call.toggleVideo}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary/60"
          title={call.isVideoOff ? "Turn camera on" : "Turn camera off"}
        >
          {call.isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </button>
        <button
          onClick={() => call.hangUp("completed")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white hover:opacity-90"
          title="End call"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
        <span className="text-[12px] text-muted-foreground tabular-nums ml-2">
          {String(Math.floor(call.durationSeconds / 60)).padStart(2, "0")}:
          {String(call.durationSeconds % 60).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// e-Prescription form — required before a consultation can complete.
// ---------------------------------------------------------------------------
function EPrescriptionForm({
  bookingId,
  dietNotes,
  patientIssues,
  onIssued,
}: {
  bookingId: string;
  dietNotes: string | null;
  patientIssues: string | null;
  onIssued: () => void;
}) {
  const [drugs, setDrugs] = useState<DrugLine[]>([{ name: "", dose: "", frequency: "", duration: "" }]);
  const [validDays, setValidDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [hasSignature, setHasSignature] = useState<boolean | null>(null);

  useEffect(() => {
    eprescriptionsService
      .getSignature()
      .then((r) => setHasSignature(r.has_signature))
      .catch(() => setHasSignature(false));
  }, []);

  const updateDrug = (i: number, patch: Partial<DrugLine>) =>
    setDrugs((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const submit = async () => {
    const listed = drugs.filter((d) => d.name.trim());
    if (listed.length === 0) {
      toast.error("Add at least one medicine.");
      return;
    }
    setSubmitting(true);
    try {
      await eprescriptionsService.create({
        booking_id: bookingId,
        drugs_listed: listed,
        diet_notes: dietNotes ?? undefined,
        patient_issues: patientIssues ?? undefined,
        valid_days: validDays,
      });
      toast.success("e-Prescription issued.");
      onIssued();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not issue the prescription.");
    } finally {
      setSubmitting(false);
    }
  };

  if (hasSignature === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Upload your signature before issuing e-prescriptions. This is a one-time step done from
          the NurseConnect mobile app (Profile → E-Prescription signature).
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drugs.map((d, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
          <input
            className="col-span-4 rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px]"
            placeholder="Medicine name"
            value={d.name}
            onChange={(e) => updateDrug(i, { name: e.target.value })}
          />
          <input
            className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px]"
            placeholder="Dose"
            value={d.dose}
            onChange={(e) => updateDrug(i, { dose: e.target.value })}
          />
          <input
            className="col-span-3 rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px]"
            placeholder="Frequency"
            value={d.frequency}
            onChange={(e) => updateDrug(i, { frequency: e.target.value })}
          />
          <input
            className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px]"
            placeholder="Duration"
            value={d.duration}
            onChange={(e) => updateDrug(i, { duration: e.target.value })}
          />
          <button
            className="col-span-1 inline-flex items-center justify-center text-muted-foreground hover:text-rose-600"
            onClick={() => setDrugs((prev) => prev.filter((_, idx) => idx !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => setDrugs((prev) => [...prev, { name: "", dose: "", frequency: "", duration: "" }])}
        className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Add medicine
      </button>
      <div className="flex items-center gap-2 pt-1">
        <label className="text-[12px] text-muted-foreground">Valid for (days)</label>
        <input
          type="number"
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-[12.5px]"
          value={validDays}
          onChange={(e) => setValidDays(Number(e.target.value) || 30)}
        />
      </div>
      <button
        onClick={submit}
        disabled={submitting || hasSignature === null}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Issue e-Prescription
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One queue row — stage progression, mirrors the mobile teleconsult-queue
// screen's card so a doctor sees the same steps regardless of device.
// ---------------------------------------------------------------------------
function QueueRow({ item, onAdvanced }: { item: TeleConsultOut; onAdvanced: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [dietNotes, setDietNotes] = useState(item.diet_notes ?? "");
  const [allOkay, setAllOkay] = useState(true);
  const [issues, setIssues] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitDiet = async () => {
    if (!dietNotes.trim()) {
      toast.error("Diet notes are required to move this consultation forward.");
      return;
    }
    setSubmitting(true);
    try {
      await teleconsultService.submitDiet(item.id, dietNotes.trim());
      onAdvanced();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitIssues = async () => {
    if (!allOkay && !issues.trim()) {
      toast.error("Describe the issue, or mark the patient as all okay.");
      return;
    }
    setSubmitting(true);
    try {
      await teleconsultService.submitPatientIssues(item.id, allOkay, issues.trim());
      onAdvanced();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  const complete = async () => {
    setSubmitting(true);
    try {
      await teleconsultService.complete(item.id);
      toast.success("Consultation completed.");
      onAdvanced();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not complete — issue an e-prescription first.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-[13.5px] font-medium text-foreground">{item.patient_name ?? "Patient"}</div>
          <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_TONE[item.stage]}`}>
            {STAGE_LABEL[item.stage]}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {item.stage !== "completed" && (
            <div>
              {!inCall ? (
                <button
                  onClick={() => setInCall(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
                >
                  <Video className="h-3.5 w-3.5" /> Start video consultation
                </button>
              ) : (
                <VideoConsultationPanel bookingId={item.booking_id} onEnded={() => setInCall(false)} />
              )}
            </div>
          )}

          {(item.stage === "waiting" || item.stage === "diet_review") && (
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">Diet notes</label>
              <textarea
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px] min-h-[70px]"
                placeholder="What the patient should eat / avoid…"
                value={dietNotes}
                onChange={(e) => setDietNotes(e.target.value)}
              />
              <button
                onClick={submitDiet}
                disabled={submitting}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save & continue
              </button>
            </div>
          )}

          {item.stage === "patient_assessment" && (
            <div>
              <label className="flex items-center gap-2 text-[12.5px] text-foreground">
                <input type="checkbox" checked={allOkay} onChange={(e) => setAllOkay(e.target.checked)} />
                Patient is all okay
              </label>
              {!allOkay && (
                <textarea
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px] min-h-[60px]"
                  placeholder="Describe what was flagged…"
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                />
              )}
              <button
                onClick={submitIssues}
                disabled={submitting}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save & continue
              </button>
            </div>
          )}

          {item.stage === "prescription" && (
            <div className="space-y-3">
              <EPrescriptionForm
                bookingId={item.booking_id}
                dietNotes={item.diet_notes}
                patientIssues={item.patient_issues}
                onIssued={onAdvanced}
              />
              <button
                onClick={complete}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Mark consultation complete
              </button>
            </div>
          )}

          {item.stage === "completed" && (
            <p className="text-[12.5px] text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Consultation complete — e-prescription issued.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function TeleconsultWorkspace() {
  const [workerType, setWorkerType] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(true);

  const [available, setAvailable] = useState<AvailableTeleBooking[]>([]);
  const [queue, setQueue] = useState<TeleConsultOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/workers/me")
      .then((me) => setWorkerType(me.worker_type ?? null))
      .catch(() => setWorkerType(null))
      .finally(() => setGateLoading(false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [avail, q] = await Promise.all([
        teleconsultService.availableBookings(),
        teleconsultService.myQueue(),
      ]);
      setAvailable(avail);
      setQueue(q);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load your teleconsult workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isTeleCapable(workerType)) load();
  }, [workerType, load]);

  const acceptAndStart = async (bookingId: string) => {
    setAccepting(bookingId);
    try {
      await teleconsultService.acceptBooking(bookingId);
      await teleconsultService.start(bookingId);
      toast.success("Booking accepted — added to your queue.");
      load();
    } catch (e: any) {
      // 409 means someone else claimed it first — the database decided,
      // not a bug. Just refresh so the stale row disappears.
      toast.error(e?.message ?? "Could not accept — it may have just been claimed by another doctor.");
      load();
    } finally {
      setAccepting(null);
    }
  };

  if (gateLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isTeleCapable(workerType)) {
    return (
      <div className="max-w-lg mx-auto mt-12 rounded-xl border border-border bg-card p-6 text-center">
        <Stethoscope className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-[15px] font-semibold text-foreground">Tele-Doctor feature</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          This workspace is for Tele-Doctor accounts. Your account is registered as a different
          provider type, so patient video consultations don't apply to your work here.
        </p>
      </div>
    );
  }

  const active = queue.filter((i) => i.stage !== "completed");
  const completed = queue.filter((i) => i.stage === "completed");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-[18px] font-semibold leading-tight">Teleconsult</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Accept new consultation requests, run the video call, and issue e-prescriptions —
          entirely from here.
        </p>
      </div>

      <section>
        <h3 className="text-[13px] font-semibold text-foreground mb-2">Available requests</h3>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : available.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No unclaimed requests right now.</p>
        ) : (
          <div className="space-y-2">
            {available.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
                <div>
                  <div className="text-[13px] font-medium text-foreground">
                    {b.patient_name ?? "Patient"} — {b.service_name ?? "Consultation"}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {b.scheduled_date} {b.scheduled_start_time}
                    {b.is_urgent && <span className="ml-1.5 text-rose-600 font-medium">Urgent</span>}
                  </div>
                </div>
                <button
                  onClick={() => acceptAndStart(b.id)}
                  disabled={accepting === b.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {accepting === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Accept
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-foreground mb-2">Your queue</h3>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : active.length === 0 && completed.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No consultations in your queue yet.</p>
        ) : (
          <div className="space-y-2">
            {active.map((item) => (
              <QueueRow key={item.id} item={item} onAdvanced={load} />
            ))}
            {completed.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">
                  Completed
                </p>
                {completed.map((item) => (
                  <QueueRow key={item.id} item={item} onAdvanced={load} />
                ))}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
