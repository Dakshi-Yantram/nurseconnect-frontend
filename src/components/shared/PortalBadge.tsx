import { PORTAL_LABEL, type Portal } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const TONE: Record<Portal, string> = {
  admin:      "bg-violet-50 text-violet-700 border-violet-200",
  consumer:   "bg-sky-50 text-sky-700 border-sky-200",
  worker:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  moderation: "bg-amber-50 text-amber-700 border-amber-200",
};

export function PortalBadge({ portal, className }: { portal: Portal; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
      TONE[portal], className,
    )}>
      {PORTAL_LABEL[portal]}
    </span>
  );
}
