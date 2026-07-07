import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function Modal({
  open, onClose, title, description, children, footer, size = "md",
}: {
  open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode;
  children: ReactNode; footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className={`w-full ${widths} bg-card rounded-2xl border border-border shadow-2xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150`}>
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
        {footer && <div className="px-6 py-3.5 border-t border-border bg-muted/30 flex items-center justify-end gap-2 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}
