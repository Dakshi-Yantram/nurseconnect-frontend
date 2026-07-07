import { X, Download, Heart, Thermometer, Activity, Wind } from "lucide-react";

interface ArchivedRecord {
  id: string;
  patient: string;
  archivedOn: string;
  archivedBy: string;
  status: string;
}

interface ArchivedRecordDetailsProps {
  open: boolean;
  onClose: () => void;
  record: ArchivedRecord | null;
}

const PATIENT_INFO = {
  age: 34,
  gender: "Female",
  visitDate: "12 Jan 2024",
  visitType: "Routine Check-up",
};

const VITALS = [
  { label: "Blood Pressure", value: "118/76", unit: "mmHg", icon: Heart, color: "text-rose-600", bg: "bg-rose-50 border-rose-100" },
  { label: "Pulse", value: "72", unit: "bpm", icon: Activity, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  { label: "Temperature", value: "98.6", unit: "Â°F", icon: Thermometer, color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
  { label: "Oxygen Saturation", value: "99", unit: "%", icon: Wind, color: "text-teal-600", bg: "bg-teal-50 border-teal-100" },
];

function handleDownload(record: ArchivedRecord) {
  const lines = [
    "====================================================",
    "         NURSECONNECT â€” VITALS RECORD REPORT        ",
    "====================================================",
    "",
    `Record ID       : ${record.id}`,
    `Generated On    : ${new Date().toLocaleString()}`,
    "",
    "----------------------------------------------------",
    "PATIENT INFORMATION",
    "----------------------------------------------------",
    `Name            : ${record.patient}`,
    `Age             : ${PATIENT_INFO.age} years`,
    `Gender          : ${PATIENT_INFO.gender}`,
    `Visit Date      : ${PATIENT_INFO.visitDate}`,
    `Visit Type      : ${PATIENT_INFO.visitType}`,
    "",
    "----------------------------------------------------",
    "VITALS",
    "----------------------------------------------------",
    `Blood Pressure  : 118/76 mmHg`,
    `Pulse           : 72 bpm`,
    `Temperature     : 98.6 Â°F`,
    `Oxygen Sat.     : 99 %`,
    "",
    "----------------------------------------------------",
    "ARCHIVE INFORMATION",
    "----------------------------------------------------",
    `Archived On     : ${record.archivedOn}`,
    `Archived By     : ${record.archivedBy}`,
    `Retention Policy: 7-Year Clinical`,
    `Audit Reference : AUD-2024-00432`,
    "",
    "====================================================",
    "  This report is confidential and for authorized   ",
    "  personnel only. NurseConnect Health Systems.     ",
    "====================================================",
  ];

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `VitalsReport_${record.id}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ArchivedRecordDetails({ open, onClose, record }: ArchivedRecordDetailsProps) {
  if (!open || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Vitals Record Details</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5 font-mono">{record.id}</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted/60 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Patient Information */}
          <section>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Patient Information</p>
            <div className="rounded-xl border border-border bg-muted/20 p-4 grid grid-cols-2 gap-3 text-[13px]">
              {[
                { label: "Name", value: record.patient },
                { label: "Age", value: `${PATIENT_INFO.age} years` },
                { label: "Gender", value: PATIENT_INFO.gender },
                { label: "Visit Date", value: PATIENT_INFO.visitDate },
                { label: "Visit Type", value: PATIENT_INFO.visitType },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-[11px] text-muted-foreground mb-0.5">{f.label}</p>
                  <p className="font-medium text-foreground">{f.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Vitals */}
          <section>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Vitals</p>
            <div className="grid grid-cols-2 gap-3">
              {VITALS.map((v) => (
                <div key={v.label} className={`rounded-xl border px-4 py-3.5 ${v.bg}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <v.icon className={`h-3.5 w-3.5 ${v.color}`} />
                    <p className="text-[11px] text-muted-foreground">{v.label}</p>
                  </div>
                  <p className={`text-[22px] font-bold ${v.color}`}>
                    {v.value}
                    <span className="text-[12px] font-normal ml-1">{v.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Archive Information */}
          <section>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Archive Information</p>
            <div className="rounded-xl border border-border bg-muted/20 p-4 grid grid-cols-2 gap-3 text-[13px]">
              {[
                { label: "Archived On", value: record.archivedOn },
                { label: "Archived By", value: record.archivedBy },
                { label: "Retention Policy", value: "7-Year Clinical" },
                { label: "Audit Reference", value: "AUD-2024-00432" },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-[11px] text-muted-foreground mb-0.5">{f.label}</p>
                  <p className="font-medium text-foreground">{f.value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => handleDownload(record)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download Report
          </button>
        </div>
      </div>
    </div>
  );
}
