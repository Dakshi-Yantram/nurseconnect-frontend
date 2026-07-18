import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck, Clock, RefreshCw, Lock, CheckCircle2, XCircle,
  X, ShieldAlert, Timer,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/partner/assessments")({
  component: PartnerAssessments,
  head: () => ({ meta: [{ title: "Assessments — NurseConnect" }] }),
});

interface AssessmentRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  pass_score: number;
  attempted: boolean;
  latest_score: number | null;
  latest_passed: boolean | null;
  attempts_used: number;
  can_start: boolean;
  locked_reason: string | null;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  cooldown_hours: number;
  questions_per_attempt: number;
}

interface SessionQuestion {
  question_number: number;
  total_questions: number;
  question_id: string;
  type: string;
  text: string;
  options: string[];
  difficulty?: number;
}

// ─── Secure session-based exam modal ───────────────────────────────────────

function AssessmentSessionModal({
  assessment, onClose, onDone,
}: { assessment: AssessmentRow; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<SessionQuestion | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; pass_score: number } | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/training/assessments/${assessment.id}/start`, { method: "POST" });
      setSessionId(res.session_id);
      setQuestion(res.question);
      setExpiresAt(res.expires_at);
      setSelected(null);
      setLastCorrect(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start assessment");
    } finally {
      setLoading(false);
    }
  }, [assessment.id]);

  useEffect(() => { start(); }, [start]);

  useEffect(() => {
    if (!expiresAt) { setRemainingSec(null); return; }
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSec(diff);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [expiresAt]);

  const submitAnswer = async () => {
    if (selected === null || !sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/training/assessments/${assessment.id}/sessions/${sessionId}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer: selected }),
      });
      setLastCorrect(res.correct);
      if (res.finished) {
        setResult({ score: res.score, passed: res.passed, pass_score: res.pass_score });
        setQuestion(null);
      } else {
        // Brief pause so the correct/incorrect flash is visible before advancing.
        setTimeout(() => {
          setQuestion(res.question);
          setSelected(null);
          setLastCorrect(null);
        }, 700);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  const timeStr = remainingSec != null
    ? `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="h-5 w-5 text-indigo-500 shrink-0" />
            <span className="text-[14px] font-semibold text-foreground truncate">{assessment.title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {timeStr && (
              <span className={cn("inline-flex items-center gap-1 text-[12px] font-mono font-semibold", remainingSec !== null && remainingSec < 60 ? "text-red-600" : "text-muted-foreground")}>
                <Timer className="h-3.5 w-3.5" /> {timeStr}
              </span>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="px-6 py-5">
          {loading && <div className="py-10 text-center text-[13px] text-muted-foreground">Starting secure session…</div>}

          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</div>
          )}

          {!loading && !error && question && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Question {question.question_number} of {question.total_questions}</span>
                <span className="text-[10.5px] text-muted-foreground">No going back once submitted</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${((question.question_number - 1) / question.total_questions) * 100}%` }} />
              </div>

              <p className="text-[14.5px] font-medium text-foreground leading-relaxed">{question.text}</p>

              <div className="space-y-2">
                {question.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={submitting || lastCorrect !== null}
                    onClick={() => setSelected(i)}
                    className={cn(
                      "w-full text-left rounded-xl border px-4 py-3 text-[13px] transition-all disabled:cursor-default",
                      lastCorrect !== null && i === selected
                        ? lastCorrect ? "border-emerald-400 bg-emerald-50" : "border-red-400 bg-red-50"
                        : selected === i
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800 font-medium"
                        : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50"
                    )}
                  >
                    <span className="font-mono text-[11px] mr-2 opacity-60">{["A", "B", "C", "D", "E"][i]}.</span>
                    {opt}
                  </button>
                ))}
              </div>

              {lastCorrect !== null ? (
                <div className={cn("flex items-center gap-2 text-[13px] font-medium", lastCorrect ? "text-emerald-700" : "text-red-700")}>
                  {lastCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {lastCorrect ? "Correct" : "Incorrect"} — next question…
                </div>
              ) : (
                <button
                  onClick={submitAnswer}
                  disabled={selected === null || submitting}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[13px] font-semibold py-3 transition-all"
                >
                  {submitting ? "Submitting…" : "Submit Answer"}
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-5 text-center">
              <div className={cn("inline-flex h-16 w-16 items-center justify-center rounded-full mx-auto", result.passed ? "bg-emerald-100" : "bg-red-100")}>
                {result.passed ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <XCircle className="h-8 w-8 text-red-500" />}
              </div>
              <div>
                <p className="text-[22px] font-bold text-foreground">{result.score}%</p>
                <p className={cn("text-[14px] font-semibold mt-0.5", result.passed ? "text-emerald-600" : "text-red-600")}>
                  {result.passed ? "Assessment Passed!" : "Not this time"}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">Pass mark: {result.pass_score}%</p>
              </div>
              <button
                onClick={onDone}
                className="w-full rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold py-3 transition-all"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── List page ──────────────────────────────────────────────────────────────

function PartnerAssessments() {
  const [items, setItems] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AssessmentRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch("/api/training/assessments")
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load assessments"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-foreground">Assessments</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Theory assessments required to unlock certain care packages. Questions are timed, one at a time, and can't be revisited.
        </p>
      </div>

      {loading && <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>}
      {error && (
        <div className="py-16 text-center text-[13px] text-red-600">
          {error}
          <button onClick={load} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-border bg-white flex flex-col items-center justify-center py-14 px-6 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-[13.5px] font-semibold text-foreground">No assessments assigned yet</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(a => {
          const passed = a.latest_passed === true;
          return (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">{a.title}</p>
                  {a.description && <p className="text-[12px] text-muted-foreground mt-0.5">{a.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span>{a.questions_per_attempt} questions</span>
                    <span>Pass mark {a.pass_score}%</span>
                    {a.time_limit_minutes && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {a.time_limit_minutes} min</span>}
                    {a.max_attempts && <span>{a.attempts_used}/{a.max_attempts} attempts used</span>}
                  </div>
                </div>
                {passed && <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[11px] font-medium"><CheckCircle2 className="h-3 w-3" /> Passed</span>}
              </div>

              <div className="mt-3">
                {passed ? null : a.can_start ? (
                  <button
                    onClick={() => setActive(a)}
                    className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90"
                  >
                    {a.attempted ? "Retake Assessment" : "Start Assessment"}
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <Lock className="h-3.5 w-3.5" /> {a.locked_reason}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {active && (
        <AssessmentSessionModal
          assessment={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); load(); toast.success("Assessment result saved"); }}
        />
      )}
    </div>
  );
}
