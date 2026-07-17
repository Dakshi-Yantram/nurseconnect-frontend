import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RefreshCw, Send, X, UserCheck, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/support-tickets")({
  component: SupportTicketsPage,
  head: () => ({ meta: [{ title: "Ticket Queue — NurseConnect" }] }),
});

interface TicketRow {
  id: string; ticket_ref: string; raiser_name: string | null; raiser_role: string;
  category: string; subject: string; description: string; status: string;
  assigned_to: string | null; created_at: string;
}
interface TicketMessage {
  id: string; sender_id: string; sender_name: string; sender_role: string; message: string; created_at: string;
}
interface TicketDetail extends TicketRow {
  messages: TicketMessage[];
  resolution_notes: string | null;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "muted",
};

function TicketDetailModal({ ticketId, onClose, onChanged }: { ticketId: string; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/tickets/${ticketId}`)
      .then(setTicket)
      .catch(() => toast.error("Failed to load ticket"))
      .finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const claim = async () => {
    try {
      await apiFetch(`/api/support/tickets/${ticketId}/claim`, { method: "POST" });
      toast.success("Ticket claimed");
      load(); onChanged();
    } catch {
      toast.error("Failed to claim");
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ message: reply.trim() }) });
      setReply("");
      load();
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: string) => {
    try {
      await apiFetch(`/api/support/tickets/${ticketId}/status`, {
        method: "POST",
        body: JSON.stringify({ status, resolution_notes: resolutionNotes.trim() || undefined }),
      });
      toast.success(`Ticket marked ${status.replace(/_/g, " ")}`);
      load(); onChanged();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="text-[15px] font-semibold text-foreground">{ticket?.subject ?? "Loading…"}</p>
            {ticket && <p className="text-[11px] font-mono text-muted-foreground">{ticket.ticket_ref}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {loading || !ticket ? (
          <div className="px-6 py-10 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-[12.5px]">
              <div><span className="text-muted-foreground">Raised by</span><div className="font-medium">{ticket.raiser_name} ({ticket.raiser_role})</div></div>
              <div><span className="text-muted-foreground">Category</span><div className="font-medium capitalize">{ticket.category.replace(/_/g, " ")}</div></div>
              <div><span className="text-muted-foreground">Status</span><div><StatusChip tone={STATUS_TONE[ticket.status] ?? "muted"} label={ticket.status.replace(/_/g, " ")} dot /></div></div>
            </div>
            <p className="text-[13px] text-foreground bg-muted/40 rounded-lg p-3">{ticket.description}</p>

            {!ticket.assigned_to && (
              <button onClick={claim} className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline">
                <UserCheck className="h-3.5 w-3.5" /> Claim this ticket
              </button>
            )}

            <div className="space-y-2">
              <p className="text-[12.5px] font-semibold text-foreground">Conversation</p>
              {ticket.messages.length === 0 && <p className="text-[12px] text-muted-foreground">No replies yet.</p>}
              {ticket.messages.map(m => (
                <div key={m.id} className={cn("rounded-lg p-2.5 text-[12.5px]", m.sender_id === user?.id ? "bg-primary/10 ml-6" : "bg-muted/40 mr-6")}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium">{m.sender_name}</span>
                    <span className="text-[10.5px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  {m.message}
                </div>
              ))}
            </div>

            {ticket.status !== "closed" && (
              <div className="flex gap-2">
                <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply…"
                  onKeyDown={e => e.key === "Enter" && sendReply()}
                  className="flex-1 px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
                <button onClick={sendReply} disabled={sending || !reply.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-[12.5px] font-medium hover:opacity-95 disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {ticket.status !== "resolved" && ticket.status !== "closed" && (
              <div className="pt-3 border-t border-border space-y-2">
                <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={2} placeholder="Resolution notes (optional)"
                  className="w-full px-3 py-2 text-[12.5px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40" />
                <div className="flex gap-2">
                  <button onClick={() => setStatus("in_progress")} className="flex-1 rounded-md border border-border text-[12.5px] font-medium py-2 hover:bg-muted/40">Mark In Progress</button>
                  <button onClick={() => setStatus("resolved")} className="flex-1 rounded-md bg-emerald-600 text-white text-[12.5px] font-medium py-2 hover:bg-emerald-700">Mark Resolved</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SupportTicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/support/tickets${filter ? `?status=${filter}` : ""}`)
      .then(setTickets)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load tickets"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LifeBuoy size={18} />
        </span>
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Support Ticket Queue</h1>
          <p className="text-[12.5px] text-muted-foreground">Tickets raised by consumers and nurses through the Help Center</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ v: "", l: "All" }, { v: "open", l: "Open" }, { v: "in_progress", l: "In Progress" }, { v: "resolved", l: "Resolved" }].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all", filter === f.v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground")}>
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
        {!loading && !error && (
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5">Ticket</th><th className="px-5 py-2.5">Subject</th>
              <th className="px-5 py-2.5">Raised by</th><th className="px-5 py-2.5">Category</th>
              <th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5">Created</th>
            </tr></thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No tickets{filter ? ` with status "${filter}"` : ""}.</td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id} onClick={() => setActiveId(t.id)} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                  <td className="px-5 py-3 font-mono text-[12px]">{t.ticket_ref}</td>
                  <td className="px-5 py-3 font-medium">{t.subject}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.raiser_name} ({t.raiser_role})</td>
                  <td className="px-5 py-3 capitalize">{t.category.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3"><StatusChip tone={STATUS_TONE[t.status] ?? "muted"} label={t.status.replace(/_/g, " ")} dot /></td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {activeId && (
        <TicketDetailModal ticketId={activeId} onClose={() => setActiveId(null)} onChanged={load} />
      )}
    </div>
  );
}
