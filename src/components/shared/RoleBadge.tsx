import { roleLabel, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const TONE: Record<Role, string> = {
  admin_super:    "bg-violet-50 text-violet-700 border-violet-200",
  admin_ops:      "bg-blue-50 text-blue-700 border-blue-200",
  admin_clinical: "bg-emerald-50 text-emerald-700 border-emerald-200",
  admin_finance:  "bg-amber-50 text-amber-700 border-amber-200",
  consumer:       "bg-sky-50 text-sky-700 border-sky-200",
  worker:         "bg-slate-100 text-slate-700 border-slate-200",
  reviewer:       "bg-rose-50 text-rose-700 border-rose-200",
  trainer:        "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
      TONE[role], className,
    )}>
      {roleLabel(role)}
    </span>
  );
}
