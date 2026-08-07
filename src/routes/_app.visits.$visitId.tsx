import { createFileRoute, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Timeline } from "@/components/shared/Timeline";
import { Modal } from "@/components/shared/Modal";
import { ArrowLeft, Calendar, Clock, Timer, MapPin, Star, User, Stethoscope, Trash2 } from "lucide-react";
import { VISITS } from "@/lib/mock-data";
import { getNewVisits } from "@/lib/visit-store";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

// Admin-only, permanent delete of a booking/visit report. This is
// intentionally not exposed anywhere else in the product — no other role,
// and no other page, gets a path to this action.
function DeleteVisitButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user?.role !== "admin") return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/bookings/${bookingId}`, { method: "DELETE" });
      setOpen(false);
      router.navigate({ to: "/visits" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-md border border-destructive/30"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete permanently
      </button>
      <Modal
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Delete this visit permanently?"
        description="Are you sure you want to delete it permanently?"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              disabled={deleting}
              className="text-[13px] font-medium px-3.5 py-2 rounded-md border border-border hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[13px] font-medium px-3.5 py-2 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Yes, delete permanently"}
            </button>
          </>
        }
      >
        <p className="text-[13px] text-muted-foreground">
          This removes the booking, its visit report, and all checklist and documentation
          entries under it from the database. This cannot be undone.
        </p>
        {error && <p className="text-[13px] text-destructive mt-3">{error}</p>}
      </Modal>
    </>
  );
}

export const Route = createFileRoute("/_app/visits/$visitId")({ component: VisitDetailPage });

const statusTone = (s: string) => {
  if (s === "Completed") return "success" as const;
  if (s === "Scheduled") return "warning" as const;
  if (s === "In Progress") return "primary" as const;
  return "muted" as const;
};

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="h-7 w-7 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
        <div className="text-[13px] font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function VisitDetailPage() {
  const router = useRouter();
  const { visitId } = useParams({ from: "/_app/visits/$visitId" });
  const allVisits = [...getNewVisits(), ...VISITS];
  const v = allVisits.find(x => x.id === visitId);

  if (!v) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Visits
        </button>
        <Card>
          <div className="text-center py-8 text-muted-foreground text-[13px]">
            Visit <span className="font-mono">{visitId}</span> not found.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Visits
        </button>
        <div className="flex items-center gap-3">
          <StatusChip tone={statusTone(v.status)} label={v.status} dot />
          <DeleteVisitButton bookingId={v.id} />
        </div>
      </div>

      <Card>
        <div>
          <div className="text-[18px] font-semibold">{v.service}</div>
          <div className="text-[12.5px] text-muted-foreground mt-0.5 font-mono">{v.id}</div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{v.date}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{v.time}</span>
            <span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" />{v.duration}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{v.city}</span>
            {v.rating != null && (
              <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{v.rating} rating</span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Visit Details">
          <DetailRow icon={<Stethoscope className="h-3.5 w-3.5" />} label="Service Type" value={v.service} />
          <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Visit Date" value={v.date} />
          <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Visit Time" value={v.time} />
          <DetailRow icon={<Timer className="h-3.5 w-3.5" />} label="Duration" value={v.duration} />
          <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="City" value={v.city} />
        </Card>

        <Card title="People">
          <DetailRow
            icon={<User className="h-3.5 w-3.5" />}
            label="Nurse"
            value={<span>{v.nurseName} <span className="font-mono text-[11px] text-muted-foreground">{v.nurseId}</span></span>}
          />
          <DetailRow
            icon={<User className="h-3.5 w-3.5" />}
            label="Patient"
            value={<span>{v.patientName} <span className="font-mono text-[11px] text-muted-foreground">{v.patientId}</span></span>}
          />
          <DetailRow
            icon={<Star className="h-3.5 w-3.5" />}
            label="Rating"
            value={
              v.rating != null
                ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{v.rating} / 5</span>
                : <StatusChip tone="muted" label="Pending" />
            }
          />
        </Card>
      </div>

      <Card title="Visit Timeline">
        <Timeline items={[
          ...(v.status === "Completed" ? [
            { ts: `${v.date} ${v.time}`, title: "Visit completed", tone: "success" as const },
            { ts: `${v.date} ${v.time}`, title: "Visit started", tone: "primary" as const },
          ] : []),
          ...(v.status === "In Progress" ? [
            { ts: `${v.date} ${v.time}`, title: "Visit in progress", tone: "primary" as const },
          ] : []),
          ...(v.status === "Cancelled" ? [
            { ts: `${v.date} ${v.time}`, title: "Visit cancelled", tone: "muted" as const },
          ] : []),
          { ts: v.date, title: "Visit scheduled", meta: `Assigned to ${v.nurseName}`, tone: "primary" as const },
        ]} />
      </Card>
    </div>
  );
}