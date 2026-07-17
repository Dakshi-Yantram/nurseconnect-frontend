import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Trophy,
  X,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: number;
  type: string;
}

interface TrainingModule {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  is_mandatory: boolean;
  assessment: Question[];
  pass_percent: number;
  completed?: boolean;
  passed?: boolean;
}

interface AdaptiveState {
  questions: Question[];
  asked: Question[];
  answers: { id: string; answer: number }[];
  currentQ: Question | null;
  currentDifficulty: number;
  phase: "question" | "feedback" | "result";
  lastCorrect: boolean | null;
  score: number;
  totalAnswered: number;
}

const MAX_QUESTIONS = 8;
const START_DIFFICULTY = 2;

function pickNext(pool: Question[], asked: Question[], targetDifficulty: number): Question | null {
  const askedIds = new Set(asked.map(q => q.id));
  const available = pool.filter(q => !askedIds.has(q.id));
  if (available.length === 0) return null;
  const exact = available.filter(q => q.difficulty === targetDifficulty);
  if (exact.length > 0) return exact[Math.floor(Math.random() * exact.length)];
  available.sort((a, b) => Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty));
  return available[0];
}

function AdaptiveMCQModal({
  module,
  onClose,
  onComplete,
}: {
  module: TrainingModule;
  onClose: () => void;
  onComplete: (passed: boolean) => void;
}) {
  const [state, setState] = useState<AdaptiveState>(() => {
    const first = pickNext(module.assessment, [], START_DIFFICULTY);
    return {
      questions: module.assessment,
      asked: first ? [first] : [],
      answers: [],
      currentQ: first,
      currentDifficulty: START_DIFFICULTY,
      phase: "question",
      lastCorrect: null,
      score: 0,
      totalAnswered: 0,
    };
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAnswer = useCallback(() => {
    if (selected === null || !state.currentQ) return;
    const correct = selected === state.currentQ.correct_index;
    const newScore = state.score + (correct ? 1 : 0);
    const newAnswers = [...state.answers, { id: state.currentQ.id, answer: selected }];
    const newTotal = state.totalAnswered + 1;

    setState(s => ({
      ...s,
      answers: newAnswers,
      score: newScore,
      totalAnswered: newTotal,
      phase: "feedback",
      lastCorrect: correct,
      currentDifficulty:
        newTotal >= MAX_QUESTIONS || newAnswers.length >= s.questions.length
          ? s.currentDifficulty
          : correct
          ? Math.min(5, s.currentDifficulty + 1)
          : Math.max(1, s.currentDifficulty - 1),
    }));
  }, [selected, state]);

  const handleNext = useCallback(() => {
    const isDone = state.totalAnswered >= MAX_QUESTIONS || state.answers.length >= state.questions.length;
    if (isDone) {
      setState(s => ({ ...s, phase: "result" }));
      return;
    }
    const nextQ = pickNext(state.questions, state.asked, state.currentDifficulty);
    if (!nextQ) {
      setState(s => ({ ...s, phase: "result" }));
      return;
    }
    setState(s => ({ ...s, asked: [...s.asked, nextQ], currentQ: nextQ, phase: "question", lastCorrect: null }));
    setSelected(null);
  }, [state]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    const pct = state.totalAnswered > 0 ? Math.round((state.score / state.totalAnswered) * 100) : 0;
    const passed = pct >= module.pass_percent;
    try {
      await apiFetch(`/api/training/modules/${module.id}/assessment/submit`, {
        method: "POST",
        body: JSON.stringify(state.answers),
      });
    } catch {
      // still report the local result even if the network call fails
    } finally {
      setSubmitting(false);
      onComplete(passed);
    }
  }, [state, module, onComplete]);

  const pct = state.totalAnswered > 0 ? Math.round((state.score / state.totalAnswered) * 100) : 0;
  const passed = pct >= module.pass_percent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
            <span className="text-[14px] font-semibold text-foreground truncate max-w-[280px]">{module.title}</span>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {state.phase !== "result" && (
          <div className="px-6 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">
                Question {state.totalAnswered + (state.phase === "question" ? 1 : 0)} of {MAX_QUESTIONS}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Difficulty: {"★".repeat(state.currentDifficulty)}{"☆".repeat(5 - state.currentDifficulty)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${(state.totalAnswered / MAX_QUESTIONS) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="px-6 py-5">
          {state.phase === "question" && state.currentQ && (
            <div className="space-y-4">
              <p className="text-[14.5px] font-medium text-foreground leading-relaxed">{state.currentQ.question}</p>
              <div className="space-y-2">
                {state.currentQ.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    className={cn(
                      "w-full text-left rounded-xl border px-4 py-3 text-[13px] transition-all",
                      selected === i
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800 font-medium"
                        : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50"
                    )}
                  >
                    <span className="font-mono text-[11px] mr-2 opacity-60">{["A", "B", "C", "D"][i]}.</span>
                    {opt}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={selected === null}
                onClick={handleAnswer}
                className="w-full mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[13px] font-semibold py-3 transition-all"
              >
                Submit Answer
              </button>
            </div>
          )}

          {state.phase === "feedback" && state.currentQ && (
            <div className="space-y-4">
              <div className={cn("flex items-start gap-3 rounded-xl p-4", state.lastCorrect ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")}>
                {state.lastCorrect ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                <div>
                  <p className={cn("text-[13px] font-semibold", state.lastCorrect ? "text-emerald-700" : "text-red-700")}>
                    {state.lastCorrect ? "Correct!" : `Incorrect — answer: ${["A", "B", "C", "D"][state.currentQ.correct_index]}`}
                  </p>
                  {state.currentQ.explanation && (
                    <p className="text-[12px] mt-1 text-foreground leading-relaxed">{state.currentQ.explanation}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold py-3 flex items-center justify-center gap-2 transition-all"
              >
                {state.totalAnswered >= MAX_QUESTIONS || state.answers.length >= state.questions.length ? "See Results" : "Next Question"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {state.phase === "result" && (
            <div className="space-y-5 text-center">
              <div className={cn("inline-flex h-16 w-16 items-center justify-center rounded-full mx-auto", passed ? "bg-emerald-100" : "bg-red-100")}>
                {passed ? <Trophy className="h-8 w-8 text-emerald-500" /> : <RefreshCw className="h-8 w-8 text-red-500" />}
              </div>
              <div>
                <p className="text-[22px] font-bold text-foreground">{pct}%</p>
                <p className={cn("text-[14px] font-semibold mt-0.5", passed ? "text-emerald-600" : "text-red-600")}>
                  {passed ? "Assessment Passed!" : "Not quite — try again"}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {state.score} of {state.totalAnswered} correct · pass mark {module.pass_percent}%
                </p>
              </div>
              {passed && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[12.5px] text-emerald-700 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Completing this module may unlock higher-tier assignments at better rates.
                </div>
              )}
              <div className="flex gap-3">
                {!passed && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = pickNext(module.assessment, [], START_DIFFICULTY);
                      setState({
                        questions: module.assessment,
                        asked: first ? [first] : [],
                        answers: [],
                        currentQ: first,
                        currentDifficulty: START_DIFFICULTY,
                        phase: "question",
                        lastCorrect: null,
                        score: 0,
                        totalAnswered: 0,
                      });
                      setSelected(null);
                    }}
                    className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[13px] font-medium py-3 transition-all"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={cn(
                    "rounded-xl text-white text-[13px] font-semibold py-3 transition-all",
                    passed ? "flex-1 bg-emerald-600 hover:bg-emerald-700" : "flex-1 bg-indigo-600 hover:bg-indigo-700",
                    submitting && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {submitting ? "Saving…" : passed ? "Claim Certificate" : "Submit & Close"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

function WorkerTrainingError({ error: _error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 p-5 text-[13px]">
      <div className="font-semibold">Training surface didn't load</div>
      <div className="text-[12px] mt-0.5 text-amber-700">Could not fetch training modules.</div>
      <button
        type="button"
        onClick={() => { router.invalidate(); reset(); }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-amber-100 transition-colors"
      >
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}

export const Route = createFileRoute("/_app/partner/training")({
  component: WorkerTraining,
  head: () => ({ meta: [{ title: "Training — NurseConnect" }] }),
  errorComponent: WorkerTrainingError,
});

function ModuleCard({ module, onStart }: { module: TrainingModule; onStart: () => void }) {
  const hasAssessment = (module.assessment?.length ?? 0) > 0;
  const status = module.completed ? (module.passed ? "passed" : "failed") : "pending";

  const statusMap = {
    passed: { label: "Passed", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    failed: { label: "Failed — Retry", dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    pending: { label: "Not Started", dot: "bg-orange-400", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  }[status];

  return (
    <div className="group bg-white rounded-[20px] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)]"
      style={{ border: "1px solid #EAEAEA", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="h-[38px] w-[38px] rounded-[10px] bg-indigo-50 flex items-center justify-center shrink-0">
            <GraduationCap className="h-[18px] w-[18px] text-indigo-500" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-medium text-foreground leading-snug">{module.title}</span>
              {module.is_mandatory && (
                <span className="text-[10px] font-medium tracking-wide px-[7px] py-[2px] rounded-full bg-amber-100 text-amber-800 border border-amber-200">Required</span>
              )}
            </div>
            {module.category && <span className="text-[11px] text-muted-foreground">{module.category}</span>}
          </div>
        </div>

        {module.description && <p className="text-[12px] text-muted-foreground leading-[1.55] mb-2.5 line-clamp-2">{module.description}</p>}

        <div className="flex items-center justify-between gap-2 flex-wrap pb-3.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Clock className="h-[13px] w-[13px]" />{module.duration_minutes} min
            </span>
            {hasAssessment && (
              <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <BookOpen className="h-[13px] w-[13px]" />{module.assessment.length} questions
              </span>
            )}
          </div>
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-[3px] rounded-full border", statusMap.bg, statusMap.text, statusMap.border)}>
            <span className={cn("h-[6px] w-[6px] rounded-full shrink-0", statusMap.dot)} />
            {statusMap.label}
          </span>
        </div>
      </div>

      {hasAssessment && status !== "passed" && (
        <>
          <div className="h-px bg-gray-100 mx-4" />
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={onStart}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[13px] font-medium py-2.5 flex items-center justify-center gap-1.5 transition-all duration-150"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {status === "failed" ? "Retake Assessment" : "Start Assessment"}
            </button>
          </div>
        </>
      )}
      {status === "passed" && (
        <>
          <div className="h-px bg-gray-100 mx-4" />
          <div className="px-4 py-3">
            <div className="flex items-center justify-center gap-1.5 text-[12.5px] text-emerald-600 font-medium py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Assessment passed — bookings unlocked
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EligibilitySection({ modules }: { modules: TrainingModule[] }) {
  const mandatory = modules.filter(m => m.is_mandatory);
  const passedMandatory = mandatory.filter(m => m.passed);
  const total = mandatory.length;
  const approved = passedMandatory.length;
  const pct = total > 0 ? Math.round((approved / total) * 100) : 100;
  const eligible = total === 0 || approved === total;

  return (
    <div className={cn("rounded-2xl border p-5", eligible ? "bg-emerald-50 border-emerald-200" : "bg-white border-border")} style={{ boxShadow: "0 1px 8px 0 rgba(0,0,0,0.05)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-8 w-8 rounded-xl grid place-items-center", eligible ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-500")}>
            {eligible ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground leading-tight">{eligible ? "Fully Eligible" : "Eligibility Incomplete"}</div>
            <div className="text-[11.5px] text-muted-foreground">Mandatory modules</div>
          </div>
        </div>
        <div className={cn("text-[22px] font-bold tabular-nums", eligible ? "text-emerald-600" : "text-orange-500")}>{pct}%</div>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden mb-2">
        <div className={cn("h-full rounded-full transition-all duration-500", eligible ? "bg-emerald-500" : "bg-orange-400")} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11.5px] text-muted-foreground mb-2">{approved} of {total} required assessments passed</div>
      {eligible && (
        <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 font-medium mt-1">
          <Sparkles className="h-3.5 w-3.5" />
          You can claim assignments on the marketplace
        </div>
      )}
    </div>
  );
}

function WorkerTraining() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<TrainingModule | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "passed">("all");

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const list: TrainingModule[] = await apiFetch("/api/training/modules");
      const full = await Promise.all(
        list.map(async m => {
          try {
            const detail = await apiFetch(`/api/training/modules/${m.id}`);
            return { ...m, ...detail };
          } catch {
            return m;
          }
        })
      );
      setModules(full);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to load training");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const handleComplete = (moduleId: string, passed: boolean) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, completed: true, passed } : m));
    setActiveModule(null);
  };

  const filtered = modules.filter(m => {
    if (activeFilter === "pending") return !m.completed || !m.passed;
    if (activeFilter === "passed") return m.completed && m.passed;
    return true;
  });

  const passedCount = modules.filter(m => m.passed).length;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-foreground tracking-tight">Training &amp; Certifications</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {modules.length} module{modules.length !== 1 ? "s" : ""} assigned ·{" "}
            <span className="text-emerald-600 font-medium">{passedCount} passed</span>
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 grid place-items-center shrink-0">
          <GraduationCap className="h-5 w-5 text-indigo-500" />
        </div>
      </div>

      {!loading && !fetchError && <EligibilitySection modules={modules} />}

      {loading && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
          <p className="text-[13px] text-muted-foreground">Loading training modules…</p>
        </div>
      )}

      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
          <div className="font-semibold mb-1">Could not load training modules</div>
          <div className="text-[12px] text-red-600 mb-3">{fetchError}</div>
          <button type="button" onClick={fetchModules} className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-red-100 transition-colors">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {!loading && !fetchError && (
        <div className="space-y-3">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["all", "pending", "passed"] as const).map(f => (
              <button key={f} type="button" onClick={() => setActiveFilter(f)}
                className={cn("flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-150 capitalize", activeFilter === f ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {f === "all" ? "All" : f === "pending" ? "Pending" : "Passed"}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white flex flex-col items-center justify-center py-14 px-6 text-center" style={{ boxShadow: "0 1px 6px 0 rgba(0,0,0,0.05)" }}>
              <div className="h-14 w-14 rounded-2xl bg-gray-100 grid place-items-center mb-4">
                <GraduationCap className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-[14px] font-semibold text-foreground">
                {activeFilter === "all" ? "No modules assigned" : `No ${activeFilter} modules`}
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[240px]">
                {activeFilter === "all" ? "Training modules will appear here once assigned." : "Try a different filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(m => <ModuleCard key={m.id} module={m} onStart={() => setActiveModule(m)} />)}
            </div>
          )}
        </div>
      )}

      {activeModule && (
        <AdaptiveMCQModal
          module={activeModule}
          onClose={() => setActiveModule(null)}
          onComplete={(passed) => handleComplete(activeModule.id, passed)}
        />
      )}
    </div>
  );
}
