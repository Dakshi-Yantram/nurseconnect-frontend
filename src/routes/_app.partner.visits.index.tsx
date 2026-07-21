import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { apiFetch } from "@/lib/api";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { MapPin, ChevronRight, UserRound, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/visits/")({
  component: WorkerVisits,
  head: () => ({ meta: [{ title: "Visits â€” NurseConnect" }] }),
});

const STATUS_ACCENT: Record<string, string> = {
  in_progress: "bg-teal-500",
  worker_en_route: "bg-sky-500",
  worker_arrived: "bg-sky-500",
  disputed: "bg-rose-500",
  completed: "bg-emerald-500",
  assigned: "bg-amber-400",
};
function accentFor(state: string) {
  return STATUS_ACCENT[state] ?? "bg-slate-300";
}

interface WorkerVisitRow {
  id: string;
  state: string;
  patientName: string;
  service: string;
  area: string;
  enteredAt?: string;
}

function useWorkerVisits() {
  const [rows, setRows] = useState<WorkerVisitRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/bookings/worker")
      .then((data: any[]) => {
        if (cancelled) return;
        setRows(data.map(b => ({
          id: b.id,
          state: b.status ?? "assigned",
          patientName: b.patient_name ?? "—",
          service: b.service_name ?? "—",
          area: b.address_snapshot ? [b.address_snapshot.line1, b.address_snapshot.city].filter(Boolean).join(", ") : "—",
          enteredAt: b.accepted_at ?? b.created_at,
        })));
      })
      .catch(() => setRows([]));
    return () => { cancelled = true; };
  }, []);
  return rows;
}

function WorkerVisits() {
  const rows = useWorkerVisits();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        {/* Header */}
        <div>
          <h2 className="text-[17px] font-bold text-foreground tracking-tight">My Visits</h2>
          {rows.length > 0 && (
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              {rows.length} visit{rows.length !== 1 ? "s" : ""} assigned
            </p>
          )}
        </div>

        {/* Empty state */}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-background px-6 py-14 flex flex-col items-center text-center gap-2">
            <MapPin className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-[14px] font-semibold text-foreground">No visits scheduled</p>
            <p className="text-[12px] text-muted-foreground">Accepted assignments will appear here as visits.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rows.map((r) => {
              const state = bindStatus("booking", r.state);
              const patient = r.patientName;
              const service = r.service;
              const area = r.area;

              return (
                <Link
                  key={r.id}
                  to="/partner/visits/$visitId"
                  params={{ visitId: r.id }}
                  className="group bg-background border border-border rounded-xl hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 overflow-hidden block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {/* Status accent bar */}
                  <div className={cn("h-1 w-full", accentFor(state))} />

                  <div className="flex items-start gap-3 px-4 py-3.5">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <UserRound className="w-4 h-4 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-bold text-foreground leading-tight truncate">{patient}</span>
                        <span className="text-[11px] text-muted-foreground/60 font-mono">#{r.id}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Stethoscope className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground truncate">{service}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />{area}
                        </span>
                        <SLAIndicator
                          workflow="booking" state={state}
                          enteredAt={parseEnteredAt(r.enteredAt)}
                        />
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge workflow="booking" state={state} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
