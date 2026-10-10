import type { BookingEntity } from "@/lib/domain";

/** True when the booked slot is already over (server owns the clock/timezone). */
export const isPastBooking = (b: BookingEntity) => b.timeBucket === "past" || b.isExpired === true;

/** Short, friendly booking reference — never the raw UUID. */
export const bookingRef = (b: Pick<BookingEntity, "id" | "bookingRef">) =>
  b.bookingRef ?? `NC-${(b.id || "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export type BookingBucket = "in_care" | "review" | "upcoming" | "not_completed" | "done";

const LIVE = [
  "pending_payment", "prescription_pending", "searching_nurse", "confirmed", "assigned",
  "worker_en_route", "worker_arrived", "rematch_pending",
];

/**
 * One place that decides which section a booking belongs in.
 *  - unpaid / unattended bookings whose slot has passed are NOT "completed":
 *    they go to "not_completed" (shown as "Expired — not paid" / "Missed").
 */
export function bucketOf(b: BookingEntity): BookingBucket {
  const s = b.rawStatus;
  if (s === "in_progress") return "in_care";
  if (s === "disputed" || s === "quality_discrepancy_alert") return "review";
  if (s === "completed" || s === "cancelled") return "done";
  if (s === "missed") return "not_completed";
  if (LIVE.includes(s)) return isPastBooking(b) ? "not_completed" : "upcoming";
  return "done";
}

/** Unpaid and still payable (slot not over). */
export const needsPayment = (b: BookingEntity) =>
  !isPastBooking(b) &&
  (b.rawStatus === "pending_payment" || ["pending", "failed", "initiated", "cash_due"].includes(b.paymentStatus ?? "")) &&
  b.paymentStatus !== "captured" &&
  b.rawStatus !== "cancelled" && b.rawStatus !== "completed";

/** "2026-10-15 16:30" → { date: "Thu, 15 Oct", time: "4:30 PM" } (no timezone maths: it is already IST). */
export function whenParts(startedAt?: string): { date: string; time: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(startedAt ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, 12));
  const date = dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const hr = +h;
  const time = `${hr % 12 === 0 ? 12 : hr % 12}:${mi} ${hr >= 12 ? "PM" : "AM"}`;
  return { date, time };
}

/** "in 5 days", "in 3 hr", "tomorrow" — friendlier than a minute countdown. */
export function relativeWhen(startedAt?: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(startedAt ?? "");
  if (!m) return null;
  // The string is IST wall-clock; build the instant explicitly.
  const at = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - (5.5 * 3600 * 1000);
  const mins = Math.round((at - Date.now()) / 60000);
  if (mins <= 0) return null;
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} hr`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}
