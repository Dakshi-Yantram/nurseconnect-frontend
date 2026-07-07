import { useState } from "react";
import { X, Play, CheckCircle2, FileText, Eye } from "lucide-react";
import { StatusChip } from "@/components/shared/StatusChip";

interface RetentionRecord {
  id: string;
  entity: string;
  policy: string;
  lastRun: string;
  processed: number;
  next: string;
  active: boolean;
}

interface RunRetentionModalProps {
  open: boolean;
  onClose: () => void;
  record: RetentionRecord | null;
}

export function RunRetentionModal({ open, onClose, record }: RunRetentionModalProps) {
  const [auditLog, setAuditLog] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [success, setSuccess] = useState(false);
  const [running, setRunning] = useState(false);

  if (!open || !record) return null;

  const handleRun = async () => {
    setRunning(true);
    await new Promise((r) => setTimeout(r, 1500));
    setRunning(false);
    setSuccess(true);
  };

  const handleClose = () => {
    setSuccess(false);
    setRunning(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Play className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-[15px] font-semibold text-foreground">Run Retention Policy</h2>
          </div>
          <button onClick={handleClose} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted/60 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          /* â”€â”€ Success State â”€â”€ */
          <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foreground">Retention Job Completed</p>
              <p className="text-[13px] text-muted-foreground mt-1">Policy ran successfully for <span className="font-medium text-foreground">{record.entity}</span></p>
            </div>
            <div className="w-full rounded-lg bg-green-50 border border-green-100 px-5 py-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Processed", value: "1,248" },
                { label: "Archived", value: "1,248" },
                { label: "Failed", value: "0" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[18px] font-bold text-green-700">{s.value}</p>
                  <p className="text-[11px] text-green-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={handleClose} className="mt-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Policy details */}
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                {[
                  { label: "Entity", value: record.entity },
                  { label: "Policy", value: record.policy },
                  { label: "Last Run", value: record.lastRun },
                  { label: "Records Processed", value: record.processed.toLocaleString() },
                  { label: "Next Run", value: record.next },
                  { label: "Status", value: record.active ? "Active" : "Paused" },
                ].map((f) => (
                  <div key={f.label} className="rounded-lg bg-muted/30 px-3.5 py-2.5">
                    <p className="text-[11px] text-muted-foreground mb-0.5">{f.label}</p>
                    <p className="font-medium text-foreground">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Records Found", value: "1,248", color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
                  { label: "Records To Archive", value: "1,248", color: "text-orange-700", bg: "bg-orange-50 border-orange-100" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-lg border px-4 py-3 ${s.bg}`}>
                    <p className={`text-[22px] font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Checkboxes */}
              <div className="space-y-2.5">
                {[
                  { id: "audit", label: "Generate Audit Log", icon: FileText, checked: auditLog, set: setAuditLog },
                  { id: "dry", label: "Dry Run (Preview Only)", icon: Eye, checked: dryRun, set: setDryRun },
                ].map((opt) => (
                  <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={opt.checked}
                      onChange={(e) => opt.set(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-blue-600 accent-blue-600"
                    />
                    <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[13px] text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
              <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={running}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
              >
                {running ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Runningâ€¦
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Run Now
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
