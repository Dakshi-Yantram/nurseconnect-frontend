import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, HeartPulse, MapPin, Clock, IndianRupee,
  CheckCircle2, AlertCircle, XCircle, Ban, Loader2,
  ClipboardList, Thermometer, Activity, FileText, ArrowRight,
} from "lucide-react";
import { useBooking, useRefetchBookings } from "@/lib/domain";
import { ChatPanel } from "@/components/shared/ChatPanel";
import { Card } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { EmptyState } from "@/components/shared/EmptyState";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { useEntity, useEntityHistory } from "@/lib/orchestration";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { payForBooking, refundBooking } from "@/lib/payments";
import { StartVisitCodeButton } from "@/components/StartVisitCodeButton";
import { TrackNurseMap } from "@/components/TrackNurseMap";
import {
  bookingService, bookingPatientName, bookingArea,
  bookingStartedAt, bookingDuration, bookingNurseName,
} from "@/lib/orchestration/links";
// Shared with _app.consumer.payments.tsx via @/lib/payment-status so the two
// views can't drift out of sync with each other again.
import {
  type PaymentStatus,
  derivePaymentStatus,
  mapRealPaymentStatus,
  isPayable,
  deriveAmount,
  formatINR,
} from "@/lib/payment-status";

export const Route = createFileRoute("/_app/consumer/bookings/$bookingId")({
  component: ConsumerBookingDetail,
  head: () => ({ meta: [{ title: "Booking — NurseConnect" }] }),
});

// ─── Payment derivation ───────────────────────────────────────────────────────

const PAYMENT_CONFIG: Record<PaymentStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  classes: string;
  description: string;
}> = {
  paid: { label: "Paid", icon: CheckCircle2, classes: "text-emerald-700 bg-emerald-50 border-emerald-200", description: "Payment settled — visit completed successfully." },
  processing: { label: "Processing", icon: Clock, classes: "text-blue-700 bg-blue-50 border-blue-200", description: "Visit is in progress — payment will settle on completion." },
  pending: { label: "Pending", icon: Clock, classes: "text-amber-700 bg-amber-50 border-amber-200", description: "Booking confirmed — pay now, or it will be collected automatically on visit completion." },
  refunded: { label: "Refunded", icon: XCircle, classes: "text-muted-foreground bg-muted border-border", description: "Booking cancelled — refund credited within 5–7 working days." },
  failed: { label: "Action needed", icon: AlertCircle, classes: "text-rose-700 bg-rose-50 border-rose-200", description: "Payment issue detected — your care team has been notified." },
};

// ─── Visit report (real backend data) ─────────────────────────────────────
// Replaces what used to be entirely hardcoded "sample" content in the Care
// Summary card below — this is the actual "view the report" flow that was
// missing: GET /api/visits/{booking_id} for checklist/documentation/notes,
// plus GET /api/visits/{booking_id}/vitals for the latest recorded vitals.

interface VisitReport {
  checklistResponses: Record<string, any> | null;
  documentationResponses: Record<string, any> | null;
  familySummary: string | null;
  careNotes: string | null;
  ratingByConsumer: number | null;
  vitals: {
    bp: string | null;
    pulse: number | null;
    spo2: number | null;
    temperatureF: number | null;
  } | null;
}

