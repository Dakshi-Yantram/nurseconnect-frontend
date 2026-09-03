import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { Search, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_app/teledoctor-queue")({ component: TeledoctorQueuePage });

type Stage = "waiting" | "diet_review" | "patient_assessment" | "prescription" | "completed";

interface ConsultRow {
  id: string;
  booking_id: string;
  booking_ref: string;
  doctor_name: string;
  patient_name: string;
  stage: Stage;
  diet_notes: string | null;
  patient_issues: string | null;
  patient_all_okay: boolean | null;
  prescription_id: string | null;
  created_at: string;
}

const STAGES: { id: Stage; label: string; tone: "muted" | "warning" | "info" | "purple" | "success" }[] = [
  { id: "waiting", label: "Waiting", tone: "muted" },
  { id: "diet_review", label: "Diet Review", tone: "warning" },
  { id: "patient_assessment", label: "Patient Assessment", tone: "info" },
  { id: "prescription", label: "Ready for e-Rx", tone: "purple" },
  { id: "completed", label: "Completed", tone: "success" },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function TeledoctorQueuePage() {
  const [grouped, setGrouped] = useState<Record<Stage, ConsultRow[]>>({
    waiting: [], diet_review: [], patient_assessment: [], prescription: [], completed: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/teleconsult/admin/queue")
      .then((data: Record<Stage, ConsultRow[]>) => setGrouped(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load teledoctor queue"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filterRows = (rows: ConsultRow[]) =>
    rows.filter((r) =>
      !query ||
      r.patient_name?.toLowerCase().includes(query.toLowerCase()) ||
      r.doctor_name?.toLowerCase().includes(query.toLowerCase()) ||
      r.booking_ref?.toLowerCase().includes(query.toLowerCase()),
    );

  const totalActive = useMemo(
    () => STAGES.filter((s) => s.id !== "completed").reduce((sum, s) => sum + (grouped[s.id]?.length ?? 0), 0),
    [grouped],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold leading-tight">Teledoctor Queue</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Cross-doctor view of every teleconsultation, grouped by stage: waiting → diet review → patient assessment → e-prescription → completed.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {STAGES.map((s) => (
          <div key={s.id} className="nc-card p-4">
            <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</div>
            <div className="mt-1.5 text-[22px] font-semibold tabular-nums">{grouped[s.id]?.length ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-9 pl-8 pr-3 text-[13px] rounded-md border border-border bg-background"
            placeholder="Search patient, doctor or booking ref..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-[12px] text-muted-foreground">{totalActive} active consultations</span>
      </div>

      {error && <div className="nc-card p-4 text-[13px] text-rose-600">{error}</div>}
      {loading && <div className="nc-card p-4 text-[13px] text-muted-foreground">Loading…</div>}

      {!loading && STAGES.map((stage) => {
        const rows = filterRows(grouped[stage.id] ?? []);
        if (rows.length === 0) return null;
        return (
          <Card key={stage.id} title={
            <span className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              {stage.label}
              <StatusChip label={rows.length} tone={stage.tone} />
            </span>
          } padded={false}>
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{r.patient_name}</div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      Dr. {r.doctor_name} · Booking {r.booking_ref} · {formatDateTime(r.created_at)}
                    </div>
                    {stage.id === "diet_review" && r.diet_notes && (
                      <div className="text-[11.5px] text-muted-foreground mt-1 truncate">Diet: {r.diet_notes}</div>
                    )}
                    {stage.id === "patient_assessment" && (
                      <div className="text-[11.5px] text-muted-foreground mt-1">
                        {r.patient_all_okay === true ? "Marked all okay" : r.patient_issues ? `Issue: ${r.patient_issues}` : "Assessment pending"}
                      </div>
                    )}
                  </div>
                  {stage.id === "prescription" && !r.prescription_id && (
                    <StatusChip label="Awaiting e-Rx" tone="warning" />
                  )}
                  {r.prescription_id && <StatusChip label="e-Rx issued" tone="success" />}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {!loading && !error && totalActive === 0 && (grouped.completed?.length ?? 0) === 0 && (
        <div className="nc-card p-8 text-center text-[13px] text-muted-foreground">No teleconsultations yet.</div>
      )}
    </div>
  );
}
