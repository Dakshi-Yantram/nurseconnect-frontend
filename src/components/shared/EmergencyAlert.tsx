import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

type Tone = "danger" | "warning" | "primary";

const toneBtn: Record<Tone, string> = {
  danger: "bg-rose-600 hover:bg-rose-700 text-white",
  warning: "bg-amber-600 hover:bg-amber-700 text-white",
  primary: "bg-sky-600 hover:bg-sky-700 text-white",
};

export function EmergencyAlert({
  open, onClose, title, eyebrow, icon, tone = "danger", children, confirmLabel, onConfirm,
}: {
  open: boolean; onClose: () => void; title: string; eyebrow?: string;
  icon?: ReactNode; tone?: Tone; children: ReactNode;
  confirmLabel: string; onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          {icon && <div className={`h-10 w-10 rounded-full grid place-items-center ${tone === "danger" ? "bg-rose-50 text-rose-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600"}`}>{icon}</div>}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{eyebrow}</div>}
            <h3 className="text-[15px] font-semibold text-foreground leading-tight mt-0.5">{title}</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-md hover:bg-secondary -mr-1 -mt-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 pb-4 text-[13px] space-y-2">{children}</div>
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-end gap-2 rounded-b-2xl">
          <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] rounded-md border border-border hover:bg-secondary">Cancel</button>
          <button onClick={onConfirm} className={`px-3.5 py-1.5 text-[12.5px] rounded-md font-medium ${toneBtn[tone]}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}