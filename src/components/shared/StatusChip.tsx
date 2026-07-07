import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted" | "purple" | "primary";

const tones: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  muted: "bg-slate-100 text-slate-600 border-slate-200",
  purple: "bg-violet-50 text-violet-700 border-violet-200",
  primary: "bg-blue-50 text-blue-700 border-blue-200",
};

export function StatusChip({
  label, tone = "muted", className, dot,
}: { label: React.ReactNode; tone?: Tone; className?: string; dot?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
      tones[tone], className
    )}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
        tone === "success" && "bg-emerald-500",
        tone === "warning" && "bg-amber-500",
        tone === "danger" && "bg-rose-500",
        tone === "info" && "bg-sky-500",
        tone === "muted" && "bg-slate-400",
        tone === "purple" && "bg-violet-500",
        tone === "primary" && "bg-blue-500",
      )} aria-hidden="true" />}
      {label}
    </span>
  );
}

export function statusToneFor(status: string): Tone {
  const s = status.toLowerCase();
  if (["active", "approved", "resolved", "verified", "covered", "ready", "on duty"].some(k => s.includes(k))) return "success";
  if (["pending", "in_progress", "in review", "review", "partial", "evidence_review", "background check", "split_resolution"].some(k => s.includes(k))) return "warning";
  if (["high", "critical", "escalated", "open", "delayed", "rejected", "suspended", "blocked", "not_covered", "revoked"].some(k => s.includes(k))) return "danger";
  if (["low", "off duty", "inactive"].some(k => s.includes(k))) return "muted";
  return "info";
}
