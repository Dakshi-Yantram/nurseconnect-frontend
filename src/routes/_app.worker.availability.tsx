import { createFileRoute } from "@tanstack/react-router";
import { WorkflowActionButton } from "@/components/shared/WorkflowActionButton";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/worker/availability")({
  component: WorkerAvailability,
  head: () => ({ meta: [{ title: "Availability — NurseConnect" }] }),
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

const SLOTS = [
  { id: "Morning",   label: "Morning",   time: "6:00 – 12:00",  icon: "☀️" },
  { id: "Afternoon", label: "Afternoon", time: "12:00 – 18:00", icon: "🌤" },
  { id: "Evening",   label: "Evening",   time: "18:00 – 22:00", icon: "🌙" },
  { id: "Night",     label: "Night",     time: "22:00 – 6:00",  icon: "🌃" },
];

type ViewMode = "grid" | "day";

function WorkerAvailability() {
  const [grid, setGrid] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const d of DAYS) for (const s of SLOTS) out[`${d}_${s.id}`] = ["Morning", "Afternoon"].includes(s.id);
    return out;
  });
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedDay, setSelectedDay] = useState<string>("Mon");

  const toggle = (k: string) => setGrid(g => ({ ...g, [k]: !g[k] }));

  const toggleAll = (slot: string) => {
    const allOn = DAYS.every(d => grid[`${d}_${slot}`]);
    setGrid(g => {
      const next = { ...g };
      DAYS.forEach(d => { next[`${d}_${slot}`] = !allOn; });
      return next;
    });
  };

  const toggleDay = (day: string) => {
    const allOn = SLOTS.every(s => grid[`${day}_${s.id}`]);
    setGrid(g => {
      const next = { ...g };
      SLOTS.forEach(s => { next[`${day}_${s.id}`] = !allOn; });
      return next;
    });
  };

  const totalSlots = Object.values(grid).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        {/* Header card */}
        <div className="rounded-xl border border-border bg-background px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-foreground tracking-tight">Weekly Availability</h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              {totalSlots} of {DAYS.length * SLOTS.length} slots marked available
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 border border-border p-1">
              {(["grid", "day"] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all",
                    view === v
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "grid" ? "Grid" : "By Day"}
                </button>
              ))}
            </div>
            <WorkflowActionButton
              action="worker.update_availability"
              variant="primary"
              onClick={() => toast.success("Availability saved")}
            >
              Save
            </WorkflowActionButton>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => {
            const count = SLOTS.filter(s => grid[`${d}_${s.id}`]).length;
            return (
              <div
                key={d}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium border cursor-pointer transition-all",
                  count > 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-border bg-muted/40 text-muted-foreground"
                )}
                onClick={() => { setView("day"); setSelectedDay(d); }}
              >
                <span>{d}</span>
                {count > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-700">
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── GRID VIEW ── */}
        {view === "grid" && (
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            {/* Day header row */}
            <div className="grid grid-cols-[auto_repeat(7,1fr)] border-b border-border bg-muted/30">
              <div className="px-4 py-3 text-[12px] font-semibold text-muted-foreground">Slot</div>
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className="py-3 text-center text-[12px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  title={`Toggle all ${DAY_FULL[d]}`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Slot rows */}
            {SLOTS.map((slot, si) => (
              <div
                key={slot.id}
                className={cn(
                  "grid grid-cols-[auto_repeat(7,1fr)]",
                  si < SLOTS.length - 1 && "border-b border-border"
                )}
              >
                {/* Slot label */}
                <button
                  onClick={() => toggleAll(slot.id)}
                  className="px-4 py-3.5 text-left hover:bg-primary/5 transition-colors group"
                  title={`Toggle all ${slot.label}`}
                >
                  <span className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                    {slot.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">{slot.time}</span>
                </button>

                {/* Day cells */}
                {DAYS.map(d => {
                  const k = `${d}_${slot.id}`;
                  const on = grid[k];
                  return (
                    <div key={k} className="flex items-center justify-center px-2 py-3">
                      <button
                        onClick={() => toggle(k)}
                        className={cn(
                          "h-9 w-full max-w-[72px] rounded-lg border text-[11.5px] font-semibold transition-all duration-150 active:scale-95",
                          on
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:border-border"
                        )}
                      >
                        {on ? "On" : "Off"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── DAY VIEW ── */}
        {view === "day" && (
          <div className="space-y-4">
            {/* Day selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    "flex-shrink-0 rounded-xl border px-4 py-2.5 text-center transition-all duration-150",
                    selectedDay === d
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <span className="block text-[12px] font-bold">{d}</span>
                  <span className={cn("block text-[10px] mt-0.5", selectedDay === d ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {SLOTS.filter(s => grid[`${d}_${s.id}`]).length} slots
                  </span>
                </button>
              ))}
            </div>

            {/* Instruction banner */}
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/6 px-4 py-3.5">
              <div>
                <p className="text-[13px] font-semibold text-primary">{DAY_FULL[selectedDay]}</p>
                <p className="text-[12px] text-primary/80 mt-0.5">Tap a slot to toggle your availability</p>
              </div>
            </div>

            {/* Slot cards */}
            <div className="space-y-2.5">
              {SLOTS.map(slot => {
                const k = `${selectedDay}_${slot.id}`;
                const on = grid[k];
                return (
                  <button
                    key={slot.id}
                    onClick={() => toggle(k)}
                    className={cn(
                      "w-full text-left flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      on
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"
                    )}
                  >
                    {/* Toggle indicator */}
                    <span
                      className={cn(
                        "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                        on ? "border-emerald-500 bg-emerald-500" : "border-border bg-background"
                      )}
                    >
                      {on && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className="flex-1">
                      <span className={cn("block text-[13.5px] font-semibold leading-snug", on ? "text-emerald-700" : "text-foreground")}>
                        {slot.label}
                      </span>
                      <span className="block text-[12px] text-muted-foreground">{slot.time}</span>
                    </span>
                    <span className={cn(
                      "rounded-full px-3 py-1 text-[11.5px] font-semibold",
                      on
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {on ? "Available" : "Off"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick action */}
            <button
              onClick={() => toggleDay(selectedDay)}
              className="w-full rounded-xl border border-dashed border-border py-3 text-[13px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
            >
              {SLOTS.every(s => grid[`${selectedDay}_${s.id}`])
                ? `Clear all slots for ${DAY_FULL[selectedDay]}`
                : `Mark all slots available for ${DAY_FULL[selectedDay]}`}
            </button>
          </div>
        )}

        {/* Footer save */}
        <div className="flex justify-end pt-1">
          <WorkflowActionButton
            action="worker.update_availability"
            variant="primary"
            onClick={() => toast.success("Availability saved")}
          >
            Save availability
          </WorkflowActionButton>
        </div>

      </div>
    </div>
  );
}