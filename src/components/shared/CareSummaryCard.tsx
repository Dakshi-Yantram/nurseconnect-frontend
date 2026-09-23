import { ClipboardList, Activity, Clock, AlertCircle } from "lucide-react";
import type { Vital, VisitReport } from "@/lib/visit-report-types";
import { VisitReportButton } from "@/components/shared/VisitReportButton";
import { ProtectedContent } from "@/components/shared/ProtectedContent";

/**
 * Read-only summary of a completed visit's report.
 *
 * Mirrors the "Care summary" card the family sees on their own booking page
 * (_app.consumer.bookings.$bookingId.tsx), but is fed from
 * GET /api/visits/{id}/report so it also carries `care_notes` — the nurse's
 * own working notes, which are deliberately excluded from the family-facing
 * endpoint. Renders nothing if there is no report and no vitals yet, so a
 * caller can mount it unconditionally once a visit is completed.
 */
export function CareSummaryCard({
  report,
  latestVital,
  bookingId,
  error,
  onRetry,
}: {
  report: VisitReport | null;
  latestVital: Vital | null;
  /** When provided, shows a "Download report" button for the nurse's own PDF copy. */
  bookingId?: string;
  /** Load failure for the report (session expired, 403, 5xx, offline…). */
  error?: string | null;
  onRetry?: () => void;
}) {
  const hasVitals = latestVital != null && (
    latestVital.bp_systolic != null || latestVital.bp_diastolic != null || latestVital.spo2 != null ||
    latestVital.pulse != null || latestVital.temperature_f != null
  );

  const header = (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <ClipboardList size={15} className="text-primary" />
        <p className="text-[13px] font-semibold text-foreground">Visit Care Summary</p>
      </div>
      {bookingId && !error && <VisitReportButton bookingId={bookingId} endpoint="worker" />}
    </div>
  );

  // Previously a failed fetch rendered NOTHING (the card just vanished).
  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        {header}
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p>{error}</p>
            {onRetry && (
              <button type="button" onClick={onRetry} className="mt-1 font-medium underline">Try again</button>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (!report && !hasVitals) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        {header}
        <p className="text-[12.5px] text-muted-foreground">No report or vitals were recorded for this visit.</p>
      </div>
    );
  }

  const fmtBp = (v: Vital | null) =>
    v?.bp_systolic != null && v?.bp_diastolic != null
      ? `${v.bp_systolic} / ${v.bp_diastolic} mmHg`
      : v?.bp_systolic != null || v?.bp_diastolic != null
        ? `${v?.bp_systolic ?? "?"} / ${v?.bp_diastolic ?? "?"} mmHg (incomplete)`
        : "—";

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      {header}
      <ProtectedContent bookingId={bookingId} label="Visit care summary">

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Duration</p>
          <p className="text-[13px] font-semibold mt-0.5">
            {report?.actual_duration_minutes != null ? `${report.actual_duration_minutes} mins` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Completed at</p>
          <p className="text-[13px] font-semibold mt-0.5">
            {report?.check_out_at
              ? new Date(report.check_out_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
              : "—"}
          </p>
        </div>
      </div>

      {!hasVitals && (
        <p className="mb-4 text-[12.5px] text-muted-foreground flex items-center gap-1.5">
          <Activity size={12} /> No vitals were recorded during this visit.
        </p>
      )}
      {hasVitals && (
        <div className="mb-4">
          <p className="text-[11.5px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Activity size={12} /> Vitals recorded
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Blood pressure</p>
              <p className="text-[13px] font-semibold mt-0.5">
                {fmtBp(latestVital)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">SpO₂</p>
              <p className="text-[13px] font-semibold mt-0.5">{latestVital?.spo2 != null ? `${latestVital.spo2}%` : "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Heart rate</p>
              <p className="text-[13px] font-semibold mt-0.5">{latestVital?.pulse != null ? `${latestVital.pulse} bpm` : "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Temperature</p>
              <p className="text-[13px] font-semibold mt-0.5">
                {latestVital?.temperature_f != null ? `${latestVital.temperature_f} °F` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <p className="text-[11.5px] font-medium text-muted-foreground mb-2">Your clinical notes (internal)</p>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
          {report?.care_notes || "No clinical notes recorded."}
        </div>
      </div>

      <div>
        <p className="text-[11.5px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Clock size={12} /> Summary sent to the family
        </p>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
          {report?.family_summary || "No family summary was recorded."}
        </div>
      </div>
      </ProtectedContent>
    </div>
  );
}
