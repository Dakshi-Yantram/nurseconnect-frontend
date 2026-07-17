import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, XCircle, RefreshCw, GraduationCap, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/training-review")({
  component: TrainingReviewPage,
  head: () => ({ meta: [{ title: "Training Review — NurseConnect" }] }),
});

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: number;
}

interface ModuleRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  pass_percent: number;
  is_mandatory: boolean;
  status: string;
  assessment: Question[];
  updated_at: string;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  draft: "muted",
  under_review: "warning",
  published: "success",
  rejected: "danger",
};

function ReviewModal({ module, onClose, onDone }: { module: ModuleRow; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const act = async (action: "approve" | "reject") => {
    if (action === "reject" && notes.trim().length < 5) {
      toast.error("Add a reason for rejection");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/training/${module.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ notes: notes.trim() || null }),
      });
      toast.success(action === "approve" ? "Approved and published to nurses" : "Sent back for revision");
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="text-[15px] font-semibold text-foreground">{module.title}</p>
            <p className="text-[11px] font-mono text-muted-foreground">{module.code}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-[13px] text-foreground">{module.description}</p>
          <div className="grid grid-cols-3 gap-3 text-[12.5px]">
            <div><span className="text-muted-foreground">Duration</span><div className="font-medium">{module.duration_minutes} min</div></div>
            <div><span className="text-muted-foreground">Pass mark</span><div className="font-medium">{module.pass_percent}%</div></div>
            <div><span className="text-muted-foreground">Questions</span><div className="font-medium">{module.assessment.length}</div></div>
          </div>

          <div className="space-y-3">
            <p className="text-[12.5px] font-semibold text-foreground">Questions</p>
            {module.assessment.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12.5px] font-medium">{i + 1}. {q.question}</span>
                  <span className="text-[10px] text-muted-foreground">Difficulty {q.difficulty}</span>
                </div>
                <ul className="space-y-1">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className={cn("text-[12px] px-2 py-1 rounded", oi === q.correct_index ? "bg-emerald-50 text-emerald-700 font-medium" : "text-muted-foreground")}>
                      {["A", "B", "C", "D"][oi]}. {opt} {oi === q.correct_index && "✓"}
                    </li>
                  ))}
                </ul>
                {q.explanation && <p className="text-[11px] text-muted-foreground mt-1.5 italic">{q.explanation}</p>}
              </div>
            ))}
          </div>

          <div>
            <label className="text-[12px] font-medium text-foreground">Review notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Required if rejecting"
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => act("reject")} disabled={submitting}
              className="flex-1 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[13px] font-medium py-2.5 flex items-center justify-center gap-1.5 transition-all disabled:opacity-60">
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button onClick={() => act("approve")} disabled={submitting}
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium py-2.5 flex items-center justify-center gap-1.5 transition-all disabled:opacity-60">
              <CheckCircle2 className="h-4 w-4" /> Approve & Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainingReviewPage() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ModuleRow | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch("/api/training/admin/modules")
      .then(setModules)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load modules"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "pending" ? modules.filter(m => m.status === "under_review") : modules;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-foreground">Training Review</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Review clinical trainer submissions. Approving publishes content to nurses immediately.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["pending", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all capitalize", filter === f ? "bg-white text-foreground shadow-sm" : "text-muted-foreground")}>
            {f === "pending" ? "Pending Review" : "All Modules"}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {loading && <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Loading…</div>}
        {error && (
          <div className="px-5 py-8 text-center text-[13px] text-red-600">
            {error}
            <button onClick={load} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5">Code</th><th className="px-5 py-2.5">Title</th>
              <th className="px-5 py-2.5">Questions</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center">
                  <GraduationCap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">{filter === "pending" ? "Nothing pending review." : "No modules yet."}</p>
                </td></tr>
              )}
              {filtered.map(m => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px]">{m.code}</td>
                  <td className="px-5 py-3 font-medium">{m.title}</td>
                  <td className="px-5 py-3">{m.assessment?.length ?? 0}</td>
                  <td className="px-5 py-3"><StatusChip tone={STATUS_TONE[m.status] ?? "muted"} label={m.status.replace(/_/g, " ")} dot /></td>
                  <td className="px-5 py-3">
                    <button onClick={() => setActive(m)} className="text-[12px] text-primary hover:underline">
                      {m.status === "under_review" ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {active && (
        <ReviewModal module={active} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />
      )}
    </div>
  );
}
