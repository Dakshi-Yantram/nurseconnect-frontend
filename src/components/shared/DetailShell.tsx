import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./Card";
import { StatusChip, statusToneFor } from "./StatusChip";

export function DetailShell({
  backTo, backLabel, eyebrow, title, subtitle, status, badges, actions, children,
}: {
  backTo: string; backLabel: string;
  eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode;
  status?: string; badges?: ReactNode; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{eyebrow}</div>}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h2 className="text-[18px] font-semibold leading-tight">{title}</h2>
              {status && <StatusChip tone={statusToneFor(status)} label={status.replace(/_/g, " ")} dot />}
              {badges}
            </div>
            {subtitle && <div className="text-[12.5px] text-muted-foreground mt-1">{subtitle}</div>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 justify-end">{actions}</div>}
        </div>
      </Card>

      {children}
    </div>
  );
}

export function ActionBtn({
  children, onClick, tone = "default", as: As = "button", to,
}: { children: ReactNode; onClick?: () => void; tone?: "default"|"primary"|"danger"|"warning"|"success"; as?: any; to?: string }) {
  const cls = {
    default: "border border-border hover:bg-secondary",
    primary: "bg-primary text-white hover:opacity-95",
    danger: "border border-rose-200 text-rose-700 hover:bg-rose-50",
    warning: "border border-amber-200 text-amber-700 hover:bg-amber-50",
    success: "bg-emerald-600 text-white hover:opacity-95",
  }[tone];
  if (to) return <Link to={to} className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] rounded-md ${cls}`}>{children}</Link>;
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] rounded-md ${cls}`}>{children}</button>;
}
