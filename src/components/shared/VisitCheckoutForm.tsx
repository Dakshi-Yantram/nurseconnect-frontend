import { FileText, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

/**
 * The two report fields a nurse fills in when closing out a visit, plus the
 * checkout button. Pulled out of the visit-detail route so the labeling and
 * the "did you paste the same text twice?" safety check live in exactly one
 * place — any other screen that lets a nurse complete a visit (a future
 * bulk-checkout flow, an offline-sync reconciliation screen, etc.) gets the
 * same fixed behavior automatically instead of re-implementing its own
 * version of this form and re-introducing the bug this was built to catch.
 *
 * `family_summary` and `care_notes` are two genuinely different audiences —
 * see GET/PUT /api/visits/{bookingId}/report and the family-facing
 * GET /api/visits/{bookingId}/report/consumer, which deliberately omits
 * care_notes. This form's only job is to make that distinction obvious
 * before submit, not to enforce it — a nurse can still submit identical
 * text if that's genuinely correct for this visit.
 */
export function VisitCheckoutForm({
  summary,
  notes,
  onSummaryChange,
  onNotesChange,
  onSubmit,
  submitting,
  disabled,
  title = "Family summary & checkout",
  submitLabel = "Complete visit & check out",
}: {
  summary: string;
  notes: string;
  onSummaryChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  /** Shows the spinner and disables the button while a submit is in flight. */
  submitting: boolean;
  /** Disables the button for a reason other than this form's own submit (e.g. another action is busy). */
  disabled?: boolean;
  title?: string;
  submitLabel?: string;
}) {
  const isDuplicate = summary.trim().length > 0 && summary.trim() === notes.trim();

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={15} className="text-primary" />
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
      </div>

      <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
        👨‍👩‍👧 Summary for the family <span className="font-normal normal-case text-muted-foreground/80">— they will read this</span>
      </label>
      <textarea
        value={summary}
        onChange={(e) => onSummaryChange(e.target.value)}
        rows={3}
        placeholder="What you did during the visit, how the patient is doing, anything they should watch for…"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
      />

      <label className="mt-3 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
        🔒 Your clinical notes <span className="font-normal normal-case text-muted-foreground/80">— internal only, family never sees this</span>
      </label>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={2}
        placeholder="Your own clinical record — observations, concerns, handover notes for the next visit…"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
      />

      {/* Both boxes have a genuinely different audience — if they end up
          identical it's almost always because the same text got pasted
          into both by mistake, not because that's actually what belongs
          in each. Flag it rather than silently accepting it, since once
          checked out this can only be corrected via a later report edit. */}
      {isDuplicate && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Both boxes have the exact same text. The family summary and your clinical notes usually
          say different things — double-check before submitting.
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting || disabled}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
        {submitLabel}
      </button>
    </div>
  );
}
