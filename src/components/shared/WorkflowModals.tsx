import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

type WorkflowModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel: string;
  submitTone?: "primary" | "success" | "warning" | "danger";
  onSubmit: () => void;
  disabled?: boolean;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  extraFooter?: ReactNode;
};

export function WorkflowModal({ open, onClose, title, description, submitLabel, submitTone = "primary", onSubmit, disabled, children, size = "md", extraFooter }: WorkflowModalProps) {
  const [saving, setSaving] = useState(false);
  const submit = () => {
    if (disabled || saving) return;
    setSaving(true);
    window.setTimeout(() => {
      onSubmit();
      setSaving(false);
    }, 450);
  };
  const tones = {
    primary: "bg-primary text-white",
    success: "bg-emerald-600 text-white",
    warning: "bg-amber-600 text-white",
    danger: "bg-rose-600 text-white",
  }[submitTone];
  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title={title} description={description} size={size}
      footer={<>
        {extraFooter}
        <button onClick={onClose} disabled={saving} className="px-4 py-2 text-[13px] rounded-md border border-border disabled:opacity-50">Cancel</button>
        <button onClick={submit} disabled={disabled || saving} className={`px-4 py-2 text-[13px] rounded-md disabled:opacity-50 ${tones}`}>{saving ? "Saving…" : submitLabel}</button>
      </>}
    >
      {children}
    </Modal>
  );
}

export function FormField({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return <div><label className="text-[12px] font-medium">{label}</label><div className="mt-1.5">{children}</div>{error && <div className="mt-1 text-[11px] text-rose-600">{error}</div>}</div>;
}

export const inputCls = "w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40";
export const textareaCls = `${inputCls} min-h-[100px]`;
