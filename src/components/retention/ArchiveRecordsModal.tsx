import { useState } from "react";
import { X, Search, Archive, Eye, RotateCcw, ChevronDown } from "lucide-react";
import { StatusChip } from "@/components/shared/StatusChip";
import { ArchivedRecordDetails } from "./ArchivedRecordDetails";
import { RestoreRecordModal } from "./RestoreRecordModal";

interface RetentionRecord {
  id: string;
  entity: string;
  policy: string;
  lastRun: string;
  processed: number;
  next: string;
  active: boolean;
}

interface ArchiveRecordsModalProps {
  open: boolean;
  onClose: () => void;
  record: RetentionRecord | null;
}

type ArchivedRecord = {
  id: string;
  patient: string;
  archivedOn: string;
  archivedBy: string;
  status: "archived" | "pending" | "failed";
};

const MOCK_RECORDS: ArchivedRecord[] = [
  { id: "VR-1001", patient: "Priya Mehta", archivedOn: "15 Jan 2024", archivedBy: "Dr. Kapoor", status: "archived" },
  { id: "VR-1002", patient: "Rajesh Sharma", archivedOn: "16 Jan 2024", archivedBy: "Nurse Singh", status: "pending" },
  { id: "VR-1003", patient: "Amit Verma", archivedOn: "17 Jan 2024", archivedBy: "Dr. Patel", status: "archived" },
  { id: "VR-1004", patient: "Sunita Rao", archivedOn: "18 Jan 2024", archivedBy: "Dr. Kapoor", status: "failed" },
  { id: "VR-1005", patient: "Deepak Nair", archivedOn: "19 Jan 2024", archivedBy: "Nurse Singh", status: "archived" },
];

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "info"> = {
  archived: "success",
  pending: "warning",
  failed: "danger",
};

export function ArchiveRecordsModal({ open, onClose, record }: ArchiveRecordsModalProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailRecord, setDetailRecord] = useState<ArchivedRecord | null>(null);
  const [restoreRecord, setRestoreRecord] = useState<ArchivedRecord | null>(null);

  if (!open || !record) return null;

  const filtered = MOCK_RECORDS.filter((r) => {
    const matchSearch =
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.patient.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Archive className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">Archived Records</h2>
                <p className="text-[12px] text-muted-foreground">{record.entity}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted/60 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border shrink-0 bg-muted/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by Record ID or Patientâ€¦"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-[13px] rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="archived">Archived</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-muted/40 text-muted-foreground text-left">
                  {["Record ID", "Patient", "Archived On", "Archived By", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-[13px]">
                      No records match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 font-mono text-[12px] font-medium">{r.id}</td>
                      <td className="px-5 py-3 font-medium">{r.patient}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.archivedOn}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.archivedBy}</td>
                      <td className="px-5 py-3">
                        <StatusChip tone={STATUS_TONES[r.status]} label={r.status} dot />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setDetailRecord(r)}
                            className="px-2.5 py-1.5 text-[12px] rounded border border-border inline-flex items-center gap-1.5 hover:bg-muted/50 transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                          <button
                            onClick={() => setRestoreRecord(r)}
                            className="px-2.5 py-1.5 text-[12px] rounded border border-border inline-flex items-center gap-1.5 hover:bg-muted/50 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/20 shrink-0">
            <p className="text-[12px] text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? "s" : ""} shown</p>
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested modals */}
      <ArchivedRecordDetails
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        record={detailRecord}
      />
      <RestoreRecordModal
        open={!!restoreRecord}
        onClose={() => setRestoreRecord(null)}
        record={restoreRecord}
      />
    </>
  );
}