function useVisitReport(bookingId: string, enabled: boolean) {
  const [data, setData] = useState<VisitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    Promise.allSettled([
      apiFetch(`/api/visits/${bookingId}`),
      apiFetch(`/api/visits/${bookingId}/vitals`),
    ]).then(([visitRes, vitalsRes]) => {
      if (cancelled) return;
      if (visitRes.status === "fulfilled") {
        const v = visitRes.value;
        const vitalsList = vitalsRes.status === "fulfilled" && Array.isArray(vitalsRes.value) ? vitalsRes.value : [];
        const latest = vitalsList[0] ?? null;
        setData({
          checklistResponses: v.checklist_responses ?? null,
          documentationResponses: v.documentation_responses ?? null,
          familySummary: v.family_summary ?? null,
          careNotes: v.care_notes ?? null,
          ratingByConsumer: v.rating_by_consumer ?? null,
          vitals: latest ? {
            bp: latest.bp_systolic != null && latest.bp_diastolic != null
              ? `${latest.bp_systolic} / ${latest.bp_diastolic} mmHg` : null,
            pulse: latest.pulse ?? null,
            spo2: latest.spo2 ?? null,
            temperatureF: latest.temperature_f ?? null,
          } : null,
        });
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [bookingId, enabled]);

  return { data, loading, notFound };
}


const TIMELINE_LABELS: Record<string, string> = {
  "entity.created": "Booking created",
  "workflow.transitioned": "Status updated",
  "entity.claimed": "Nurse assigned",
  "entity.released": "Assignment released",
  "entity.escalated": "Escalated for review",
  "entity.note_added": "Note added",
  "entity.cancelled": "Booking cancelled",
  "entity.completed": "Visit completed",
};


function ConsumerBookingDetail() {
  const { bookingId } = Route.useParams();
  const { user } = useAuth();

  const domainBooking = useBooking(bookingId);
  const refetchBookings = useRefetchBookings();
  const history = useEntityHistory("booking", bookingId);
  const [paying, setPaying] = useState(false);
  const [refunding, setRefunding] = useState(false);


  const record = domainBooking ? {
    id: domainBooking.id,
    state: domainBooking.rawStatus,
    enteredAt: domainBooking.startedAt,
    data: {},
  } : null;

  if (!record) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card title="Booking not found">
          <EmptyState
            title={`#${bookingId} could not be found.`}
            description="It may have been removed or the link is incorrect."
          />
        </Card>
         
      </div>
    );
  }

  const state = bindStatus("booking", record.state);
  const service = domainBooking?.service ?? "Service";
  const patientName = domainBooking?.patientName ?? "—";
  const area = domainBooking?.area ?? "—";
  const started = domainBooking?.startedAt ?? "—";
  const duration = domainBooking?.duration ?? "—";
  const nurse = domainBooking?.nurseName ?? "Unassigned";

  const rawPaymentStatus = domainBooking?.paymentStatus;
  const payStatus = mapRealPaymentStatus(rawPaymentStatus) ?? derivePaymentStatus(record.state);
  const amount = domainBooking?.totalAmount != null
    ? Number(domainBooking.totalAmount) // backend stores rupees, not paise
    : deriveAmount(service);

  const payCfg = PAYMENT_CONFIG[payStatus];
  const PayIcon = payCfg.icon;
  const canPay = isPayable(rawPaymentStatus);

  const { data: report, loading: reportLoading, notFound: reportNotFound } =
    useVisitReport(record.id, record.state === "completed");

  // 6-hour cancellation window — mirrors the backend policy (which enforces
  // it regardless); here we just hide the option once the window has closed.
  const scheduledStart = (() => {
    const s = domainBooking?.startedAt;
    if (!s) return null;
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  })();
  const withinCancelWindow =
    scheduledStart == null || Date.now() < scheduledStart.getTime() - 6 * 60 * 60 * 1000;

  const handlePay = async () => {
    setPaying(true);
    try {
      const result = await payForBooking({
        bookingId: record.id,
        description: `${service} — ${patientName}`,
        prefillEmail: user?.email,
      });
      if (result.verified) {
        toast.success("Payment successful!");
        await refetchBookings();
      } else {
        toast.error("We couldn't confirm the payment. Please try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setPaying(false);
    }
  };

  const handleCancelAndRefund = async () => {
    setRefunding(true);
    try {
      const result = await refundBooking(
        record.id,
        amount,
        `Cancel booking request — ${service} (${patientName})`
      );

      if (result.verified) {
        toast.success("Booking cancelled — refund initiated.");
        await refetchBookings();
      } else {
        toast.error("Couldn't confirm the refund. Please contact support.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refund failed";
      toast.error(msg);
    } finally {
      setRefunding(false);
    }
  };

  return (

    <div className="space-y-5">
      <BackLink />

      {/* ── Booking summary ── */}
      <Card padded={false}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 flex-wrap">
          <div>
            <div className="text-[15px] font-semibold">
              #{record.id} · {service}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5">
              {patientName} · {area}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge workflow="booking" state={state} />
            <SLAIndicator
              workflow="booking"
              state={state}
              enteredAt={parseEnteredAt(record.enteredAt)}
            />
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Detail icon={HeartPulse} label="Service" value={service} />
          <Detail icon={MapPin} label="Location" value={area} />
          <Detail icon={Clock} label="Time" value={started !== "—" ? `${started}${duration !== "—" ? ` · ${duration}` : ""}` : "—"} />
          <Detail icon={IndianRupee} label="Nurse" value={nurse} />
        </div>
      </Card>
      <TrackNurseMap bookingId={record.id} status={record.state} destLat={record.latitude} destLng={record.longitude} />
      <StartVisitCodeButton bookingId={record.id} status={record.state} />
      <ChatPanel scope="booking" id={record.id} />
      {/* ── Payment status ── */}
      <RuntimeBoundary label="Payment">
        <Card
          title={
            <span className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" /> Payment
            </span>
          }
        >
          <div className={`flex items-start gap-4 rounded-lg border px-4 py-3.5 ${payCfg.classes}`}>
            <PayIcon className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[13px] font-semibold">{payCfg.label}</div>
                  <div className="text-[12px] opacity-80 mt-0.5">{payCfg.description}</div>
                </div>
                <div className="text-[22px] font-bold tabular-nums shrink-0">
                  {formatINR(amount)}
                </div>
              </div>

              {/* Fee breakdown */}
              <div className="mt-3 pt-3 border-t border-current/10 grid grid-cols-3 gap-2 text-[11.5px]">
                <PayLine label="Service fee" value={formatINR(Math.round(amount * 0.85))} />
                <PayLine label="Platform fee" value={formatINR(Math.round(amount * 0.12))} />
                <PayLine label="GST (3%)" value={formatINR(Math.round(amount * 0.03))} />
              </div>

              {payStatus === "refunded" && (
                <div className="mt-3 text-[11.5px] opacity-75 flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5 shrink-0" />
                  Refund of {formatINR(amount)} will be credited to your original payment method within 5–7 working days.
                </div>
              )}
              {payStatus === "processing" && (
                <div className="mt-3 text-[11.5px] opacity-75">
                  Your visit is underway. Payment will be confirmed once the nurse completes the visit.
                </div>
              )}

              {canPay && (
                <div className="mt-3 pt-3 border-t border-current/10">
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                      </>
                    ) : (
                      <>Pay {formatINR(amount)} now</>
                    )}
                  </button>
                  {payStatus === "failed" && (
                    <div className="mt-2 text-[11.5px] opacity-75">
                      Your last payment attempt didn't go through — try again above.
                    </div>
                  )}
                </div>
              )}

              {payStatus === "paid" && record.state !== "completed" && record.state !== "cancelled" && (
                <div className="mt-3 pt-3 border-t border-current/10">
                  {withinCancelWindow ? (
                    <button
                      onClick={handleCancelAndRefund}
                      disabled={refunding}
                      className="inline-flex items-center gap-2 rounded-md border border-rose-300 text-rose-700 px-4 py-2 text-[13px] font-medium hover:bg-rose-50 disabled:opacity-60"
                    >
                      {refunding ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                        </>
                      ) : (
                        <>Cancel booking & request refund</>
                      )}
                    </button>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">
                      Cancellation is no longer available — visits can only be cancelled up to
                      6 hours before the scheduled start. Contact support if you need help.
                    </p>
                  )}
                </div>
              )}

            </div>
          </div>
        </Card>
      </RuntimeBoundary>
      {/* ── Care Summary / Report (only when completed) ── */}
      {record.state === "completed" && (
        <RuntimeBoundary label="Care summary">
          <Card title={
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> Care summary
            </span>
          }>
            {reportLoading && (
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your visit report…
              </div>
            )}

            {!reportLoading && reportNotFound && (
              <EmptyState
                icon={FileText}
                title="Report not available yet"
                description="Your care team hasn't finished documenting this visit. Check back shortly."
              />
            )}

            {!reportLoading && !reportNotFound && report && (
              <>
                {/* Visit stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Duration</div>
                    <div className="text-[13px] font-semibold mt-0.5">{duration}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Completed at</div>
                    <div className="text-[13px] font-semibold mt-0.5">{started}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Nurse</div>
                    <div className="text-[13px] font-semibold mt-0.5">{nurse}</div>
                  </div>
                </div>

                {/* Tasks completed */}
                <div className="mb-4">
                  <div className="text-[11.5px] text-muted-foreground font-medium mb-2">Tasks completed</div>
                  <div className="flex flex-wrap gap-2">
                    {report.vitals && (
                      <TaskBadge label="Vital signs recorded" />
                    )}
                    {report.checklistResponses && (
                      <TaskBadge label="Clinical checklist completed" />
                    )}
                    {report.documentationResponses && (
                      <TaskBadge label="Visit documentation submitted" />
                    )}
                    {!report.vitals && !report.checklistResponses && !report.documentationResponses && (
                      <span className="text-[12.5px] text-muted-foreground">No tasks recorded for this visit yet.</span>
                    )}
                  </div>
                </div>

                {/* Vitals */}
                <div className="mb-4">
                  <div className="text-[11.5px] text-muted-foreground font-medium mb-2">Vitals recorded</div>
                  {report.vitals ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <VitalStat label="Blood pressure" value={report.vitals.bp} />
                      <VitalStat label="SpO₂" value={report.vitals.spo2 != null ? `${report.vitals.spo2}%` : null} />
                      <VitalStat label="Heart rate" value={report.vitals.pulse != null ? `${report.vitals.pulse} bpm` : null} />
                      <VitalStat label="Temperature" value={report.vitals.temperatureF != null ? `${report.vitals.temperatureF} °F` : null} />
                    </div>
                  ) : (
                    <div className="text-[12.5px] text-muted-foreground">No vitals were recorded during this visit.</div>
                  )}
                </div>

                {/* Nurse notes */}
                <div className="mb-4">
                  <div className="text-[11.5px] text-muted-foreground font-medium mb-2">Nurse's notes</div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
                    {report.careNotes || "No notes were recorded for this visit."}
                  </div>
                </div>

                {/* Next steps */}
                <div>
                  <div className="text-[11.5px] text-muted-foreground font-medium mb-2">Next steps</div>
                  <div className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                    <span>{report.familySummary || "No follow-up notes yet. Continue current care plan."}</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </RuntimeBoundary>
      )}

      {/* ── Booking timeline ── */}
      <RuntimeBoundary label="Booking history">
        <Card title="Booking history" padded={false}>
          <div className="px-5 py-4 space-y-0">
            {history.length === 0 ? (
              // Fallback for seed records with no transition events yet
              <TimelineRow
                label="Entity created"
                note="Imported from operational seed"
                ts={record.enteredAt}
                isLast
              />
            ) : (
              history.map((entry, i) => (
                <TimelineRow
                  key={entry.id}
                  label={TIMELINE_LABELS[entry.kind ?? ""] ?? entry.kind ?? "State change"}
                  note={entry.notes}
                  ts={entry.ts}
                  isLast={i === history.length - 1}
                />
              ))
            )}
          </div>
        </Card>
      </RuntimeBoundary>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      to="/consumer/bookings"
      className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to bookings
    </Link>
  );
}

function TaskBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {label}
    </span>
  );
}

function VitalStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-muted/50 rounded-lg px-3 py-2.5">
      <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-[13px] font-semibold mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function Detail({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-[12.5px] font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function PayLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="opacity-60">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TimelineRow({
  label, note, ts, isLast,
}: { label: string; note?: string; ts?: string; isLast: boolean }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <div className="flex flex-col items-center shrink-0">
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 mt-1 shrink-0" />
        {!isLast && <span className="w-px flex-1 bg-border mt-1 mb-0" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
        <div className="font-medium">{label}</div>
        {note && <div className="text-[11.5px] text-muted-foreground">{note}</div>}
        {ts && <div className="text-[11px] text-muted-foreground mt-0.5">{formatTs(ts)}</div>}
      </div>
    </div>
  );
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
