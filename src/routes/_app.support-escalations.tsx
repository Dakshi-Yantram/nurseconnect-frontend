import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RefreshCw, X, UserCheck, AlertOctagon, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/support-escalations")({
  component: SupportEscalationsPage,
  head: () => ({ meta: [{ title: "All Escalations — NurseConnect" }] }),
});

interface EscalationRow {
  id: string;
  booking_id: string;
  worker_id: string;
  patient_id: string;
  level: string;
  status: string;
  trigger_type: string;
  trigger_details: Record<string, unknown> | null;
  notes: string | null;
  sla_minutes: number | null;
  sla_breach_at: string | null;
  auto_call_112: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  open: "danger",
  acknowledged: "warning",
  investigating: "info",
  resolved: "success",
};

const LEVEL_TONE: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  emergency: "danger",
  contact_doctor: "warning",
  info: "muted",
};

function isSlaBreached(row: EscalationRow) {
  if (!row.sla_breach_at || row.status === "resolved") return false;
  return new Date(row.sla_breach_at).getTime() < Date.now();
}

function EscalationDetailModal({
  escalation,
  onClose,
  onChanged,
}: {
  escalation: EscalationRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const claim = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/escalations/${escalation.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigned_to: user?.id }),
      });
      toast.success("Escalation assigned to you");
      onChanged();
    } catch {
      toast.error("Failed to assign");
    } finally {
      setBusy(false);
    }
  };

  const investigate = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/escalations/${escalation.id}/investigate`, { method: "POST" });
      toast.success("Marked as investigating");
      onChanged();
    } catch {
      toast.error("Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/escalations/${escalation.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution_notes: resolutionNotes.trim() || undefined }),
      });
      toast.success("Escalation resolved");
      onChanged();
      onClose();
    } catch {
      toast.error("Failed to resolve");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/escalations/${escalation.id}/note`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() }),
      });
      setNote("");
      toast.success("Note added");
      onChanged();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="text-[15px] font-semibold text-foreground capitalize">
              {escalation.level.replace(/_/g, " ")} escalation
            </p>
            <p className="text-[11px] font-mono text-muted-foreground">{escalation.id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[12.5px]">
            <div>
              <span className="text-muted-foreground">Status</span>
              <div><StatusChip tone={STATUS_TONE[escalation.status] ?? "muted"} label={escalation.status.replace(/_/g, " ")} dot /></div>
            </div>
            <div>
              <span className="text-muted-foreground">Trigger</span>
              <div className="font-medium capitalize">{escalation.trigger_type.replace(/_/g, " ")}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Booking</span>
              <div className="font-mono text-[11.5px]">{escalation.booking_id}</div>
            </div>
            <div>
              <span className="text-muted-foreground">SLA</span>
              <div className={cn("font-medium", isSlaBreached(escalation) && "text-red-600")}>
                {escalation.sla_breach_at ? new Date(escalation.sla_breach_at).toLocaleString() : "—"}
                {isSlaBreached(escalation) && " (breached)"}
              </div>
            </div>
          </div>

          {escalation.notes && (
            <p className="text-[13px] text-foreground bg-muted/40 rounded-lg p-3">{escalation.notes}</p>
          )}

          {!escalation.assigned_to && (
            <button
              onClick={claim}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline disabled:opacity-50"
            >
              <UserCheck className="h-3.5 w-3.5" /> Assign to me
            </button>
          )}

          {escalation.status !== "resolved" && (
            <div className="flex gap-2">
              {escalation.status !== "investigating" && (
                <button
                  onClick={investigate}
                  disabled={busy}
                  className="flex-1 rounded-md border border-border text-[12.5px] font-medium py-2 hover:bg-muted/40 disabled:opacity-50"
                >
                  Mark Investigating
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[12.5px] font-semibold text-foreground">Internal note</p>
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an internal note…"
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                className="flex-1 px-3 py-2 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                onClick={addNote}
                disabled={busy || !note.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-[12.5px] font-medium hover:opacity-95 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {escalation.status !== "resolved" && (
            <div className="pt-3 border-t border-border space-y-2">
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={2}
                placeholder="Resolution notes (optional)"
                className="w-full px-3 py-2 text-[12.5px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                onClick={resolve}
                disabled={busy}
                className="w-full rounded-md bg-emerald-600 text-white text-[12.5px] font-medium py-2 hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark Resolved
              </button>
            </div>
          )}

          {escalation.resolution_notes && (
            <div className="pt-3 border-t border-border">
              <p className="text-[12.5px] font-semibold text-foreground mb-1">Resolution notes</p>
              <p className="text-[12.5px] text-muted-foreground">{escalation.resolution_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupportEscalationsPage() {
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/escalations${filter ? `?status=${filter}` : ""}`)
      .then(setEscalations)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load escalations"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = escalations.filter((e) =>
    !search.trim() ||
    e.id.toLowerCase().includes(search.toLowerCase()) ||
    e.booking_id.toLowerCase().includes(search.toLowerCase()) ||
    e.trigger_type.toLowerCase().includes(search.toLowerCase())
  );

  const active = escalations.find((e) => e.id === activeId) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertOctagon size={18} />
          </span>
          <div>
            <h1 className="text-[18px] font-bold text-foreground">All Escalations</h1>
            <p className="text-[12.5px] text-muted-foreground">Clinical and safety escalations across every booking</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search escalation, booking id…"
            className="pl-8 pr-3 py-1.5 text-[12.5px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 w-64"
          />
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { v: "", l: "All" },
          { v: "open", l: "Open" },
          { v: "acknowledged", l: "Acknowledged" },
          { v: "investigating", l: "Investigating" },
          { v: "resolved", l: "Resolved" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all",
              filter === f.v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
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
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-left">
                <th className="px-5 py-2.5">Level</th>
                <th className="px-5 py-2.5">Trigger</th>
                <th className="px-5 py-2.5">Booking</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">SLA</th>
                <th className="px-5 py-2.5">Assigned</th>
                <th className="px-5 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    No escalations{filter ? ` with status "${filter}"` : ""}.
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setActiveId(e.id)}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <StatusChip tone={LEVEL_TONE[e.level] ?? "muted"} label={e.level.replace(/_/g, " ")} dot />
                  </td>
                  <td className="px-5 py-3 capitalize">{e.trigger_type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 font-mono text-[11.5px] text-muted-foreground">{e.booking_id.slice(0, 8)}…</td>
                  <td className="px-5 py-3">
                    <StatusChip tone={STATUS_TONE[e.status] ?? "muted"} label={e.status.replace(/_/g, " ")} dot />
                  </td>
                  <td className="px-5 py-3">
                    {isSlaBreached(e) ? (
                      <span className="text-red-600 font-medium">Breached</span>
                    ) : e.sla_breach_at ? (
                      new Date(e.sla_breach_at).toLocaleTimeString()
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{e.assigned_to ? "Assigned" : "Unassigned"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {active && (
        <EscalationDetailModal escalation={active} onClose={() => setActiveId(null)} onChanged={load} />
      )}
    </div>
  );
}