import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, MapPin, IndianRupee, Award, ChevronRight, CalendarCheck, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/")({
  component: WorkerHome,
});

type Badge = { id: string; code: string; label: string; tier: string | null; source: string };

function StatCard({
  label, value, icon: Icon, tone, href,
}: {
  label: string; value: string | number; icon: React.ElementType;
  tone: "primary" | "success" | "warning" | "purple"; href?: string;
}) {
  const toneMap = {
    primary: { wrap: "border-primary/15 bg-primary/5", icon: "bg-primary/10 text-primary", value: "text-primary" },
    success: { wrap: "border-emerald-100 bg-emerald-50", icon: "bg-emerald-100 text-emerald-600", value: "text-emerald-700" },
    warning: { wrap: "border-amber-100 bg-amber-50", icon: "bg-amber-100 text-amber-600", value: "text-amber-700" },
    purple: { wrap: "border-purple-100 bg-purple-50", icon: "bg-purple-100 text-purple-600", value: "text-purple-700" },
  }[tone];

  const inner = (
    <div className={cn("rounded-xl border px-5 py-4 flex items-start gap-4 transition-all", toneMap.wrap, href && "hover:shadow-sm cursor-pointer")}>
      <span className={cn("mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", toneMap.icon)}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("text-[26px] font-bold leading-tight mt-0.5", toneMap.value)}>{value}</p>
      </div>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function WorkerHome() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [assignments, setAssignments] = useState<number | string>("—");
  const [earnings, setEarnings] = useState<string>("—");
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    // Each call degrades independently so one failure never blanks the page.
    apiFetch("/api/bookings/available")
      .then((rows) => setAssignments(Array.isArray(rows) ? rows.length : "—"))
      .catch(() => setAssignments("—"));
    apiFetch("/api/workers/me/earnings")
      .then((e) => {
        const amt = e?.total_paid ?? null;
        setEarnings(amt != null ? `₹${Number(amt).toLocaleString("en-IN")}` : "—");
      })
      .catch(() => setEarnings("—"));
    apiFetch("/api/workers/me/badges")
      .then((b) => setBadges(Array.isArray(b) ? b : []))
      .catch(() => setBadges([]));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">
        {/* Welcome */}
        <div className="rounded-xl border border-primary/15 bg-primary/5 px-5 py-4 flex items-center gap-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[15px]">
            {user?.name?.charAt(0) ?? "C"}
          </span>
          <div>
            <p className="text-[16px] font-bold text-foreground">{greeting}, {user?.name ?? "Care Professional"}</p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Here's your workspace overview for today</p>
          </div>
        </div>

        {/* Skill badges */}
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Award size={15} className="text-primary" />
              <span className="text-[14px] font-bold text-foreground">Your Skill Badges</span>
            </div>
            <Link to="/partner/services" className="text-[12px] font-medium text-primary hover:underline">
              Choose services →
            </Link>
          </div>
          <div className="px-5 py-4">
            {badges.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No badges yet. Pass training assessments to earn skill badges and unlock services.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[12px] font-semibold text-primary">
                    <Award size={12} /> {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPIs — links now point at /partner/* (the real routes) */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Open Assignments" value={assignments} icon={Briefcase} tone="primary" href="/partner/assignments" />
          <StatCard label="Today's Visits" value="—" icon={MapPin} tone="success" href="/partner/visits" />
          <StatCard label="Earnings This Month" value={earnings} icon={IndianRupee} tone="warning" href="/partner/earnings" />
          <StatCard label="Skill Badges" value={badges.length} icon={Award} tone="purple" href="/partner/services" />
        </div>

        {/* Schedule */}
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarCheck size={15} className="text-primary" />
              <span className="text-[14px] font-bold text-foreground">Today's Schedule</span>
            </div>
            <Link to="/partner/visits" className="text-[12px] font-medium text-primary hover:underline">View all →</Link>
          </div>
          <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Activity size={18} className="text-muted-foreground" />
            </span>
            <p className="text-[13.5px] font-semibold text-foreground">No visits scheduled for today</p>
            <p className="text-[12px] text-muted-foreground">Check Assignments for available shifts</p>
            <Link to="/partner/assignments" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90">
              Browse assignments <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
