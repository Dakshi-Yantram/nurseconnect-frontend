import { Check, Circle, XCircle } from "lucide-react";

type Entry = { label?: string; action?: string; created_at: string };

const STEPS = [
  { key: "created", title: "Booking created", wait: "", labels: ["Booking created"] },
  { key: "paid", title: "Payment received", wait: "Waiting for payment", labels: ["Payment received"] },
  { key: "assigned", title: "Nurse assigned", wait: "Finding your nurse", labels: ["Nurse assigned", "Finding a replacement nurse"] },
  { key: "enroute", title: "Nurse on the way", wait: "", labels: ["Nurse is on the way"] },
  { key: "started", title: "Visit started", wait: "", labels: ["Visit started"] },
  { key: "done", title: "Visit completed", wait: "", labels: ["Visit completed"] },
] as const;

// How far a booking has got, from its status — used when an audit row is missing.
const RANK: Record<string, number> = {
  draft: 0, pending_payment: 0,
  prescription_pending: 1, searching_nurse: 1, confirmed: 1,
  assigned: 2, rematch_pending: 1,
  worker_en_route: 3, worker_arrived: 3,
  in_progress: 4,
  completed: 5,
};

const fmt = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase();
  return `${date}, ${time}`;
};

/**
 * Customer-friendly progress tracker: finished steps (green tick + time), the
 * step we are on now (highlighted), and the steps still to come (greyed).
 */
export function BookingProgress({
  status, history, createdAt,
}: { status: string; history: Entry[]; createdAt?: string }) {
  const cancelled = status === "cancelled" || status === "missed";
  const reached = RANK[status] ?? (cancelled ? 0 : 0);
  const at = (labels: readonly string[]) =>
    [...history].reverse().find((h) => labels.includes(h.label ?? ""))?.created_at;

  const rows = STEPS.map((s, i) => {
    const ts = at(s.labels) ?? (s.key === "created" ? createdAt : undefined);
    const done = i <= reached || !!ts;
    return { ...s, i, done, ts };
  });
  const current = cancelled ? -1 : rows.findIndex((r) => !r.done);
  const cancelTs = at(["Booking cancelled"]);

  return (
    <ol className="px-5 py-4">
      {rows.map((r, idx) => {
        const isCurrent = r.i === current;
        const last = idx === rows.length - 1 && !cancelled;
        return (
          <li key={r.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={[
                  "h-6 w-6 rounded-full grid place-items-center shrink-0",
                  r.done ? "bg-emerald-500 text-white"
                    : isCurrent ? "bg-primary/10 text-primary ring-2 ring-primary/40"
                    : "bg-muted text-muted-foreground/50",
                ].join(" ")}
              >
                {r.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-2.5 w-2.5" fill="currentColor" />}
              </span>
              {!last && <span className={`w-0.5 flex-1 min-h-[18px] ${r.done && (rows[idx + 1]?.done) ? "bg-emerald-300" : "bg-border"}`} />}
            </div>
            <div className={`min-w-0 ${last ? "" : "pb-4"}`}>
              <div className={`text-[13px] ${r.done ? "font-semibold text-foreground" : isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                {r.done ? r.title : isCurrent && r.wait ? r.wait : r.title}
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {r.done ? fmt(r.ts) : isCurrent ? "In progress" : "Upcoming"}
              </div>
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="flex gap-3">
          <span className="h-6 w-6 rounded-full grid place-items-center bg-rose-100 text-rose-600 shrink-0"><XCircle className="h-4 w-4" /></span>
          <div>
            <div className="text-[13px] font-semibold text-rose-700">{status === "missed" ? "Visit missed" : "Booking cancelled"}</div>
            {cancelTs && <div className="text-[11.5px] text-muted-foreground">{fmt(cancelTs)}</div>}
          </div>
        </li>
      )}
    </ol>
  );
}
