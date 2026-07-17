import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { apiFetch } from "@/lib/api";
import { ChevronRight, LifeBuoy, RefreshCw, Send } from "lucide-react";

export const Route = createFileRoute("/_app/partner/help")({
  component: PartnerHelpPage,
  head: () => ({ meta: [{ title: "Help & Support — NurseConnect" }] }),
});

interface FaqRow { id: string; category: string | null; question: string; answer: string }
interface TicketRow {
  id: string; ticket_ref: string; category: string; subject: string; status: string;
  created_at: string; resolution_notes: string | null;
}

const TICKET_STATUS_TONE: Record<string, string> = {
  open: "text-amber-600 bg-amber-50",
  in_progress: "text-sky-600 bg-sky-50",
  resolved: "text-emerald-600 bg-emerald-50",
  closed: "text-muted-foreground bg-muted",
};

const TICKET_CATEGORIES = [
  { value: "booking", label: "Assignment issue" },
  { value: "billing", label: "Payout / Earnings" },
  { value: "clinical", label: "Clinical concern" },
  { value: "technical", label: "App / Technical" },
  { value: "other", label: "Other" },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-[13px] font-medium text-left hover:bg-muted/40 transition-colors">
        {question}
        <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-4 pb-3.5 text-[12px] text-muted-foreground leading-relaxed">{answer}</div>}
    </div>
  );
}

function RaiseTicketForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [category, setCategory] = useState("booking");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError("Subject and description are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify({ category, subject: subject.trim(), description: description.trim() }),
      });
      setSubject(""); setDescription("");
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Raise a Ticket">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
            {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        {error && <p className="text-[12px] text-rose-600">{error}</p>}
        <button disabled={submitting} type="submit"
          className="w-full py-2.5 rounded-lg bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
          <Send className="h-3.5 w-3.5" />
          {submitting ? "Submitting…" : "Submit Ticket"}
        </button>
      </form>
    </Card>
  );
}

function PartnerHelpPage() {
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch("/api/faqs"),
      apiFetch("/api/tickets/mine"),
    ])
      .then(([f, t]) => { setFaqs(f); setTickets(t); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load help center"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[13px] text-muted-foreground">Loading…</div>;
  if (error) return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[13px] text-red-600">
      {error}
      <button onClick={load} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LifeBuoy size={18} />
        </span>
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Help & Support</h1>
          <p className="text-[12.5px] text-muted-foreground">FAQs and support tickets for care professionals</p>
        </div>
      </div>

      <Card title="Frequently Asked Questions" padded={false}>
        {faqs.length === 0 && <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">No FAQs published yet.</div>}
        {faqs.map(f => <FAQItem key={f.id} question={f.question} answer={f.answer} />)}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">My Tickets</h2>
        <button onClick={() => setShowForm(v => !v)} className="text-[12.5px] text-primary font-medium hover:underline">
          {showForm ? "Cancel" : "Raise a Ticket"}
        </button>
      </div>

      {showForm && <RaiseTicketForm onSubmitted={() => { setShowForm(false); load(); }} />}

      <Card padded={false}>
        {tickets.length === 0 && <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">No tickets raised yet.</div>}
        {tickets.map(t => (
          <div key={t.id} className="px-4 py-3.5 border-b border-border last:border-0">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium">{t.subject}</span>
              <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${TICKET_STATUS_TONE[t.status] ?? ""}`}>
                {t.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {t.ticket_ref} · {t.category} · {new Date(t.created_at).toLocaleDateString()}
            </div>
            {t.resolution_notes && (
              <div className="text-[11.5px] text-muted-foreground mt-1.5 italic">"{t.resolution_notes}"</div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
