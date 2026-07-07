/**
 * Phase 6B+B — Operational queue panel.
 *
 * Renders a workflow-aware queue (assignment / escalation / moderation / ...)
 * as a single card. Reads through `useQueue(name)` so it stays reactive to
 * orchestration transitions without holding any local state.
 *
 * Used by admin (ops orchestrator) and moderation (reviewer/trainer) surfaces.
 * Portal-agnostic — pages decide which queue(s) to mount based on portal.
 */
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { useQueue, type QueueItem, type QueueName } from "@/lib/orchestration";
import { bookingPatientName } from "@/lib/orchestration/links";
import { QUEUE_LABEL } from "@/lib/orchestration/queues";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

const PRIORITY_TONE: Record<QueueItem["priority"], string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-200/60",
  high:   "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-sky-50 text-sky-700 border-sky-200",
  low:    "bg-slate-50 text-slate-600 border-slate-200",
};

const PRIORITY_DOT: Record<QueueItem["priority"], string> = {
  urgent: "bg-rose-500",
  high:   "bg-amber-500",
  normal: "bg-sky-500",
  low:    "bg-slate-400",
};

function PriorityChip({ priority }: { priority: QueueItem["priority"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide whitespace-nowrap",
        PRIORITY_TONE[priority],
      )}
      aria-label={`Priority ${priority}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[priority])} aria-hidden="true" />
      {priority}
    </span>
  );
}

function itemLabel(it: QueueItem): string {
  const d: any = it.record.data;
  return d?.title ?? d?.service ?? d?.subject ?? d?.name ?? `#${it.id}`;
}
function itemSubLabel(it: QueueItem): string {
  const d: any = it.record.data;
  return bookingPatientName(it.record) ?? d?.reporter ?? d?.from ?? d?.area ?? "—";
}

export interface QueuePanelProps {
  name: QueueName;
  title?: string;
  /** Cap rows shown — older items still counted in footer. */
  limit?: number;
  /** Optional row link resolver (e.g. /complaints/$id). */
  linkFor?: (it: QueueItem) => string | undefined;
  /** Optional action slot rendered on the right. */
  renderActions?: (it: QueueItem) => ReactNode;
  emptyTitle?: string;
}

export function QueuePanel({
  name, title, limit = 6, linkFor, renderActions, emptyTitle,
}: QueuePanelProps) {
  const items = useQueue(name);
  const visible = items.slice(0, limit);
  const more = items.length - visible.length;
  const heading = title ?? QUEUE_LABEL[name];

  return (
    <Card title={
      <span className="flex items-center gap-2">
        {heading}
        <span className="text-[11px] font-normal text-muted-foreground">({items.length})</span>
      </span>
    } padded={false}>
      {items.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={Inbox} title={emptyTitle ?? "Queue is empty"} />
        </div>
      ) : (
        <ul className="max-h-[420px] overflow-y-auto nc-scroll divide-y divide-border">
          {visible.map(it => {
            const href = linkFor?.(it);
            const urgent = it.priority === "urgent";
            const titleNode = (
              <span className="text-[13px] font-medium truncate">
                <span className="text-muted-foreground tabular-nums">#{it.id}</span>
                <span className="mx-1 text-muted-foreground/60">·</span>
                {itemLabel(it)}
              </span>
            );
            return (
              <li
                key={`${it.workflow}:${it.id}`}
                className={cn(
                  "flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-x-3 gap-y-1.5 px-3 sm:px-4 py-2.5",
                  urgent && "bg-rose-50/40",
                )}
              >
                <PriorityChip priority={it.priority} />
                <div className="min-w-0 flex-1 order-3 sm:order-none basis-full sm:basis-auto">
                  {href
                    ? <Link to={href} className="hover:text-primary block truncate">{titleNode}</Link>
                    : <div className="truncate">{titleNode}</div>}
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    <span className="uppercase tracking-wide text-[10.5px] font-medium">{it.workflow}</span>
                    <span className="mx-1 text-muted-foreground/60">·</span>
                    {itemSubLabel(it)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:ml-0">
                  <StatusBadge workflow={it.workflow} state={bindStatus(it.workflow, it.state)} />
                  <SLAIndicator workflow={it.workflow} state={it.state}
                    enteredAt={parseEnteredAt(it.enteredAt)} />
                  {renderActions?.(it)}
                </div>
              </li>
            );
          })}
          {more > 0 && (
            <li className="px-4 py-2 text-[11.5px] text-muted-foreground bg-muted/30">
              +{more} more in queue
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
