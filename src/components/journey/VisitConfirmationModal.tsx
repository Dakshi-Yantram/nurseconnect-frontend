import { Modal } from "@/components/shared/Modal";
import { StatusChip } from "@/components/shared/StatusChip";
import { CheckCircle, Calendar, Clock, Timer, User, Stethoscope } from "lucide-react";
import type { AssignVisitFormData } from "./AssignVisitModal";
import type { Patient } from "./PatientSelectionModal";

interface VisitConfirmationModalProps {
  open: boolean;
  nurseName: string;
  nurseId: string;
  patient: Patient | null;
  visitData: AssignVisitFormData | null;
  onClose: () => void;
  onAssign: () => void;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "â€”";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(timeStr: string) {
  if (!timeStr) return "â€”";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="h-7 w-7 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
        <div className="text-[13px] font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export function VisitConfirmationModal({
  open,
  nurseName,
  nurseId,
  patient,
  visitData,
  onClose,
  onAssign,
}: VisitConfirmationModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Visit Assignment"
      description="Review the details below before confirming the assignment"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-md border border-border hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onAssign}
            className="px-4 py-2 text-[13px] rounded-md bg-emerald-600 text-white inline-flex items-center gap-1.5 hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle className="h-4 w-4" /> Assign Visit
          </button>
        </>
      }
    >
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Visit Summary
          </span>
        </div>
        <div className="px-4">
          <DetailRow
            icon={<User className="h-3.5 w-3.5" />}
            label="Nurse"
            value={
              <span>
                {nurseName}{" "}
                <span className="font-mono text-[11px] text-muted-foreground">{nurseId}</span>
              </span>
            }
          />
          <DetailRow
            icon={<User className="h-3.5 w-3.5" />}
            label="Patient"
            value={
              patient ? (
                <span>
                  {patient.name}{" "}
                  <span className="font-mono text-[11px] text-muted-foreground">{patient.id}</span>
                  <span className="ml-2">
                    <StatusChip tone="success" label={patient.condition} />
                  </span>
                </span>
              ) : (
                "â€”"
              )
            }
          />
          <DetailRow
            icon={<Stethoscope className="h-3.5 w-3.5" />}
            label="Service Type"
            value={visitData?.serviceType ?? "â€”"}
          />
          <DetailRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Visit Date"
            value={formatDate(visitData?.visitDate ?? "")}
          />
          <DetailRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Visit Time"
            value={formatTime(visitData?.visitTime ?? "")}
          />
          <DetailRow
            icon={<Timer className="h-3.5 w-3.5" />}
            label="Duration"
            value={visitData?.duration ?? "â€”"}
          />
        </div>
      </div>

      {visitData?.notes && (
        <div className="mt-3 p-3 rounded-md border border-border bg-muted/30">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Notes
          </div>
          <p className="text-[13px]">{visitData.notes}</p>
        </div>
      )}

      <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
        Once assigned, the nurse and patient will be notified automatically.
      </div>
    </Modal>
  );
}
