import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function Drawer({
  open, onClose, title, description, children, footer, width = "lg",
}: {
  open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode;
  children: ReactNode; footer?: ReactNode; width?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const w = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[width];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full ${w} bg-card h-full flex flex-col shadow-2xl border-l border-border animate-in slide-in-from-right duration-200`}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div className="min-w-0">
            {title && <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>}
            {description && <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto nc-scroll px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-3.5 border-t border-border bg-muted/30 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
