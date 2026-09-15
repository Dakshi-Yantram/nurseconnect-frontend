import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/complaints/$complaintId")({ component: ComplaintDetail });

// Mirrors app/api/v1/admin.py: GET /complaints/{id}, POST /complaints/{id}/status
interface ComplaintDetailData {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  raisedBy: string;
  raiser_role: string;
  created: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  assigned_to: string | null;
  attachments: string[];
  booking: {
    id: string;
    booking_ref: string | null;
    status: string;
    scheduled_date: string;
    service_name: string | null;
    patient_name: string | null;
    patient_id: string | null;
    patient_medical_conditions: string[];
    patient_allergies: string[];
    nurse_name: string | null;
    nurse_id: string | null;
  } | null;
}

// The complaint's ComplaintStatus enum only allows moving forward through
// this sequence (see app/models/enums.py) — a resolved/closed complaint
// isn't reopened here, that would need a fresh complaint or a separate
// reopen action.
const NEXT_STATUS: Record<string, { value: string; label: string; tone: "primary" | "success" | "warning" | "danger" }[]> = {
  submitted: [
    { value: "acknowledged", label: "Acknowledge", tone: "primary" },
    { value: "investigating", label: "Start Investigating", tone: "primary" },
  ],
  acknowledged: [
    { value: "investigating", label: "Start Investigating", tone: "primary" },
    { value: "resolved_no_action", label: "Resolve — No Action Needed", tone: "success" },
  ],
  investigating: [
    { value: "resolved_action_taken", label: "Resolve — Action Taken", tone: "success" },
    { value: "resolved_no_action", label: "Resolve — No Action Needed", tone: "success" },
  ],
  resolved_action_taken: [{ value: "closed", label: "Close", tone: "warning" }],
  resolved_no_action: [{ value: "closed", label: "Close", tone: "warning" }],
  closed: [],
};

function formatStatus(s: string) {
  return s.replace(/_/g, " ");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ComplaintDetail() {
  const { complaintId } = useParams({ from: "/_app/complaints/$complaintId" });
  const [c, setC] = useState<ComplaintDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busyStatus, setBusyStatus] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/admin/complaints/${complaintId}`)
      .then((data: ComplaintDetailData) => setC(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load complaint"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [complaintId]);

  const transition = async (status: string) => {
    const needsNotes = status.startsWith("resolved") || status === "closed";
    if (needsNotes && notes.trim().length < 8) {
      toast.error("Add a short note before resolving or closing this complaint.");
      return;
    }
    setBusyStatus(status);
    try {
      await apiFetch(`/api/admin/complaints/${complaintId}/status`, {
        method: "POST",
        body: JSON.stringify({ status, resolution_notes: notes.trim() || undefined }),
      });
      toast.success(`Marked as ${formatStatus(status)}`);
      setNotes("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusyStatus(null);
    }
  };

  if (loading) {
    return <div className="px-5 py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !c) {
    return <div className="nc-card p-4 text-[13px] text-rose-600">{error ?? "Complaint not found"}</div>;
  }

  const nextActions = NEXT_STATUS[c.status] ?? [];

  return (
    <DetailShell
      backTo="/complaints"
      backLabel="Back to Complaints"
      eyebrow={`Complaint · ${c.id.slice(0, 8)}`}
      title={c.subject}
      status={c.status}
      badges={<StatusChip tone="info" label={c.category} />}
      subtitle={<>Raised by {c.raisedBy} ({c.raiser_role}) · {formatDate(c.created)}</>}
      actions={
        <>
          {nextActions.map((a) => (
            <ActionBtn key={a.value} tone={a.tone} onClick={() => transition(a.value)}>
              {a.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />} {a.label}
              {busyStatus === a.value && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </ActionBtn>
          ))}
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Complaint Details" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-3 text-[12.5px]">
            <Info l="Category" v={c.category} />
            <Info l="Raised By" v={c.raisedBy} />
            <Info l="Created" v={formatDate(c.created)} />
            <Info l="Status" v={formatStatus(c.status)} />
            <Info l="Resolved At" v={formatDate(c.resolved_at)} />
            <Info l="Assigned To" v={c.assigned_to ?? "Unassigned"} />
          </div>
          <div className="mt-5">
            <h4 className="text-[13px] font-semibold mb-2">Description</h4>
            <p className="text-[12.5px] text-muted-foreground whitespace-pre-wrap">{c.description}</p>
          </div>
          {c.resolution_notes && (
            <div className="mt-5">
              <h4 className="text-[13px] font-semibold mb-2">Resolution Notes</h4>
              <p className="text-[12.5px] text-muted-foreground whitespace-pre-wrap">{c.resolution_notes}</p>
            </div>
          )}
        </Card>

        <Card title="Linked Booking">
          {c.booking ? (
            <div className="text-[12.5px] space-y-2">
              <Row l="Booking" v={c.booking.booking_ref ?? "—"} />
              <Row l="Service" v={c.booking.service_name ?? "—"} />
              <Row l="Date" v={c.booking.scheduled_date} />
              <Row l="Booking Status" v={c.booking.status.replace(/_/g, " ")} />
              <div className="border-t border-border my-2" />
              <Row l="Patient" v={c.booking.patient_name ?? "—"} />
              {c.booking.patient_allergies.length > 0 && (
                <Row l="Allergies" v={c.booking.patient_allergies.join(", ")} />
              )}
              {c.booking.patient_medical_conditions.length > 0 && (
                <Row l="Conditions" v={c.booking.patient_medical_conditions.join(", ")} />
              )}
              <div className="border-t border-border my-2" />
              <Row l="Nurse" v={c.booking.nurse_name ?? "—"} />
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              This complaint isn't linked to a specific booking.
            </p>
          )}
        </Card>
      </div>

      {nextActions.length > 0 && (
        <Card title="Add a note and move this complaint forward">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes visible in the resolution/audit trail — required to resolve or close."
            className="w-full min-h-[90px] text-[13px] rounded-md border border-border px-3 py-2"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Use the buttons above once your note is ready.
          </p>
        </Card>
      )}
    </DetailShell>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{l}</div>
      <div className="font-medium mt-0.5 capitalize">{v}</div>
    </div>
  );
}
function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{l}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
