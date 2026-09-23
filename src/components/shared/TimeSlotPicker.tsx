import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Sun, Sunset, Moon } from "lucide-react";

export interface TimeSlot {
  /** Stored/submitted value — the slot's start time, e.g. "12:00 PM". */
  value: string;
  /** Row label, e.g. "12:00 pm - 1:00 pm". */
  label: string;
  group: "Morning" | "Afternoon" | "Evening";
}

function fmt(h24: number): string {
  const period = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:00 ${period}`;
}
function fmtValue(h24: number): string {
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:00 ${period}`;
}

// 6 AM – 9 PM in 1-hour blocks, grouped the same way the reference design
// grouped them: Morning ends at noon, Afternoon runs to 3 PM, Evening
// covers the rest of the bookable day.
export const DEFAULT_SLOTS: TimeSlot[] = Array.from({ length: 15 }, (_, i) => {
  const startHour = 6 + i; // 6 .. 20
  const group: TimeSlot["group"] = startHour < 12 ? "Morning" : startHour < 15 ? "Afternoon" : "Evening";
  return {
    value: fmtValue(startHour),
    label: `${fmt(startHour)} - ${fmt(startHour + 1)}`,
    group,
  };
});

const GROUP_ICON = { Morning: Sun, Afternoon: Sunset, Evening: Moon } as const;

/** Inline (non-modal) slot list — Morning/Afternoon/Evening sections of radio rows. */
export function TimeSlotList({
  slots = DEFAULT_SLOTS, value, onChange,
}: { slots?: TimeSlot[]; value: string; onChange: (v: string) => void }) {
  const groups: TimeSlot["group"][] = ["Morning", "Afternoon", "Evening"];
  return (
    <div className="divide-y divide-border">
      {groups.map((g) => {
        const rows = slots.filter((s) => s.group === g);
        if (rows.length === 0) return null;
        const Icon = GROUP_ICON[g];
        return (
          <div key={g}>
            <div className="flex items-center gap-2 px-4 py-3">
              <Icon size={15} className="text-emerald-600" />
              <span className="text-[13px] font-semibold text-emerald-700">{g}</span>
            </div>
            {rows.map((s) => (
              <label key={s.value + s.label} className="flex items-center gap-3 px-4 py-4 border-t border-border/60 cursor-pointer active:bg-muted/30">
                <span className={cn(
                  "h-5 w-5 flex-shrink-0 rounded-full border-2",
                  value === s.value ? "border-[#ff5a4e]" : "border-muted-foreground/40",
                )}>
                  {value === s.value && <span className="block h-full w-full scale-[0.45] rounded-full bg-[#ff5a4e]" />}
                </span>
                <input type="radio" name="time_slot" className="sr-only"
                  checked={value === s.value} onChange={() => onChange(s.value)} />
                <span className="text-[14.5px] text-foreground">{s.label}</span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Full-screen "Select slot" page — back arrow + title header, the grouped
 * slot list filling the screen, and a sticky full-width "Confirm slot"
 * button pinned to the bottom. Matches the dedicated slot-selection screen
 * design (not a centered popup) so it feels like a real page in the booking
 * flow rather than a dialog interrupting it.
 */
export function TimeSlotPicker({
  open, onClose, value, onConfirm, slots = DEFAULT_SLOTS,
}: {
  open: boolean; onClose: () => void; value?: string;
  onConfirm: (v: string) => void; slots?: TimeSlot[];
}) {
  const [picked, setPicked] = useState<string>(value ?? "");

  useEffect(() => {
    if (open) setPicked(value ?? "");
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:bg-slate-900/40 sm:backdrop-blur-sm sm:p-4">
      <div className="flex flex-col w-full h-full bg-background sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl sm:overflow-hidden">
        {/* Header — back arrow + title, no popup chrome */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full bg-muted hover:bg-muted/70">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[17px] font-bold text-foreground">Select slot</h1>
        </div>

        {/* Slot list — fills remaining height, scrolls independently */}
        <div className="flex-1 overflow-y-auto nc-scroll">
          <TimeSlotList slots={slots} value={picked} onChange={setPicked} />
        </div>

        {/* Sticky confirm button */}
        <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-background">
          <button
            type="button"
            disabled={!picked}
            onClick={() => { onConfirm(picked); onClose(); }}
            className="w-full rounded-xl bg-[#ff5a4e] px-4 py-3.5 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            Confirm slot
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

