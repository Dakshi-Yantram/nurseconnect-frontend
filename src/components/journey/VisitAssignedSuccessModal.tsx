import { Modal } from "@/components/shared/Modal";
import { StatusChip } from "@/components/shared/StatusChip";
import { CheckCircle, ExternalLink } from "lucide-react";
import type { Patient } from "./PatientSelectionModal";

interface VisitAssignedSuccessModalProps {
  open: boolean;
  visitId: string;
  nurseName: string;
  patient: Patient | null;
  onViewVisit: (visitId: string) => void;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium">{value}</span>
    </div>
  );
}

export function VisitAssignedSuccessModal({
  open,
  visitId,
  nurseName,
  patient,
  onViewVisit,
  onClose,
}: VisitAssignedSuccessModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      description=""
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-md border border-border hover:bg-secondary"
          >
            Close
          </button>
          <button
            onClick={() => onViewVisit(visitId)}
            className="px-4 py-2 text-[13px] rounded-md bg-primary text-white inline-flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            View Visit <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </>
      }
    >
      {/* Success header */}
      <div className="flex flex-col items-center text-center pb-5 border-b border-border mb-4">
        <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 grid place-items-center mb-3">
          <CheckCircle className="h-7 w-7 text-emerald-600" />
        </div>
        <h2 className="text-[16px] font-semibold">Visit Assigned Successfully</h2>
        <p className="text-[12px] text-muted-foreground mt-1">
          The visit has been scheduled and all parties notified.
        </p>
      </div>

      {/* Details */}
      <div className="rounded-md border border-border bg-card px-4 py-1">
        <Row
          label="Visit ID"
          value={<span className="font-mono text-[12px]">{visitId}</span>}
        />
        <Row label="Nurse" value={nurseName} />
        <Row
          label="Patient"
          value={
            patient ? (
              <span>
                {patient.name}{" "}
                <span className="font-mono text-[11px] text-muted-foreground">{patient.id}</span>
              </span>
            ) : (
              "â€”"
            )
          }
        />
        <Row
          label="Status"
          value={<StatusChip tone="success" label="Scheduled" dot />}
        />
      </div>

      <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20 text-[12px] text-primary">
        A confirmation has been sent to the nurse and patient via SMS and email.
      </div>
    </Modal>
  );
}
