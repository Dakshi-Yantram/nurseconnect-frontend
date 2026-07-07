import { CheckCircle2, X } from "lucide-react";

interface ApprovalSuccessModalProps {
  batchId: string;
  batchName: string;
  netPayout: string;
  approvedBy: string;
  approvedAt: string;
  onClose: () => void;
}

export function ApprovalSuccessModal({
  batchId,
  batchName,
  netPayout,
  approvedBy,
  approvedAt,
  onClose,
}: ApprovalSuccessModalProps) {
  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Modal card */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted/60 transition-colors z-10"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Success hero */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-[16px] font-semibold text-foreground">Batch Approved Successfully</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            The payout batch has been processed and approved.
          </p>
        </div>

        {/* Detail block */}
        <div className="mx-6 mb-6 rounded-xl bg-muted/30 border border-border divide-y divide-border text-[13px]">
          <Row label="Batch ID" value={<span className="font-mono text-[12px]">{batchId}</span>} />
          <Row label="Batch Name" value={batchName} />
          <Row
            label="Net Payout"
            value={<span className="font-bold text-emerald-600">{netPayout}</span>}
          />
          <Row label="Approved By" value={approvedBy} />
          <Row label="Approved Time" value={approvedAt} />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-[13px] font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
