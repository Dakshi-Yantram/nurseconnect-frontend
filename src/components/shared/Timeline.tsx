import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  ts: string;
  title: ReactNode;
  meta?: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
};

const DOT_TONES = {
  primary: "bg-primary ring-primary/15",
  success: "bg-emerald-500 ring-emerald-500/15",
  warning: "bg-amber-500 ring-amber-500/15",
  danger:  "bg-rose-500 ring-rose-500/15",
  muted:   "bg-slate-400 ring-slate-400/15",
} as const;

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative pl-5 space-y-3.5">
      <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" aria-hidden="true" />
      {items.map((it, i) => {
        const tone = it.tone ?? "primary";
        return (
          <li key={i} className="relative">
            <span
              className={cn(
                "absolute -left-[14px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card ring-offset-1 ring-offset-card",
                "shadow-[0_0_0_3px_var(--ring-glow,transparent)]",
                DOT_TONES[tone].split(" ")[0],
              )}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[13px] font-medium text-foreground leading-snug min-w-0">{it.title}</span>
              <span className="text-[10.5px] text-muted-foreground tabular-nums whitespace-nowrap ml-auto">{it.ts}</span>
            </div>
            {it.meta && (
              <div className="text-[11.5px] text-muted-foreground/90 mt-0.5 leading-relaxed break-words">{it.meta}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
