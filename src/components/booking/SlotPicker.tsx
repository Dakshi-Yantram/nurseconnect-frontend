import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Day chips + start-time chips (replaces the old <select> dropdown).
 *
 * Everything shown comes from GET /api/bookings/slots?date=YYYY-MM-DD, so:
 *   - slots less than 2 hours from now (IST) are never selectable, and
 *   - off-hours slots carry their "+ ₹100" badge, which is also what the
 *     server adds to the bill when the booking is created.
 */
export interface SlotChoice {
  /** YYYY-MM-DD (IST calendar day) */
  date: string;
  /** HH:MM, 24h */
  time: string;
  surcharge: number;
  label: string;
}

interface ApiSlot {
  value: string;
  label: string;
  surcharge: number;
  is_off_hours: boolean;
  available: boolean;
  reason: string | null;
}
interface SlotsResponse {
  date: string;
  min_lead_minutes: number;
  surcharge_inr: number;
  slots: ApiSlot[];
}

const DAYS_SHOWN = 7;
const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}
function dayParts(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return { dow: dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }), dom: d };
}

export function SlotPicker({
  value, onChange, required = true,
}: {
  value: SlotChoice | null;
  onChange: (v: SlotChoice | null) => void;
  required?: boolean;
}) {
  const today = useMemo(istToday, []);
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)), [today]);
  const [date, setDate] = useState<string>(value?.date ?? today);
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch(`/api/bookings/slots?date=${d}`));
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e, "We couldn't load the available times."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  // If today has no slot left (late evening), jump to tomorrow automatically.
  useEffect(() => {
    if (data && data.date === today && date === today && data.slots.every((s) => !s.available) && !value) {
      setDate(addDays(today, 1));
    }
  }, [data, today, date, value]);

  // A previously picked time can become invalid (clock moved on) — drop it.
  useEffect(() => {
    if (!data || !value || value.date !== data.date) return;
    const s = data.slots.find((x) => x.value === value.time);
    if (!s || !s.available) onChange(null);
  }, [data, value, onChange]);

  const available = data?.slots.filter((s) => s.available) ?? [];
  const leadHours = data ? Math.round(data.min_lead_minutes / 60) : 2;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-semibold text-foreground">When should the professional arrive?</p>
        <p className="text-[12.5px] text-muted-foreground">Bookings need at least {leadHours} hours' notice.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose a day">
        {days.map((d) => {
          const p = dayParts(d);
          const sel = d === date;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => { setDate(d); if (value && value.date !== d) onChange(null); }}
              className={cn(
                "relative shrink-0 w-[64px] rounded-xl border px-2 py-2.5 text-center transition",
                sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40",
              )}
            >
              <div className="text-[12px] text-muted-foreground">{d === today ? "Today" : p.dow}</div>
              <div className="text-[18px] font-semibold text-foreground leading-tight">{p.dom}</div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-dashed border-border" />

      <p className="text-[14px] font-semibold text-foreground">Select start time of service{required ? <span className="text-red-500"> *</span> : null}</p>

      {loading && <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading times…</div>}
      {error && (
        <p className="text-[12.5px] text-red-600">
          {error} <button type="button" onClick={() => load(date)} className="font-medium underline">Try again</button>
        </p>
      )}

      {!loading && data && available.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground rounded-lg bg-muted/50 px-3 py-2.5">
          No time slots are left for this day. Please pick another day.
        </p>
      )}

      {!loading && data && available.length > 0 && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 pt-1">
          {data.slots.map((s) => {
            const sel = value?.date === data.date && value.time === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={!s.available}
                title={s.reason ?? undefined}
                onClick={() => onChange({ date: data.date, time: s.value, surcharge: s.surcharge, label: s.label })}
                className={cn(
                  "relative rounded-xl border px-2 py-3.5 text-[14px] transition",
                  sel ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-foreground hover:border-primary/50",
                  !s.available && "cursor-not-allowed bg-muted/40 text-muted-foreground/50 line-through hover:border-border",
                )}
              >
                {s.label}
                {s.available && s.surcharge > 0 && (
                  <span className="absolute -top-2.5 right-1.5 inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700 border border-amber-100">
                    <TrendingUp className="h-2.5 w-2.5" /> + ₹{s.surcharge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {value && value.surcharge > 0 && (
        <p className="text-[12px] text-amber-700">An extra ₹{value.surcharge} applies for this time slot.</p>
      )}
    </div>
  );
}
