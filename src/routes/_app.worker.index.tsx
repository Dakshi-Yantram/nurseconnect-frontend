import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, MapPin, IndianRupee, Clock, ChevronRight, CalendarCheck, Activity, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/worker/")({
  component: WorkerHome,
});

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: "primary" | "success" | "warning" | "purple";
  href?: string;
}) {
  const toneMap = {
    primary: { wrap: "border-primary/15 bg-primary/5",   icon: "bg-primary/10 text-primary",       value: "text-primary"    },
    success: { wrap: "border-emerald-100 bg-emerald-50", icon: "bg-emerald-100 text-emerald-600",  value: "text-emerald-700" },
    warning: { wrap: "border-amber-100 bg-amber-50",     icon: "bg-amber-100 text-amber-600",      value: "text-amber-700"  },
    purple:  { wrap: "border-purple-100 bg-purple-50",   icon: "bg-purple-100 text-purple-600",    value: "text-purple-700" },
  }[tone];

  const inner = (
    <div className={cn("rounded-xl border px-5 py-4 flex items-start gap-4 transition-all", toneMap.wrap, href && "hover:shadow-sm hover:scale-[1.01] cursor-pointer")}>
      <span className={cn("mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", toneMap.icon)}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("text-[26px] font-bold leading-tight mt-0.5", toneMap.value)}>{value}</p>
      </div>
      {href && <ArrowUpRight size={14} className="mt-1 flex-shrink-0 text-muted-foreground/50" />}
    </div>
  );

  return href ? <Link to={href}>{inner}</Link> : inner;
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickAction({ label, sub, icon: Icon, href }: { label: string; sub: string; icon: React.ElementType; href: string }) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-primary/30 hover:bg-muted/40 transition-all group"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11.5px] text-muted-foreground">{sub}</p>
      </div>
      <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
    </Link>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function WorkerHome() {
  const { user } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        {/* Welcome banner */}
        <div className="rounded-xl border border-primary/15 bg-primary/5 px-5 py-4 flex items-center gap-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[15px]">
            {user?.name?.charAt(0) ?? "C"}
          </span>
          <div>
            <p className="text-[16px] font-bold text-foreground">{greeting}, {user?.name ?? "Care Professional"}</p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Here's your workspace overview for today</p>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Open Assignments"    value="4"        icon={Briefcase}    tone="primary"  href="/worker/assignments" />
          <StatCard label="Today's Visits"      value="2"        icon={MapPin}       tone="success"  href="/worker/visits" />
          <StatCard label="Earnings This Month" value="₹18,500"  icon={IndianRupee}  tone="warning"  href="/worker/earnings" />
          <StatCard label="Hours Logged"        value="64h"      icon={Clock}        tone="purple" />
        </div>

        {/* Today's schedule */}
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarCheck size={15} className="text-primary" />
              <span className="text-[14px] font-bold text-foreground">Today's Schedule</span>
            </div>
            <Link to="/worker/visits" className="text-[12px] font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Activity size={18} className="text-muted-foreground" />
            </span>
            <p className="text-[13.5px] font-semibold text-foreground">No visits scheduled for today</p>
            <p className="text-[12px] text-muted-foreground">Check Assignments for available shifts</p>
            <Link
              to="/worker/assignments"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Browse assignments
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Quick actions</p>
          <div className="space-y-2">
            <QuickAction label="Documentation"  sub="Submit visit notes and checklists"  icon={Briefcase}   href="/worker/documentation" />
            <QuickAction label="Availability"   sub="Manage your weekly schedule"        icon={CalendarCheck} href="/worker/availability" />
            <QuickAction label="Earnings"       sub="View payout history and summary"    icon={IndianRupee} href="/worker/earnings" />
          </div>
        </div>

      </div>
    </div>
  );
}