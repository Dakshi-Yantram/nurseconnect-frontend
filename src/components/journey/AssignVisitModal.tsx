import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { ChevronRight, X } from "lucide-react";

export interface AssignVisitFormData {
  serviceType: string;
  visitDate: string;
  visitTime: string;
  duration: string;
  notes: string;
}

interface AssignVisitModalProps {
  open: boolean;
  nurseName: string;
  onClose: () => void;
  onNext: (data: AssignVisitFormData) => void;
}

const SERVICE_TYPES = [
  "General Nursing Care",
  "Post-Operative Care",
  "Wound Care & Dressing",
  "ICU / Critical Care",
  "Geriatric Care",
  "Pediatric Care",
  "Maternal & Newborn Care",
  "Palliative Care",
  "Physiotherapy Assistance",
  "Medication Administration",
];

const DURATIONS = [
  "1 hour",
  "2 hours",
  "3 hours",
  "4 hours",
  "6 hours",
  "8 hours",
  "12 hours",
  "24 hours",
];

export function AssignVisitModal({ open, nurseName, onClose, onNext }: AssignVisitModalProps) {
  const [form, setForm] = useState<AssignVisitFormData>({
    serviceType: "",
    visitDate: "",
    visitTime: "",
    duration: "",
    notes: "",
  });

  const isValid =
    form.serviceType.trim() !== "" &&
    form.visitDate.trim() !== "" &&
    form.visitTime.trim() !== "" &&
    form.duration.trim() !== "";

  function set(field: keyof AssignVisitFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleNext() {
    if (isValid) onNext(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Visit"
      description={`Scheduling a new visit for ${nurseName}`}
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
            onClick={handleNext}
            disabled={!isValid}
            className="px-4 py-2 text-[13px] rounded-md bg-primary text-white inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FormField label="Service Type">
            <select
              value={form.serviceType}
              onChange={(e) => set("serviceType", e.target.value)}
              className={inputCls}
            >
              <option value="">Select service typeâ€¦</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Visit Date">
          <input
            type="date"
            value={form.visitDate}
            onChange={(e) => set("visitDate", e.target.value)}
            className={inputCls}
          />
        </FormField>

        <FormField label="Visit Time">
          <input
            type="time"
            value={form.visitTime}
            onChange={(e) => set("visitTime", e.target.value)}
            className={inputCls}
          />
        </FormField>

        <div className="col-span-2">
          <FormField label="Duration">
            <select
              value={form.duration}
              onChange={(e) => set("duration", e.target.value)}
              className={inputCls}
            >
              <option value="">Select durationâ€¦</option>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="col-span-2">
          <FormField label="Notes (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any special instructions or visit notesâ€¦"
              className={textareaCls}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
