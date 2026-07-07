/**
 * Shared payment-status helpers.
 *
 * Used by both the consumer Payments list (_app.consumer.payments.tsx) and
 * the booking detail page (_app.consumer.bookings.$bookingId.tsx) so the two
 * views can never drift out of sync again. Always prefer `mapRealPaymentStatus`
 * (driven by the real backend Booking.payment_status) and only fall back to
 * `derivePaymentStatus` (workflow-state heuristic) for legacy/seed rows that
 * predate a real payment record.
 */

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded" | "processing";

/**
 * Derives payment status from booking workflow state.
 * Fallback only — used when the backend hasn't told us a real payment_status yet.
 *
 *   completed              → paid       (service delivered, payment settled)
 *   active / in_progress   → processing (nurse on the way / at patient, payment in-flight)
 *   pending / claimed      → pending    (booked, awaiting service, payment authorised)
 *   cancelled              → refunded   (booking cancelled, refund due)
 *   escalated              → failed     (escalation may mean payment issue)
 */
export function derivePaymentStatus(bookingState: string): PaymentStatus {
  switch (bookingState) {
    case "completed": return "paid";
    case "active":
    case "in_progress": return "processing";
    case "pending":
    case "claimed": return "pending";
    case "cancelled": return "refunded";
    case "escalated": return "failed";
    default: return "pending";
  }
}

/**
 * Maps the real backend payment_status (BookingOut.payment_status) to the
 * display categories the UI knows how to render. Returns null when the
 * backend hasn't told us yet (still hydrating, or a demo/seed record with
 * no payment row) — callers should fall back to `derivePaymentStatus`.
 */
export function mapRealPaymentStatus(raw: string | undefined): PaymentStatus | null {
  switch (raw) {
    case "captured": return "paid";
    case "initiated": return "processing";
    case "pending": return "pending";
    case "failed": return "failed";
    case "refunded":
    case "partially_refunded": return "refunded";
    default: return null;
  }
}

/** Whether a "Pay now" action should be offered for this payment status. */
export function isPayable(raw: string | undefined): boolean {
  return raw === "pending" || raw === "failed" || raw === "initiated";
}

/** Derive a realistic per-booking amount.
 *  Fallback only — used when the backend hasn't given us a real total_amount yet
 *  (e.g. legacy/seed rows). In production this should always come from the
 *  backend's Booking.total_amount / pricing API. */
export function deriveAmount(service: string | undefined): number {
  const s = (service ?? "").toLowerCase();
  if (s.includes("live-in") || s.includes("live in")) return 8500;
  if (s.includes("post") || s.includes("surgery")) return 4200;
  if (s.includes("geriatric") || s.includes("elderly")) return 3600;
  if (s.includes("physio")) return 2800;
  if (s.includes("diabetes") || s.includes("diabetic")) return 2200;
  if (s.includes("wound")) return 1800;
  if (s.includes("blood") || s.includes("bp")) return 1400;
  return 2400; // default
}

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

/** Safely coerce a value (possibly a string from JSON-serialized Decimal) to
 *  a number. Falls back to `fallback` if the value is missing or not numeric.
 *  Without this, string amounts like "299.00" get string-concatenated
 *  instead of summed (e.g. 0 + "299.00" + "299.00" → "0299.00299.00"). */
export function toAmount(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return raw != null && Number.isFinite(n) ? n : fallback;
}

/**
 * Converts backend total_amount into the INR number used by `formatINR`.
 *
 * The backend stores total_amount in RUPEES (Decimal), NOT paise. Return it
 * as-is. When total_amount is missing, callers fall back to deriveAmount().
 */
export function toAmountPaise(totalAmount: unknown, fallback: number): number {
  if (totalAmount == null) return fallback;
  const n = toAmount(totalAmount, NaN);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

