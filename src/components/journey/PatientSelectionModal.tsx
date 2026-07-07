import { useState, useMemo } from "react";
import { Modal } from "@/components/shared/Modal";
import { StatusChip } from "@/components/shared/StatusChip";
import { ChevronLeft, ChevronRight, Search, User } from "lucide-react";

export interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
  city: string;
  status: "Active" | "Inactive" | "Pending";
}

// Mock patient data â€” replace with real data source as needed
const MOCK_PATIENTS: Patient[] = [
  { id: "PAT-001", name: "Ramesh Iyer", age: 72, condition: "Post-Op Recovery", city: "Bangalore", status: "Active" },
  { id: "PAT-002", name: "Sunita Mehta", age: 65, condition: "Diabetic Care", city: "Mumbai", status: "Active" },
  { id: "PAT-003", name: "Arjun Kapoor", age: 58, condition: "Cardiac Rehab", city: "Delhi", status: "Active" },
  { id: "PAT-004", name: "Leela Nair", age: 80, condition: "Palliative Care", city: "Kochi", status: "Active" },
  { id: "PAT-005", name: "Vijay Sharma", age: 45, condition: "Wound Dressing", city: "Hyderabad", status: "Active" },
  { id: "PAT-006", name: "Meena Pillai", age: 70, condition: "Geriatric Care", city: "Chennai", status: "Pending" },
  { id: "PAT-007", name: "Suresh Rao", age: 55, condition: "ICU Follow-up", city: "Pune", status: "Active" },
  { id: "PAT-008", name: "Anita Desai", age: 38, condition: "Maternal Care", city: "Bangalore", status: "Active" },
];

interface PatientSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  onContinue: (patient: Patient) => void;
}

const statusTone = (s: Patient["status"]) => {
  if (s === "Active") return "success" as const;
  if (s === "Pending") return "warning" as const;
  return "muted" as const;
};

export function PatientSelectionModal({
  open,
  onClose,
  onBack,
  onContinue,
}: PatientSelectionModalProps) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return MOCK_PATIENTS.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.condition.toLowerCase().includes(lower) ||
        p.city.toLowerCase().includes(lower) ||
        p.id.toLowerCase().includes(lower)
    );
  }, [q]);

  function handleContinue() {
    if (selected) {
      onContinue(selected);
      setQ("");
      setSelected(null);
    }
  }

  function handleBack() {
    setQ("");
    setSelected(null);
    onBack();
  }

  function handleClose() {
    setQ("");
    setSelected(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Select Patient"
      description="Search and select a patient for this visit"
      size="lg"
      footer={
        <>
          <button
            onClick={handleBack}
            className="px-4 py-2 text-[13px] rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1.5 mr-auto"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[13px] rounded-md border border-border hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="px-4 py-2 text-[13px] rounded-md bg-primary text-white inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, condition, city or IDâ€¦"
          className="w-full pl-9 pr-3 py-2 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      {/* Patient list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-[13px] text-muted-foreground">
            No patients found.
          </div>
        )}
        {filtered.map((p) => {
          const isSelected = selected?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left p-3 rounded-md border transition-colors flex items-center gap-3 ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:bg-secondary/60"
              }`}
            >
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-purple grid place-items-center text-white text-[11px] font-semibold shrink-0">
                {p.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">{p.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{p.id}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {p.age} yrs Â· {p.condition} Â· {p.city}
                </div>
              </div>
              <StatusChip tone={statusTone(p.status)} label={p.status} dot />
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20 text-[12px] text-primary font-medium">
          Selected: {selected.name} ({selected.id})
        </div>
      )}
    </Modal>
  );
}
