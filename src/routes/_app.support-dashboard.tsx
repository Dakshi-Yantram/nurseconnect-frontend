/**
 * _app.support-dashboard.tsx — Support Staff Ticket & Escalation Dashboard
 *
 * PATCH 6 — Web frontend
 *
 * SAVE TO:
 *   frontend/src/routes/_app.support-dashboard.tsx
 *
 * This is the primary workspace for admin_support role users.
 * It is also accessible by admin_ops, admin_clinical, and admin_super
 * (they see everything).
 *
 * SECTIONS:
 *   Header KPI row  — Open / SLA Breached / Unassigned / Emergency counts
 *   My Queue        — escalations assigned to the current user
 *   Unassigned      — unassigned open escalations (claim or assign)
 *   All Open        — full open queue with filters
 *   Resolve modal   — resolve with resolution notes
 *   Assign modal    — assign to support agent
 *   Note modal      — add internal note without status change
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Card, KpiCard } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Modal } from "@/components/shared/Modal";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  AlertOctagon, CheckCircle2, Clock, AlertTriangle,
  User, RefreshCw, MessageSquare, Loader2, ChevronDown,
  Inbox, ShieldAlert, Zap, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/support-dashboard")({
  component: SupportDashboard,
  head: () => ({ meta: [{ title: "Support Dashboard — NurseConnect" }] }),
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface Escalation {
  id: string;
  booking_id: string;
  level: "none" | "watch" | "inform_family" | "contact_doctor" | "emergency";
  status: "open" | "acknowledged" | "investigating" | "resolved" | "closed";
  trigger_type: string;
  notes: string | null;
  internal_notes: string | null;
  sla_minutes: number | null;
  sla_breach_at: string | null;
  auto_call_112: boolean;
  assigned_to: string | null;
  assigned_at: string | null;
  priority: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

interface Summary {
  total: number;
  open: number;
  acknowledged: number;
  investigating: number;
  resolved: number;
  emergency: number;
  contact_doctor: number;
  sla_breached: number;
  unassigned: number;
}

// ── API helpers ───────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function apiFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.message ?? err?.detail ?? `Error ${res.status}`);
  }
  return res.json();
}

// ── Level helpers ─────────────────────────────────────────────────────────────
function levelTone(level: string): "danger" | "warning" | "info" | "muted" {
  if (level === "emergency") return "danger";
  if (level === "contact_doctor") return "warning";
  if (level === "inform_family") return "info";
  return "muted";
}

function levelLabel(level: string) {
  return {
    emergency: "Emergency",
    contact_doctor: "Call Doctor",
    inform_family: "Notify Family",
    watch: "Watch",
    none: "None",
  }[level] ?? level;
}

function statusTone(status: string): "danger" | "warning" | "info" | "success" | "muted" {
  if (status === "open") return "danger";
  if (status === "acknowledged") return "warning";
  if (status === "investigating") return "info";
  if (status === "resolved") return "success";
  return "muted";
}

function slaLabel(breach_at: string | null): { label: string; urgent: boolean } {
  if (!breach_at) return { label: "No SLA", urgent: false };
  const diff = new Date(breach_at).getTime() - Date.now();
  if (diff < 0) return { label: "SLA BREACHED", urgent: true };
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return { label: `${mins}m left`, urgent: mins < 15 };
  return { label: `${Math.floor(mins / 60)}h ${mins % 60}m left`, urgent: false };
}

// ── Main page ─────────────────────────────────────────────────────────────────
function SupportDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [myQueue, setMyQueue] = useState<Escalation[]>([]);
  const [unassigned, setUnassigned] = useState<Escalation[]>([]);
  const [allOpen, setAllOpen] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"my" | "unassigned" | "all">("my");

  // Modal state
  const [selected, setSelected] = useState<Escalation | null>(null);
  const [modal, setModal] = useState<"resolve" | "assign" | "note" | "detail" | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [noteText, setNoteText] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, myRes, unRes, allRes] = await Promise.allSettled([
        apiFetch("/api/escalations/summary"),
        apiFetch("/api/escalations/assigned-to-me"),
        apiFetch("/api/escalations/unassigned"),
        apiFetch("/api/escalations/open"),
      ]);
      if (sumRes.status === "fulfilled") setSummary(sumRes.value);
      if (myRes.status === "fulfilled") setMyQueue(Array.isArray(myRes.value) ? myRes.value : []);
      if (unRes.status === "fulfilled") setUnassigned(Array.isArray(unRes.value) ? unRes.value : []);
      if (allRes.status === "fulfilled") setAllOpen(Array.isArray(allRes.value) ? allRes.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const open = (esc: Escalation, m: typeof modal) => {
    setSelected(esc);
    setModal(m);
    setResolveNotes("");
    setNoteText("");
    setAssigneeId("");
  };
  const close = () => { setModal(null); setSelected(null); };

  const handleAcknowledge = async (esc: Escalation) => {
    try {
      await apiFetch(`/api/escalations/${esc.id}/acknowledge`, { method: "POST" });
      toast.success("Ticket acknowledged");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleInvestigate = async (esc: Escalation) => {
    try {
      await apiFetch(`/api/escalations/${esc.id}/investigate`, {
        method: "POST",
        body: JSON.stringify({ internal_notes: "Agent picked up ticket" }),
      });
      toast.success("Status → Investigating");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleClaim = async (esc: Escalation) => {
    if (!user?.id) return;
    try {
      await apiFetch(`/api/escalations/${esc.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignee_id: user.id }),
      });
      toast.success("Ticket claimed — moved to My Queue");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const submitResolve = async () => {
    if (!selected || resolveNotes.trim().length < 10) return;
    setSaving(true);
    try {
      await apiFetch(`/api/escalations/${selected.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution_notes: resolveNotes }),
      });
      toast.success("Ticket resolved");
      close();
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitAssign = async () => {
    if (!selected || !assigneeId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/escalations/${selected.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignee_id: assigneeId }),
      });
      toast.success("Ticket assigned");
      close();
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async () => {
    if (!selected || noteText.trim().length < 3) return;
    setSaving(true);
    try {
      await apiFetch(`/api/escalations/${selected.id}/note`, {
        method: "POST",
        body: JSON.stringify({ note: noteText }),
      });
      toast.success("Note added");
      close();
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const displayList =
    tab === "my" ? myQueue :
    tab === "unassigned" ? unassigned :
    allOpen;

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold">Support Queue</div>
          <div className="text-[12.5px] text-muted-foreground">
            Escalations, ticket assignment, and resolution tracking.
          </div>
        </div>
        <button
          onClick={load}
          className="h-8 w-8 grid place-items-center rounded-md hover:bg-secondary border border-border"
          title="Refresh"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Open tickets" value={summary?.open ?? "—"} icon={Inbox} tone="warning" hint="Awaiting action" />
        <KpiCard label="SLA breached" value={summary?.sla_breached ?? "—"} icon={Zap} tone="primary" hint="Past deadline" />
        <KpiCard label="Unassigned" value={summary?.unassigned ?? "—"} icon={AlertTriangle} tone="warning" hint="No owner yet" />
        <KpiCard label="Emergency" value={summary?.emergency ?? "—"} icon={ShieldAlert} tone="primary" hint="Highest priority" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        {(["my", "unassigned", "all"] as const).map((t) => {
          const count = t === "my" ? myQueue.length : t === "unassigned" ? unassigned.length : allOpen.length;
          const label = t === "my" ? "My Queue" : t === "unassigned" ? "Unassigned" : "All Open";
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[12.5px] rounded-md font-medium transition flex items-center gap-1.5 ${
                tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  tab === t ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      <Card
        title={
          tab === "my" ? "My assigned tickets" :
          tab === "unassigned" ? "Unassigned — claim or assign" :
          "All open escalations"
        }
        padded={false}
      >
        {loading && (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
          </div>
        )}

        {!loading && displayList.length === 0 && (
          <div className="py-10">
            <EmptyState
              icon={CheckCircle2}
              title={tab === "my" ? "No tickets assigned to you" : tab === "unassigned" ? "All tickets are assigned" : "No open escalations"}
              description={tab === "my" ? "Pick up unassigned tickets from the Unassigned tab." : ""}
            />
          </div>
        )}

        {!loading && displayList.length > 0 && (
          <ul className="divide-y divide-border">
            {displayList.map((esc) => {
              const sla = slaLabel(esc.sla_breach_at);
              return (
                <li key={esc.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-muted/20 transition">

                  {/* Level indicator */}
                  <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${
                    esc.level === "emergency" ? "bg-rose-50 text-rose-600" :
                    esc.level === "contact_doctor" ? "bg-amber-50 text-amber-600" :
                    "bg-sky-50 text-sky-600"
                  }`}>
                    <AlertOctagon className="h-5 w-5" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11.5px] text-muted-foreground">#{esc.id.slice(0, 8)}</span>
                      <StatusChip tone={levelTone(esc.level)} label={levelLabel(esc.level)} dot />
                      <StatusChip tone={statusTone(esc.status)} label={esc.status} />
                      {sla.urgent && <StatusChip tone="danger" label={sla.label} />}
                      {!sla.urgent && sla.label !== "No SLA" && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {sla.label}
                        </span>
                      )}
                      {esc.auto_call_112 && <StatusChip tone="danger" label="112 Required" />}
                    </div>

                    <div className="text-[13px] font-medium">
                      {esc.notes ?? `${esc.trigger_type} escalation`}
                    </div>

                    <div className="text-[11.5px] text-muted-foreground flex flex-wrap gap-3">
                      <span>Booking: <span className="font-mono">{esc.booking_id.slice(0, 8)}</span></span>
                      <span>Raised: {new Date(esc.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      {esc.assigned_to ? (
                        <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> Assigned</span>
                      ) : (
                        <span className="text-amber-600">Unassigned</span>
                      )}
                    </div>

                    {esc.internal_notes && (
                      <div className="text-[11.5px] text-muted-foreground bg-muted/50 rounded px-2 py-1 line-clamp-2">
                        Note: {esc.internal_notes.split("\n").pop()}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Detail */}
                    <button
                      onClick={() => open(esc, "detail")}
                      className="px-3 py-1.5 text-[12px] rounded-md border border-border hover:bg-secondary"
                    >
                      View
                    </button>

                    {/* Claim (unassigned tab) */}
                    {tab === "unassigned" && (
                      <button
                        onClick={() => handleClaim(esc)}
                        className="px-3 py-1.5 text-[12px] rounded-md border border-primary/30 text-primary hover:bg-primary/5"
                      >
                        Claim
                      </button>
                    )}

                    {/* Acknowledge */}
                    {esc.status === "open" && (
                      <button
                        onClick={() => handleAcknowledge(esc)}
                        className="px-3 py-1.5 text-[12px] rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                        Acknowledge
                      </button>
                    )}

                    {/* Investigate */}
                    {esc.status === "acknowledged" && (
                      <button
                        onClick={() => handleInvestigate(esc)}
                        className="px-3 py-1.5 text-[12px] rounded-md border border-sky-200 text-sky-700 hover:bg-sky-50"
                      >
                        Investigating
                      </button>
                    )}

                    {/* Assign */}
                    <button
                      onClick={() => open(esc, "assign")}
                      className="px-3 py-1.5 text-[12px] rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1.5"
                    >
                      <User className="h-3.5 w-3.5" /> Assign
                    </button>

                    {/* Note */}
                    <button
                      onClick={() => open(esc, "note")}
                      className="px-3 py-1.5 text-[12px] rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1.5"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Note
                    </button>

                    {/* Resolve */}
                    {esc.status !== "resolved" && (
                      <button
                        onClick={() => open(esc, "resolve")}
                        className="px-3 py-1.5 text-[12px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {selected && (
        <Modal
          open={modal === "detail"}
          onClose={close}
          title={`Escalation · #${selected.id.slice(0, 8)}`}
          description={`${levelLabel(selected.level)} · ${selected.status}`}
          size="lg"
          footer={
            <button onClick={close} className="px-4 py-2 text-[13px] rounded-md border border-border">
              Close
            </button>
          }
        >
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Level" value={<StatusChip tone={levelTone(selected.level)} label={levelLabel(selected.level)} dot />} />
              <DetailRow label="Status" value={<StatusChip tone={statusTone(selected.status)} label={selected.status} />} />
              <DetailRow label="Trigger" value={selected.trigger_type} />
              <DetailRow label="Priority" value={selected.priority} />
              <DetailRow label="SLA" value={(() => { const s = slaLabel(selected.sla_breach_at); return <span className={s.urgent ? "text-rose-600 font-semibold" : ""}>{s.label}</span>; })()} />
              <DetailRow label="Auto 112" value={selected.auto_call_112 ? "Yes" : "No"} />
              <DetailRow label="Booking" value={<span className="font-mono">{selected.booking_id}</span>} />
              <DetailRow label="Raised" value={new Date(selected.created_at).toLocaleString("en-IN")} />
              {selected.acknowledged_at && <DetailRow label="Acknowledged" value={new Date(selected.acknowledged_at).toLocaleString("en-IN")} />}
              {selected.resolved_at && <DetailRow label="Resolved" value={new Date(selected.resolved_at).toLocaleString("en-IN")} />}
            </div>

            {selected.notes && (
              <div>
                <div className="text-[11.5px] text-muted-foreground font-medium mb-1">Nurse notes</div>
                <div className="bg-muted/50 rounded-lg p-3 text-[13px]">{selected.notes}</div>
              </div>
            )}

            {selected.internal_notes && (
              <div>
                <div className="text-[11.5px] text-muted-foreground font-medium mb-1">Internal notes</div>
                <div className="bg-muted/50 rounded-lg p-3 text-[13px] whitespace-pre-wrap font-mono text-[12px]">
                  {selected.internal_notes}
                </div>
              </div>
            )}

            {selected.resolution_notes && (
              <div>
                <div className="text-[11.5px] text-muted-foreground font-medium mb-1">Resolution notes</div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[13px]">
                  {selected.resolution_notes}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Resolve modal ─────────────────────────────────────────────────── */}
      <WorkflowModal
        open={modal === "resolve"}
        onClose={close}
        title="Resolve ticket"
        description="Provide resolution notes. This action closes the escalation."
        submitLabel={saving ? "Resolving…" : "Confirm resolution"}
        submitTone="success"
        onSubmit={submitResolve}
        disabled={resolveNotes.trim().length < 10 || saving}
      >
        <div className="space-y-3">
          {selected && (
            <div className="flex gap-2 flex-wrap">
              <StatusChip tone={levelTone(selected.level)} label={levelLabel(selected.level)} dot />
              <StatusChip tone={statusTone(selected.status)} label={selected.status} />
            </div>
          )}
          <FormField label="Resolution notes (min 10 characters)">
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              className={textareaCls}
              placeholder="Describe what action was taken and the outcome…"
              rows={4}
            />
          </FormField>
        </div>
      </WorkflowModal>

      {/* ── Assign modal ──────────────────────────────────────────────────── */}
      <WorkflowModal
        open={modal === "assign"}
        onClose={close}
        title="Assign ticket"
        description="Assign to a support agent. They will see it in their queue."
        submitLabel={saving ? "Assigning…" : "Assign"}
        submitTone="primary"
        onSubmit={submitAssign}
        disabled={!assigneeId || saving}
      >
        <div className="space-y-3 text-[13px]">
          <p className="text-muted-foreground text-[12.5px]">
            Enter the user ID of the support agent to assign this ticket to.
            In a future release this will be a searchable staff directory.
          </p>
          <FormField label="Assignee User ID">
            <input
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputCls}
              placeholder="Paste user UUID…"
            />
          </FormField>
          <div className="text-[11.5px] text-muted-foreground">
            Your ID: <span className="font-mono">{user?.id ?? "—"}</span>
            <button
              onClick={() => setAssigneeId(user?.id ?? "")}
              className="ml-2 text-primary underline"
            >
              Assign to me
            </button>
          </div>
        </div>
      </WorkflowModal>

      {/* ── Note modal ────────────────────────────────────────────────────── */}
      <WorkflowModal
        open={modal === "note"}
        onClose={close}
        title="Add internal note"
        description="Notes are visible only to support staff. Appended with timestamp."
        submitLabel={saving ? "Saving…" : "Add note"}
        submitTone="primary"
        onSubmit={submitNote}
        disabled={noteText.trim().length < 3 || saving}
      >
        <FormField label="Note">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className={textareaCls}
            placeholder="What action did you take, or what do you need to follow up on?"
            rows={4}
          />
        </FormField>
      </WorkflowModal>

    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className="text-[13px] font-medium mt-0.5">{value}</div>
    </div>
  );
}
