import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Plus, Send, Trash2, X, RefreshCw, GraduationCap, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

// ─── Standalone anti-cheat assessments (Gate 2/3 "theory-verified") ───────────

interface AssessmentQuestion {
  id: string;
  type: "single_select";
  question: string;
  options: string[];
  correct_index: number;
}

interface AssessmentRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  pass_score: number;
  status: string;
  review_notes: string | null;
  questions: AssessmentQuestion[];
  time_limit_minutes: number | null;
  max_attempts: number | null;
  cooldown_hours: number;
  questions_per_attempt: number | null;
  created_by: string | null;
}

function emptyAssessmentQuestion(): AssessmentQuestion {
  return { id: `q${Date.now()}`, type: "single_select", question: "", options: ["", "", "", ""], correct_index: 0 };
}

function NewAssessmentForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passScore, setPassScore] = useState(70);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>("");
  const [maxAttempts, setMaxAttempts] = useState<string>("3");
  const [cooldownHours, setCooldownHours] = useState<string>("24");
  const [questionsPerAttempt, setQuestionsPerAttempt] = useState<string>("");
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([emptyAssessmentQuestion(), emptyAssessmentQuestion()]);
  const [submitting, setSubmitting] = useState(false);

  const updateQuestion = (idx: number, patch: Partial<AssessmentQuestion>) => {
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
      toast.error("Fill in the assessment code, title, and every question/option");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/training/assessments", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || null,
          pass_score: passScore,
          questions,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          max_attempts: maxAttempts ? Number(maxAttempts) : null,
          cooldown_hours: cooldownHours ? Number(cooldownHours) : 0,
          questions_per_attempt: questionsPerAttempt ? Number(questionsPerAttempt) : null,
          randomize_options: randomizeOptions,
        }),
      });
      toast.success("Assessment draft created");
      setCode(""); setTitle(""); setDescription("");
      setPassScore(70); setTimeLimitMinutes(""); setMaxAttempts("3"); setCooldownHours("24"); setQuestionsPerAttempt("");
      setQuestions([emptyAssessmentQuestion(), emptyAssessmentQuestion()]);
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create assessment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="New Theory Assessment">
      <div className="space-y-4">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-[11.5px] text-indigo-800 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          Anti-cheat: workers get one question at a time, options shuffled, no going back. Set a question-bank
          larger than "questions per attempt" so each attempt samples a different subset.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] font-medium text-foreground">Assessment code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="ASSESS-IV-THEORY"
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
        </div>
        <div>
          <label className="text-[12px] font-medium text-foreground">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] font-medium text-foreground">Pass %</label>
            <input type="number" value={passScore} onChange={e => setPassScore(Number(e.target.value))}
              className="mt-1 w-full px-2.5 py-1.5 text-[12.5px] rounded-md border border-border bg-background" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground">Questions/attempt</label>
            <input type="number" value={questionsPerAttempt} onChange={e => setQuestionsPerAttempt(e.target.value)} placeholder="all"
              className="mt-1 w-full px-2.5 py-1.5 text-[12.5px] rounded-md border border-border bg-background" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground">Time limit (min)</label>
            <input type="number" value={timeLimitMinutes} onChange={e => setTimeLimitMinutes(e.target.value)} placeholder="none"
              className="mt-1 w-full px-2.5 py-1.5 text-[12.5px] rounded-md border border-border bg-background" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground">Max attempts</label>
            <input type="number" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} placeholder="unlimited"
              className="mt-1 w-full px-2.5 py-1.5 text-[12.5px] rounded-md border border-border bg-background" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground">Cooldown (hrs)</label>
            <input type="number" value={cooldownHours} onChange={e => setCooldownHours(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 text-[12.5px] rounded-md border border-border bg-background" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={randomizeOptions} onChange={e => setRandomizeOptions(e.target.checked)} />
          Randomize option order per attempt
        </label>

        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-foreground">Question Bank ({questions.length})</p>
            <button type="button" onClick={() => setQuestions(qs => [...qs, emptyAssessmentQuestion()])}
              className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add question
            </button>
          </div>
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={q.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Question {qIdx + 1}</span>
                  {questions.length > 2 && (
                    <button type="button" onClick={() => setQuestions(qs => qs.filter((_, i) => i !== qIdx))} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <input value={q.question} onChange={e => updateQuestion(qIdx, { question: e.target.value })} placeholder="Question text"
                  className="w-full px-2.5 py-1.5 text-[13px] rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-1.5">
                      <input type="radio" name={`ac-correct-${q.id}`} checked={q.correct_index === oIdx}
                        onChange={() => updateQuestion(qIdx, { correct_index: oIdx })} />
                      <input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${["A", "B", "C", "D"][oIdx]}`}
                        className="flex-1 px-2 py-1 text-[12.5px] rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
                    </div>
                  ))}
                </div>
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

function AssessmentsSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch("/api/training/admin/assessments")
      .then((all: AssessmentRow[]) => setItems(user ? all.filter(a => a.created_by === user.id) : all))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load assessments"))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submitForReview = async (id: string) => {
    try {
      await apiFetch(`/api/assessments/${id}/submit-review`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Submitted for review");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Standalone theory assessments used to gate Gate 2/3 care packages, with anti-cheat mechanics.
        </p>
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-[12.5px] font-medium hover:opacity-95 transition shrink-0">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "New Assessment"}
        </button>
      </div>

      {showForm && <NewAssessmentForm onCreated={() => { setShowForm(false); load(); }} />}

      <Card title="My Assessments" padded={false}>
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
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center">
                  <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No assessments yet — create your first one above.</p>
                </td></tr>
              )}
              {items.map(a => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px]">{a.code}</td>
                  <td className="px-5 py-3 font-medium">{a.title}</td>
                  <td className="px-5 py-3">{a.questions?.length ?? 0}</td>
                  <td className="px-5 py-3"><StatusChip tone={STATUS_TONE[a.status] ?? "muted"} label={a.status.replace(/_/g, " ")} dot /></td>
                  <td className="px-5 py-3 text-muted-foreground text-[12px]">{a.review_notes ?? "—"}</td>
                  <td className="px-5 py-3">
                    {(a.status === "draft" || a.status === "rejected") && (
                      <button onClick={() => submitForReview(a.id)}
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

// ─── Practical sign-off (Gate 3) ───────────────────────────────────────────────

interface PracticalTarget {
  target_type: "service" | "package";
  target_id: string;
  name: string;
  checklist_items: string[];
}

interface WorkerSearchResult {
  worker_id: string;
  full_name: string | null;
  phone_e164: string | null;
  tier: string | null;
}

function PracticalSignoffSection() {
  const [targets, setTargets] = useState<PracticalTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<PracticalTarget | null>(null);

  const [workerQuery, setWorkerQuery] = useState("");
  const [workerResults, setWorkerResults] = useState<WorkerSearchResult[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [overallPassed, setOverallPassed] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch("/api/training/practical-targets")
      .then(setTargets)
      .catch(() => setTargets([]))
      .finally(() => setLoadingTargets(false));
  }, []);

  const searchWorkers = async () => {
    setSearching(true);
    try {
      const res = await apiFetch(`/api/training/workers/search?q=${encodeURIComponent(workerQuery)}`);
      setWorkerResults(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const selectTarget = (t: PracticalTarget) => {
    setSelectedTarget(t);
    setResponses(Object.fromEntries(t.checklist_items.map(item => [item, false])));
  };

  const submit = async () => {
    if (!selectedTarget || !selectedWorker) {
      toast.error("Select a worker and a Gate 3 service/package");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/training/practical-signoff", {
        method: "POST",
        body: JSON.stringify({
          worker_id: selectedWorker.worker_id,
          target_type: selectedTarget.target_type,
          target_id: selectedTarget.target_id,
          checklist_responses: responses,
          passed: overallPassed,
          notes: notes.trim() || null,
        }),
      });
      toast.success(`Sign-off recorded for ${selectedWorker.full_name}`);
      setSelectedTarget(null); setSelectedWorker(null); setResponses({}); setNotes(""); setOverallPassed(true);
      setWorkerQuery(""); setWorkerResults([]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to record sign-off");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11.5px] text-red-800 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        Gate 3 requires theory to already be passed — observe the worker performing the skill in person, then
        tick off every checklist item and sign. This unlocks the service once all other requirements are also met.
      </div>

      <Card title="1. Find the worker">
        <div className="flex gap-2">
          <input value={workerQuery} onChange={e => setWorkerQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") searchWorkers(); }}
            placeholder="Search by name or phone"
            className="flex-1 px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          <button onClick={searchWorkers} disabled={searching}
            className="rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-[12.5px] font-medium hover:opacity-95 disabled:opacity-60">
            {searching ? "…" : "Search"}
          </button>
        </div>
        {workerResults.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {workerResults.map(w => (
              <button key={w.worker_id} onClick={() => setSelectedWorker(w)}
                className={cn("w-full text-left rounded-md border px-3 py-2 text-[12.5px] transition",
                  selectedWorker?.worker_id === w.worker_id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
                <span className="font-medium">{w.full_name}</span>
                <span className="text-muted-foreground ml-2">{w.phone_e164} · {w.tier}</span>
              </button>
            ))}
          </div>
        )}
        {selectedWorker && (
          <p className="mt-2 text-[12px] text-emerald-700">Selected: {selectedWorker.full_name}</p>
        )}
      </Card>

      <Card title="2. Choose the Gate 3 service/package">
        {loadingTargets ? (
          <p className="text-[12.5px] text-muted-foreground">Loading…</p>
        ) : targets.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No Gate 3 services/packages configured yet — set one up from the admin Care Packages screen first.</p>
        ) : (
          <div className="space-y-1.5">
            {targets.map(t => (
              <button key={`${t.target_type}:${t.target_id}`} onClick={() => selectTarget(t)}
                className={cn("w-full text-left rounded-md border px-3 py-2 text-[12.5px] transition",
                  selectedTarget?.target_id === t.target_id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground ml-2 capitalize">{t.target_type}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedTarget && (
        <Card title="3. Checklist">
          {selectedTarget.checklist_items.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No checklist items authored for this service yet.</p>
          ) : (
            <div className="space-y-2">
              {selectedTarget.checklist_items.map(item => (
                <label key={item} className="flex items-center gap-2.5 text-[12.5px]">
                  <input type="checkbox" checked={responses[item] ?? false}
                    onChange={e => setResponses(prev => ({ ...prev, [item]: e.target.checked }))} />
                  {item}
                </label>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <label className="flex items-center gap-2.5 text-[13px] font-medium">
              <input type="checkbox" checked={overallPassed} onChange={e => setOverallPassed(e.target.checked)} />
              Worker demonstrated competency — pass
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)"
              className="w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
            <button onClick={submit} disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-[13px] font-medium hover:opacity-95 disabled:opacity-60 transition">
              {submitting ? "Saving…" : "Record Sign-off"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function TrainingAuthoringPage() {
  const [view, setView] = useState<"modules" | "assessments" | "signoff">("modules");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-foreground">Training &amp; Assessments</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Author training modules, gated theory assessments, and practical sign-offs.</p>
      </div>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["modules", "assessments", "signoff"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={cn("rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-all", view === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground")}>
            {v === "modules" ? "Training Modules" : v === "assessments" ? "Assessments" : "Practical Sign-off"}
          </button>
        ))}
      </div>
      {view === "modules" ? <TrainingModulesSection /> : view === "assessments" ? <AssessmentsSection /> : <PracticalSignoffSection />}
    </div>
  );
}

function TrainingModulesSection() {
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">Author training content and adaptive MCQ modules for review.</p>
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-[12.5px] font-medium hover:opacity-95 transition shrink-0">
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
