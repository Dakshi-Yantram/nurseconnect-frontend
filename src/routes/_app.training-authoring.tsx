import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Plus, Send, Trash2, X, RefreshCw, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/training-authoring")({
  component: TrainingAuthoringPage,
  head: () => ({ meta: [{ title: "My Training Modules — NurseConnect" }] }),
});

interface Question {
  id: string;
  type: "single_select";
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
  review_notes: string | null;
  assessment: Question[];
  created_by: string | null;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  draft: "muted",
  under_review: "warning",
  approved: "info",
  published: "success",
  rejected: "danger",
};

function emptyQuestion(): Question {
  return {
    id: `q${Date.now()}`,
    type: "single_select",
    question: "",
    options: ["", "", "", ""],
    correct_index: 0,
    explanation: "",
    difficulty: 2,
  };
}

function NewModuleForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState(30);
  const [passPercent, setPassPercent] = useState(70);
  const [isMandatory, setIsMandatory] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };
  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q;
      const options = [...q.options];
      options[optIdx] = value;
      return { ...q, options };
    }));
  };

  const submit = async () => {
    if (!code.trim() || !title.trim() || questions.some(q => !q.question.trim() || q.options.some(o => !o.trim()))) {
      toast.error("Fill in the module code, title, and every question/option");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/training/modules", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          duration_minutes: duration,
          pass_percent: passPercent,
          is_mandatory: isMandatory,
          assessment: questions,
        }),
      });
      toast.success("Module draft created");
      setCode(""); setTitle(""); setDescription(""); setCategory("");
      setDuration(30); setPassPercent(70); setIsMandatory(false);
      setQuestions([emptyQuestion()]);
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create module");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="New Training Module">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] font-medium text-foreground">Module code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="TRN-CUSTOM-01"
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Infection Prevention"
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
        </div>
        <div>
          <label className="text-[12px] font-medium text-foreground">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        </div>
        <div>
          <label className="text-[12px] font-medium text-foreground">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[12px] font-medium text-foreground">Duration (min)</label>
            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Pass %</label>
            <input type="number" value={passPercent} onChange={e => setPassPercent(Number(e.target.value))}
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] mt-6">
            <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} />
            Mandatory
          </label>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-foreground">MCQ Questions ({questions.length})</p>
            <button type="button" onClick={() => setQuestions(qs => [...qs, emptyQuestion()])}
              className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add question
            </button>
          </div>
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={q.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Question {qIdx + 1}</span>
                  <div className="flex items-center gap-2">
                    <select value={q.difficulty} onChange={e => updateQuestion(qIdx, { difficulty: Number(e.target.value) })}
                      className="text-[11px] border border-border rounded px-1.5 py-0.5 bg-background">
                      {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>Difficulty {d}</option>)}
                    </select>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => setQuestions(qs => qs.filter((_, i) => i !== qIdx))} className="text-red-500 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <input value={q.question} onChange={e => updateQuestion(qIdx, { question: e.target.value })} placeholder="Question text"
                  className="w-full px-2.5 py-1.5 text-[13px] rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-1.5">
                      <input type="radio" name={`correct-${q.id}`} checked={q.correct_index === oIdx}
                        onChange={() => updateQuestion(qIdx, { correct_index: oIdx })} />
                      <input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${["A", "B", "C", "D"][oIdx]}`}
                        className="flex-1 px-2 py-1 text-[12.5px] rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
                    </div>
                  ))}
                </div>
                <input value={q.explanation} onChange={e => updateQuestion(qIdx, { explanation: e.target.value })} placeholder="Explanation shown after answering"
                  className="w-full px-2.5 py-1.5 text-[12px] rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
            ))}
          </div>
        </div>

        <button onClick={submit} disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-[13px] font-medium hover:opacity-95 disabled:opacity-60 transition">
          {submitting ? "Creating…" : "Create Draft"}
        </button>
      </div>
    </Card>
  );
}

function TrainingAuthoringPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch("/api/training/admin/modules")
      .then((all: ModuleRow[]) => setModules(user ? all.filter(m => m.created_by === user.id) : all))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load modules"))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submitForReview = async (id: string) => {
    try {
      await apiFetch(`/api/training/${id}/submit-review`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Submitted for review");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-foreground">My Training Modules</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Author training content and MCQ assessments for review.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-[12.5px] font-medium hover:opacity-95 transition">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "New Module"}
        </button>
      </div>

      {showForm && <NewModuleForm onCreated={() => { setShowForm(false); load(); }} />}

      <Card title="My Modules" padded={false}>
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
              <th className="px-5 py-2.5">Questions</th><th className="px-5 py-2.5">Status</th>
              <th className="px-5 py-2.5">Notes</th><th className="px-5 py-2.5"></th>
            </tr></thead>
            <tbody>
              {modules.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center">
                  <GraduationCap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No modules yet — create your first one above.</p>
                </td></tr>
              )}
              {modules.map(m => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px]">{m.code}</td>
                  <td className="px-5 py-3 font-medium">{m.title}</td>
                  <td className="px-5 py-3">{m.assessment?.length ?? 0}</td>
                  <td className="px-5 py-3"><StatusChip tone={STATUS_TONE[m.status] ?? "muted"} label={m.status.replace(/_/g, " ")} dot /></td>
                  <td className="px-5 py-3 text-muted-foreground text-[12px]">{m.review_notes ?? "—"}</td>
                  <td className="px-5 py-3">
                    {(m.status === "draft" || m.status === "rejected") && (
                      <button onClick={() => submitForReview(m.id)}
                        className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
                        <Send className="h-3 w-3" /> Submit for review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
