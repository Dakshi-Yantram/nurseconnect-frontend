import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ADMIN_PAYOUTS } from "@/lib/domain";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { bindStatus } from "@/lib/workflow-bind";
import {
  IndianRupee,
  Wallet,
  BadgeCheck,
  TrendingUp,
  CalendarClock,
  Info,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/worker/earnings")({
  component: WorkerEarnings,
  head: () => ({ meta: [{ title: "Earnings — NurseConnect" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "daily" | "monthly" | "yearly";

// ─── Mock data per period (replace with real API calls) ───────────────────────

const PERIOD_STATS: Record<
  Period,
  { lifetime: string; pending: string; pendingLabel: string }
> = {
  daily: {
    lifetime: "₹6,200",
    pending: "₹1,100",
    pendingLabel: "Processing today",
  },
  monthly: {
    lifetime: "₹82,400",
    pending: "₹18,400",
    pendingLabel: "Processing this week",
  },
  yearly: {
    lifetime: "₹4,82,000",
    pending: "₹38,900",
    pendingLabel: "Processing this month",
  },
};

// Filter payouts by period relative to today
function filterPayouts(
  payouts: typeof ADMIN_PAYOUTS,
  period: Period
): typeof ADMIN_PAYOUTS {
  const now = new Date();
  return payouts.filter((p) => {
    const d = new Date(p.date);
    if (period === "daily") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    if (period === "monthly") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    }
    // yearly
    return d.getFullYear() === now.getFullYear();
  });
}

// ─── Period tab ───────────────────────────────────────────────────────────────

function PeriodTabs({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const tabs: { key: Period; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-150",
            value === t.key
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar size={11} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: "success" | "warning" | "primary";
  sub?: string;
}) {
  const toneMap = {
    success: {
      bg: "bg-emerald-50 border-emerald-100",
      icon: "bg-emerald-100 text-emerald-600",
      value: "text-emerald-700",
    },
    warning: {
      bg: "bg-amber-50 border-amber-100",
      icon: "bg-amber-100 text-amber-600",
      value: "text-amber-700",
    },
    primary: {
      bg: "bg-primary/5 border-primary/15",
      icon: "bg-primary/10 text-primary",
      value: "text-primary",
    },
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4 flex items-start gap-4",
        toneMap.bg
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
          toneMap.icon
        )}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "text-[24px] font-bold leading-tight mt-0.5",
            toneMap.value
          )}
        >
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Payout row ───────────────────────────────────────────────────────────────

function PayoutRow({
  payout,
  last,
}: {
  payout: (typeof ADMIN_PAYOUTS)[number];
  last: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/30",
        !last && "border-b border-border"
      )}
    >
      {/* Timeline dot */}
      <div className="mt-1 flex flex-col items-center gap-1 flex-shrink-0">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            payout.status === "approved" ? "bg-emerald-500" : "bg-amber-400"
          )}
        />
        {!last && (
          <span className="w-px flex-1 bg-border min-h-[28px]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13.5px] font-semibold text-foreground">
              {payout.batch} — {payout.net}
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {payout.nurses} nurses · gross {payout.gross} · commission{" "}
              {payout.commission}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <StatusBadge
              workflow="payout"
              state={bindStatus("payout", payout.status)}
            />
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClock size={11} />
              {payout.date}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyPayouts({ period }: { period: Period }) {
  const label =
    period === "daily"
      ? "today"
      : period === "monthly"
      ? "this month"
      : "this year";
  return (
    <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
      No payout records {label}.
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function WorkerEarnings() {
  const [period, setPeriod] = useState<Period>("monthly");

  const allPayouts = ADMIN_PAYOUTS;
  const payouts = useMemo(
    () => filterPayouts(allPayouts, period),
    [allPayouts, period]
  );

  const completed = payouts.filter((p) => p.status === "approved");
  const pending = payouts.filter((p) => p.status !== "approved");
  const stats = PERIOD_STATS[period];

  const periodLabel =
    period === "daily" ? "Today" : period === "monthly" ? "This Month" : "This Year";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[17px] font-bold text-foreground tracking-tight">
              Earnings
            </h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              Your payout summary and transaction history
            </p>
          </div>
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>

        {/* Period label pill */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11.5px] font-semibold text-primary">
            <Calendar size={11} />
            {periodLabel}
          </span>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label={
              period === "daily"
                ? "Today's earnings"
                : period === "monthly"
                ? "Monthly earnings"
                : "Yearly earnings"
            }
            value={stats.lifetime}
            icon={IndianRupee}
            tone="success"
            sub={
              period === "daily"
                ? "For today"
                : period === "monthly"
                ? "This month"
                : "This year"
            }
          />
          <StatCard
            label="Pending payout"
            value={stats.pending}
            icon={Wallet}
            tone="warning"
            sub={stats.pendingLabel}
          />
          <StatCard
            label="Completed payouts"
            value={completed.length}
            icon={BadgeCheck}
            tone="primary"
            sub={`${pending.length} pending`}
          />
        </div>

        {/* Payout history */}
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-primary" />
              <span className="text-[14px] font-bold text-foreground">
                Payout history
              </span>
            </div>
            <span className="text-[11.5px] text-muted-foreground">
              {payouts.length} transaction{payouts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Rows */}
          {payouts.length === 0 ? (
            <EmptyPayouts period={period} />
          ) : (
            payouts.map((p, i) => (
              <PayoutRow key={p.id} payout={p} last={i === payouts.length - 1} />
            ))
          )}
        </div>

        {/* Notes */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-5 py-4">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Payouts settle weekly. Reconciliation runs every Sunday at 23:00 IST.
          </p>
        </div>

      </div>
    </div>
  );
}