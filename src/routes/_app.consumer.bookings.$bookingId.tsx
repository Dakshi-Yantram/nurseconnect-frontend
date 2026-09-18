import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, HeartPulse, MapPin, Clock, IndianRupee,
  CheckCircle2, AlertCircle, XCircle, Ban, Loader2, Banknote,
  ClipboardList, Thermometer, Activity, FileText, ArrowRight,
} from "lucide-react";
import { useBooking, useRefetchBookings } from "@/lib/domain";
import { ChatPanel } from "@/components/shared/ChatPanel";
import { Card } from "@/components/shared/Card";
import { CallButton } from "@/components/calling/CallButton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { EmptyState } from "@/components/shared/EmptyState";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { useEntity } from "@/lib/orchestration";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { useAuth } from "@/lib/auth-context";
import { ApiError, apiFetch, apiErrorMessage } from "@/lib/api";
import { payForBooking, refundBooking, fetchPaymentMethods, selectCashPayment, type PaymentMethodOption } from "@/lib/payments";
import { StartVisitCodeButton } from "@/components/StartVisitCodeButton";
import { TrackNurseMap } from "@/components/TrackNurseMap";
import { VisitReportButton } from "@/components/shared/VisitReportButton";
import { ProtectedContent } from "@/components/shared/ProtectedContent";
import {
  bookingService, bookingPatientName, bookingArea,
  bookingStartedAt, bookingDuration, bookingNurseName,
} from "@/lib/orchestration/links";
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
  // Booking confirmed and dispatchable; the customer pays the care
  // professional directly at the visit, not through the app.
  cash_due: { label: "Pay at visit", icon: Banknote, classes: "text-sky-700 bg-sky-50 border-sky-200", description: "Booking confirmed — pay your care professional directly when they arrive." },
};

// GET /api/visits/{id}/report/consumer — the family-facing, audited view.
// It deliberately has NO `care_notes` (the nurse's internal record). This
// page used to call GET /api/visits/{id} instead and render care_notes as
// "Nurse's notes", which exposed internal clinical notes to the family.
interface VisitReport {
  hasChecklist: boolean;
  hasDocumentation: boolean;
  familySummary: string | null;
  checkOutAt: string | null;
  durationMinutes: number | null;
  vitals: {
    bp: string | null;
    pulse: number | null;
    spo2: number | null;
    temperatureF: number | null;
  } | null;
}

type ReportState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: VisitReport }
  | { kind: "not_ready"; message: string }
  | { kind: "error"; message: string; sessionExpired: boolean };

function fmtBp(sys: number | null | undefined, dia: number | null | undefined): string | null {
  if (sys != null && dia != null) return `${sys} / ${dia} mmHg`;
  if (sys != null || dia != null) return `${sys ?? "?"} / ${dia ?? "?"} mmHg (incomplete)`;
  return null;
}

function useVisitReport(bookingId: string, enabled: boolean) {
  const [state, setState] = useState<ReportState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !bookingId) return;
    let cancelled = false;
    setState({ kind: "loading" });
    apiFetch(`/api/visits/${bookingId}/report/consumer`, { timeoutMs: 20_000 })
      .then((v) => {
        if (cancelled) return;
        const lv = v?.latest_vitals ?? null;
        const anyVital = lv && (lv.bp_systolic != null || lv.bp_diastolic != null ||
          lv.pulse != null || lv.spo2 != null || lv.temperature_f != null);
        setState({
          kind: "ready",
          data: {
            hasChecklist: !!v?.has_checklist,
            hasDocumentation: !!v?.has_documentation,
            familySummary: v?.family_summary ?? null,
            checkOutAt: v?.check_out_at ?? null,
            durationMinutes: v?.actual_duration_minutes ?? null,
            vitals: anyVital ? {
              bp: fmtBp(lv.bp_systolic, lv.bp_diastolic),
              pulse: lv.pulse ?? null,
              spo2: lv.spo2 ?? null,
              temperatureF: lv.temperature_f ?? null,
            } : null,
          },
        });
      })
      .catch((e) => {
        if (cancelled) return;
        // "Not written yet" is a normal state, not an error.
        if (e instanceof ApiError && (e.code === "NO_VISIT_YET" || e.code === "VISIT_IN_PROGRESS")) {
          setState({ kind: "not_ready", message: e.userMessage ?? "Your care team hasn't finished documenting this visit." });
          return;
        }
        setState({
          kind: "error",
          message: apiErrorMessage(e, "Couldn't load your visit report."),
          sessionExpired: e instanceof ApiError && e.status === 401,
        });
      });
    return () => { cancelled = true; };
  }, [bookingId, enabled, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}

