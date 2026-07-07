import { useState } from "react";
import { X, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";

interface ArchivedRecord {
  id: string;
  patient: string;
  archivedOn: string;
  archivedBy: string;
  status: string;
}

interface RestoreRecordModalProps {
  open: boolean;
  onClose: () => void;
  record: ArchivedRecord | null;
}

export function RestoreRecordModal({ open, onClose, record }: RestoreRecordModalProps) {
  const [restoring, setRestoring] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!open || !record) return null;

  const handleRestore = async () => {
    setRestoring(true);
    await new Promise((r) => setTimeout(r, 1400));
    setRestoring(false);
    setSuccess(true);
  };

  const handleClose = () => {
    setSuccess(false);
    setRestoring(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <RotateCcw className="h-4 w-4 text-teal-600" />
            </div>
            <h2 className="text-[15px] font-semibold text-foreground">Restore Archived Record</h2>
          </div>
          <button onClick={handleClose} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted/60 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foreground">Record Restored Successfully</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                <span className="font-mono font-medium">{record.id}</span> has been moved back to active data.
              </p>
            </div>
            <button onClick={handleClose} className="mt-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              {/* Record details */}
              <div className="rounded-lg bg-muted/30 divide-y divide-border text-[13px]">
                {[
                  { label: "Record ID", value: record.id, mono: true },
                  { label: "Patient Name", value: record.patient },
                  { label: "Archived Date", value: record.archivedOn },
                ].map((f) => (
                  <div key={f.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className={`font-medium text-foreground ${f.mono ? "font-mono text-[12px]" : ""}`}>{f.value}</span>
                  </div>
                ))}
              </div>

              {/* Warning */}
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[13px] text-amber-800">
                  This record will be restored to active data and will be visible in standard patient views.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
              <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-[13px] font-medium hover:bg-teal-700 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
              >
                {restoring ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Restoringâ€¦
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore Record
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
