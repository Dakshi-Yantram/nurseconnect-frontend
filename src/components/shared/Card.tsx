import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  title, action, children, className, padded = true,
}: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("nc-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border">
          <h3 className="text-[13.5px] sm:text-[14px] font-semibold text-foreground min-w-0 truncate">{title}</h3>
          {action && <div className="text-[12px] shrink-0">{action}</div>}
        </header>
      )}
      <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label, value, trend, hint, icon: Icon, tone = "primary",
}: { label: string; value: ReactNode; trend?: string; hint?: string; icon?: any; tone?: "primary"|"success"|"warning"|"purple"|"info" }) {
  const toneBg = {
    primary: "bg-blue-50 text-blue-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    purple: "bg-violet-50 text-violet-600",
    info: "bg-sky-50 text-sky-600",
  }[tone];
  return (
    <div className="nc-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11.5px] sm:text-[12px] text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
          <div className="mt-1.5 text-[20px] sm:text-[24px] font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{hint}</div>}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {Icon && <div className={cn("h-9 w-9 rounded-md grid place-items-center", toneBg)}><Icon className="h-[18px] w-[18px]" /></div>}
          {trend && <span className="text-[11px] text-emerald-600 font-medium whitespace-nowrap">{trend}</span>}
        </div>
      </div>
    </div>
  );
}