// Maps AuditLog.action strings (see `audit()` calls across bookings.py,
// visits.py, care_workflow.py) to human-friendly timeline labels.
const TIMELINE_LABELS: Record<string, string> = {
  "booking.create": "Booking created",
  "booking.accept": "Nurse assigned",
  "booking.worker_cancel_rematch": "Nurse cancelled — finding a replacement",
  "booking.cancel": "Booking cancelled",
  "visit.otp_generated": "Start code generated",
  "visit.checkin": "Nurse checked in",
  "visit.checkin_via_otp": "Nurse checked in",
  "visit.vitals": "Vitals recorded",
  "visit.medication": "Medication administered",
  "visit.checklist": "Care checklist submitted",
  "visit.checkout": "Visit completed",
  "care_workflow.checklist": "Care questionnaire updated",
  "care_workflow.documentation": "Visit documentation updated",
};

interface BookingHistoryEntry {
  id: string;
  action: string;
  actor_type: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

// Real, per-booking event trail from the backend audit log — replaces the
// previous client-side mock (`useEntityHistory` from "@/lib/orchestration"),
// which only ever seeded one generic "Imported from operational seed" line
// per entity and was never wired to actual booking/visit events.
function useBookingHistory(bookingId: string) {
  const [entries, setEntries] = useState<BookingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/bookings/${bookingId}/history`)
      .then((rows) => { if (!cancelled) setEntries(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  return { entries, loading };
}

function ConsumerBookingDetail() {
  const { bookingId } = Route.useParams();
  const { user } = useAuth();

  const domainBooking = useBooking(bookingId);
  const refetchBookings = useRefetchBookings();
  const { entries: history, loading: historyLoading } = useBookingHistory(bookingId);
  const [paying, setPaying] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [cashOption, setCashOption] = useState<PaymentMethodOption | null>(null);
  const [payingCash, setPayingCash] = useState(false);

  const record = domainBooking ? {
    id: domainBooking.id,
    state: domainBooking.rawStatus,
    enteredAt: domainBooking.startedAt,
    latitude: (domainBooking as any).latitude ?? null,
    longitude: (domainBooking as any).longitude ?? null,
    data: {},
  } : null;

  // IMPORTANT: this hook must be called unconditionally, on every render,
  // in the same order — including before `record` is known/loaded. Calling
  // it after an early `if (!record) return ...` caused React error #310
  // ("rendered more hooks than during the previous render") once the
  // booking finished loading, crashing the whole page.
  const { state: reportState, retry: retryReport } =
    useVisitReport(record?.id ?? "", record?.state === "completed");
  const report = reportState.kind === "ready" ? reportState.data : null;

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

  // Cash eligibility is server-driven (see /payments/methods/{id} and
  // app/services/cash_payment.py::is_cash_eligible) rather than guessed
  // from booking state here, so the rule lives in exactly one place and
  // the web app can never drift from what the backend actually allows.
  useEffect(() => {
    let cancelled = false;
    if (!isPayable(rawPaymentStatus)) {
      setCashOption(null);
      return;
    }
    fetchPaymentMethods(record.id)
      .then((res) => {
        if (cancelled) return;
        setCashOption(res.methods.find((m) => m.method === "cash") ?? null);
      })
      .catch(() => {
        if (!cancelled) setCashOption(null);
      });
    return () => { cancelled = true; };
  }, [record.id, rawPaymentStatus]);
  const amount = domainBooking?.totalAmount != null
    ? Number(domainBooking.totalAmount)
    : deriveAmount(service);

  const payCfg = PAYMENT_CONFIG[payStatus];
  const PayIcon = payCfg.icon;
  const canPay = isPayable(rawPaymentStatus);

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

  // Cash path: no order, no gateway, no signature — the booking is simply
  // confirmed with the amount due at the visit. Kept separate from
  // handlePay for the same reason app/services/cash_payment.py is its own
  // module rather than an `if` inside the Razorpay flow.
  const handlePayCash = async () => {
    setPayingCash(true);
    try {
      const result = await selectCashPayment(record.id);
      if (result.cash_due) {
        toast.success("Booking confirmed — pay your care professional at the visit.");
        await refetchBookings();
      } else {
        toast.error("Couldn't switch this booking to cash. Please try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't select cash payment";
      toast.error(msg);
    } finally {
      setPayingCash(false);
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
      {nurse !== "Unassigned" && ["assigned", "worker_en_route", "worker_arrived", "in_progress"].includes(record.state) && (
        <CallButton bookingId={record.id} calleeLabel={nurse} />
      )}
      <ChatPanel scope="booking" id={record.id} />

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
              {payStatus === "cash_due" && (
                <div className="mt-3 text-[11.5px] opacity-75">
                  This booking is confirmed. Pay {formatINR(amount)} directly to your care professional
                  when they arrive — no online payment is needed.
                </div>
              )}

              {canPay && (
                <div className="mt-3 pt-3 border-t border-current/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePay}
                      disabled={paying || payingCash}
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
                    {/* Cash option only rendered when the backend says this
                        booking qualifies (see /payments/methods/{id}) —
                        never hardcoded here, so a rule change on the
                        backend (e.g. a service that must be prepaid)
                        applies immediately with no frontend release. */}
                    {cashOption?.available && (
                      <button
                        onClick={handlePayCash}
                        disabled={paying || payingCash}
                        className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 text-sky-700 px-4 py-2 text-[13px] font-medium hover:bg-sky-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {payingCash ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming…
                          </>
                        ) : (
                          <>Pay cash at visit</>
                        )}
                      </button>
                    )}
                  </div>
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

      {record.state === "completed" && (
        <RuntimeBoundary label="Care summary">
          <Card
            title={
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" /> Care summary
              </span>
            }
            action={
              report ? <VisitReportButton bookingId={bookingId} endpoint="consumer" /> : undefined
            }
          >
            {(reportState.kind === "loading" || reportState.kind === "idle") && (
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your visit report…
              </div>
            )}

            {reportState.kind === "not_ready" && (
              <EmptyState
                icon={FileText}
                title="Report not available yet"
                description={reportState.message}
              />
            )}

            {reportState.kind === "error" && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p>{reportState.message}</p>
                  {reportState.sessionExpired ? (
                    <Link to="/auth/login" search={{ redirect: undefined }} className="mt-1 inline-block font-medium underline">Sign in again</Link>
                  ) : (
                    <button type="button" onClick={retryReport} className="mt-1 font-medium underline">Try again</button>
                  )}
                </div>
              </div>
            )}

            {report && (
              <ProtectedContent bookingId={bookingId} label="Visit care summary">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Duration</div>
                    <div className="text-[13px] font-semibold mt-0.5">
                      {report.durationMinutes != null ? `${report.durationMinutes} mins` : duration}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Completed at</div>
                    <div className="text-[13px] font-semibold mt-0.5">
                      {report.checkOutAt
                        ? new Date(report.checkOutAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                        : "—"}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Nurse</div>
                    <div className="text-[13px] font-semibold mt-0.5">{nurse}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[11.5px] text-muted-foreground font-medium mb-2">Tasks completed</div>
                  <div className="flex flex-wrap gap-2">
                    {report.vitals && <TaskBadge label="Vital signs recorded" />}
                    {report.hasChecklist && <TaskBadge label="Clinical checklist completed" />}
                    {report.hasDocumentation && <TaskBadge label="Visit documentation submitted" />}
                    {!report.vitals && !report.hasChecklist && !report.hasDocumentation && (
                      <span className="text-[12.5px] text-muted-foreground">No tasks recorded for this visit yet.</span>
                    )}
                  </div>
                </div>

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

                <div>
                  <div className="text-[11.5px] text-muted-foreground font-medium mb-2">Summary from your nurse</div>
                  <div className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
                    <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                    <span>{report.familySummary || "No summary was recorded. Continue the current care plan."}</span>
                  </div>
                </div>
              </ProtectedContent>
            )}
          </Card>
        </RuntimeBoundary>
      )}

      <RuntimeBoundary label="Booking history">
        <Card title="Booking history" padded={false}>
          <div className="px-5 py-4 space-y-0">
            {history.length === 0 ? (
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
                  label={TIMELINE_LABELS[entry.action ?? ""] ?? entry.action ?? "State change"}
                  note={entry.changes ? JSON.stringify(entry.changes) : undefined}
                  ts={entry.created_at}
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