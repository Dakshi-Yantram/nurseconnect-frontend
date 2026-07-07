import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon, title, description, action, className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center px-4 sm:px-6 py-8 sm:py-12 rounded-lg border border-dashed border-border bg-card/50",
      className,
    )}>
      {Icon && <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground/70 mb-2.5 sm:mb-3" aria-hidden="true" />}
      <div className="text-[13.5px] sm:text-[14px] font-semibold text-foreground">{title}</div>
      {description && <div className="text-[12px] sm:text-[12.5px] text-muted-foreground mt-1 max-w-md leading-relaxed">{description}</div>}
      {action && <div className="mt-3 sm:mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-3 px-4 py-6 text-[13px] text-muted-foreground", className)}
    >
      <span className="h-3 w-3 rounded-full border-2 border-primary border-r-transparent animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Hydration-safe skeleton row. Use for dense queues/timelines so loading
 * states match the eventual content geometry instead of a spinner blob.
 */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/60 h-4 w-full", className)} aria-hidden="true" />
  );
}

export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonRow className="h-3 w-16" />
          <SkeletonRow className="h-3 flex-1" />
          <SkeletonRow className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}
