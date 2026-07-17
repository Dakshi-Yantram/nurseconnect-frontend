import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { HelpCircle, Plus, X, Trash2, Edit2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/operations/faq")({
  component: FaqManagementPage,
  head: () => ({ meta: [{ title: "FAQ Management — NurseConnect" }] }),
});

interface FaqRow {
  id: string;
  audience: string;
  category: string | null;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

const EMPTY_FORM = { audience: "consumer", category: "", question: "", answer: "", display_order: 0, is_active: true };

function FaqForm({ initial, onSaved, onCancel }: { initial: FaqRow | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState(initial ? {
    audience: initial.audience, category: initial.category ?? "", question: initial.question,
    answer: initial.answer, display_order: initial.display_order, is_active: initial.is_active,
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("Question and answer are required");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({ ...form, category: form.category.trim() || null });
      if (initial) {
        await apiFetch(`/api/operations/faqs/${initial.id}`, { method: "PUT", body });
      } else {
        await apiFetch("/api/operations/faqs", { method: "POST", body });
      }
      toast.success(initial ? "FAQ updated" : "FAQ created");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save FAQ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={initial ? "Edit FAQ" : "New FAQ"}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] font-medium text-foreground">Audience</label>
            <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40">
              <option value="consumer">Consumer</option>
              <option value="worker">Nurse / Worker</option>
              <option value="all">Both</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Category</label>
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Bookings"
              className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
        </div>
        <div>
          <label className="text-[12px] font-medium text-foreground">Question</label>
          <input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
            className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        </div>
        <div>
          <label className="text-[12px] font-medium text-foreground">Answer</label>
          <textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} rows={3}
            className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
        </div>
        <div className="flex items-center gap-4">
          <div>
            <label className="text-[12px] font-medium text-foreground">Display order</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))}
              className="mt-1.5 w-24 px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] mt-6">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-[12.5px] font-medium hover:opacity-95 disabled:opacity-60">
            {saving ? "Saving…" : initial ? "Save Changes" : "Create FAQ"}
          </button>
          <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-[12.5px] font-medium hover:bg-muted/40">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

function FaqManagementPage() {
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FaqRow | null | "new">(null);
  const [audienceFilter, setAudienceFilter] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch("/api/operations/faqs")
      .then(setFaqs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load FAQs"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    try {
      await apiFetch(`/api/operations/faqs/${id}`, { method: "DELETE" });
      toast.success("FAQ deleted");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const filtered = audienceFilter ? faqs.filter(f => f.audience === audienceFilter) : faqs;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-foreground">FAQ Management</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Manage help-center FAQs for consumers and nurses.</p>
        </div>
        {editing === null && (
          <button onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-[12.5px] font-medium hover:opacity-95 transition">
            <Plus className="h-3.5 w-3.5" /> New FAQ
          </button>
        )}
      </div>

      {editing !== null && (
        <FaqForm
          initial={editing === "new" ? null : editing}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ v: "", l: "All" }, { v: "consumer", l: "Consumer" }, { v: "worker", l: "Nurse" }, { v: "all", l: "Both" }].map(f => (
          <button key={f.v} onClick={() => setAudienceFilter(f.v)}
            className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all", audienceFilter === f.v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground")}>
            {f.l}
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
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gray-100 grid place-items-center mb-4">
              <HelpCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[13px] text-muted-foreground">No FAQs yet — create one above.</p>
          </div>
        )}
        {!loading && !error && filtered.map(f => (
          <div key={f.id} className="px-5 py-3.5 border-t border-border first:border-t-0 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-foreground">{f.question}</span>
                <StatusChip tone="info" label={f.audience} />
                {f.category && <StatusChip tone="muted" label={f.category} />}
                {!f.is_active && <StatusChip tone="warning" label="Inactive" />}
              </div>
              <p className="text-[12px] text-muted-foreground mt-1">{f.answer}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setEditing(f)} className="h-8 w-8 grid place-items-center rounded hover:bg-secondary">
                <Edit2 className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => remove(f.id)} className="h-8 w-8 grid place-items-center rounded hover:bg-secondary">
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
