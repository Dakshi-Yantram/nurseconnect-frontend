/**
 * Shared 30-minute time-slot generation for scheduling fields.
 *
 * Mirrors the slot logic used in the mobile booking screen (8 AM – 8 PM in
 * half-hour steps) so a "preferred time" picked here means the same thing
 * everywhere in the product. Centralized so the generic SchemaForm renderer
 * and its validation stay in sync instead of two copies drifting apart.
 */

export interface TimeSlotOption {
  /** Stored/submitted value, e.g. "08:30 AM". */
  value: string;
  hour: number;
  minute: number;
}

/** Minutes of lead time required before a slot counts as bookable "now". */
export const SLOT_LEAD_MINUTES = 60;

export function buildDaySlots(): TimeSlotOption[] {
  const out: TimeSlotOption[] = [];
  for (let totalMin = 8 * 60; totalMin <= 20 * 60; totalMin += 30) {
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    const period = hour < 12 ? "AM" : "PM";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    out.push({
      value: `${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`,
      hour,
      minute,
    });
  }
  return out;
}

/** "YYYY-MM-DD" for today in the browser's local timezone. */
export function todayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Slots available for a given "YYYY-MM-DD" date string. For today, anything
 * less than SLOT_LEAD_MINUTES away (or already past) is filtered out. An
 * empty/invalid dateStr is treated as "not today" — the caller (a required
 * date field) is responsible for enforcing that a date is actually chosen.
 */
export function availableSlotsForDate(dateStr: string | undefined): TimeSlotOption[] {
  const all = buildDaySlots();
  if (!dateStr || dateStr !== todayStr()) return all;

  const now = new Date();
  const earliest = new Date(now.getTime() + SLOT_LEAD_MINUTES * 60 * 1000);
  const [y, m, d] = dateStr.split("-").map(Number);
  return all.filter((s) => {
    const slotTime = new Date(y, (m ?? 1) - 1, d ?? 1, s.hour, s.minute);
    return slotTime >= earliest;
  });
}

/** True if `timeValue` (e.g. "08:30 AM") is no longer a valid choice for `dateStr`. */
export function isSlotPast(dateStr: string | undefined, timeValue: string | undefined): boolean {
  if (!timeValue) return false;
  const available = availableSlotsForDate(dateStr);
  return !available.some((s) => s.value === timeValue);
}
