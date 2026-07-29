import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, MapPin, IndianRupee, Award, ChevronRight, CalendarCheck, Activity, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/")({
  component: WorkerHome,
});

type Badge = { id: string; code: string; label: string; tier: string | null; source: string };
type BookingRow = {
  id: string;
  scheduled_date: string;
  scheduled_start_time: string;
  status: string;
  patient_name?: string | null;
  service_name?: string | null;
};
type TodayVisit = { id: string; patient: string; service: string; time: string; status: string };

function formatTime(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

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

function AvailabilityToggle() {
  const [availability, setAvailability] = useState<"online" | "offline" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/workers/me")
      .then((data) => setAvailability(data?.availability === "online" ? "online" : "offline"))
      .catch(() => setAvailability("offline"));
  }, []);

  const toggle = async () => {
    const next = availability === "online" ? "offline" : "online";
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/workers/me/availability", {
        method: "PUT",
        body: JSON.stringify({ availability: next }),
      });
      setAvailability(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update availability");
    } finally {
      setLoading(false);
    }
  };

  if (availability === null) {
    return <div className="rounded-xl border border-border bg-card px-5 py-4 h-[68px] animate-pulse" />;
  }

  const isOnline = availability === "online";

  return (
    <div className={cn(
      "rounded-xl border px-5 py-4 flex items-center justify-between gap-4 transition-all",
      isOnline ? "border-emerald-200 bg-emerald-50" : "border-border bg-card"
    )}>
      <div className="flex items-center gap-3">
        <span className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
          isOnline ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
        )}>
          {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
        </span>
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {isOnline ? "You are Online" : "You are Offline"}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            {isOnline ? "Accepting new assignments" : "Not visible to patients"}
          </p>
          {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none",
          isOnline ? "bg-emerald-500" : "bg-gray-300",
          loading && "opacity-60 cursor-not-allowed"
        )}
        aria-label="Toggle availability"
      >
        <span className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
          isOnline ? "translate-x-6" : "translate-x-1"
        )} />
      </button>
    </div>
  );
}

function WorkerHome() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [assignments, setAssignments] = useState<number | string>("—");
  const [earnings, setEarnings] = useState<string>("—");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [todayVisits, setTodayVisits] = useState<TodayVisit[]>([]);
  const [todayVisitsCount, setTodayVisitsCount] = useState<number | string>("—");

  useEffect(() => {
    // Each call degrades independently so one failure never blanks the page.
    apiFetch("/api/bookings/available")
      .then((rows) => setAssignments(Array.isArray(rows) ? rows.length : 0))
      .catch(() => setAssignments("—"));

    // Earnings: show what the nurse has actually earned so far — paid plus
    // pending. A just-completed visit's payout is pending until admin
    // processes it, and it should still count toward "earnings", otherwise a
    // nurse who finished visits today sees ₹0.
    apiFetch("/api/workers/me/earnings")
      .then((e) => {
        const total = Number(e?.total_paid ?? 0) + Number(e?.total_pending ?? 0);
        setEarnings(`₹${total.toLocaleString("en-IN")}`);
      })
      .catch(() => setEarnings("—"));

    apiFetch("/api/workers/me/badges")
      .then((b) => setBadges(Array.isArray(b) ? b : []))
      .catch(() => setBadges([]));

    // Today's visits: the worker's accepted bookings scheduled for today that
    // aren't already finished/cancelled. Drives both the count card and the
    // schedule list below, which were previously hardcoded to "—" / empty.
    apiFetch("/api/bookings/worker")
      .then((rows: BookingRow[]) => {
        const list = Array.isArray(rows) ? rows : [];
        const todayStr = new Date().toISOString().slice(0, 10);
        const done = ["completed", "cancelled", "missed"];
        const today = list
          .filter((b) => b.scheduled_date === todayStr && !done.includes(b.status))
          .sort((a, b) => (a.scheduled_start_time || "").localeCompare(b.scheduled_start_time || ""))
          .map((b) => ({
            id: b.id,
            patient: b.patient_name || "Patient",
            service: b.service_name || "Home visit",
            time: (b.scheduled_start_time || "").slice(0, 5),
            status: b.status,
          }));
        setTodayVisits(today);
        setTodayVisitsCount(today.length);
      })
      .catch(() => {
        setTodayVisits([]);
        setTodayVisitsCount("—");
      });
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

        {/* Online/Offline toggle */}
        <AvailabilityToggle />

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
          <StatCard label="Today's Visits" value={todayVisitsCount} icon={MapPin} tone="success" href="/partner/visits" />
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
          {todayVisits.length === 0 ? (
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
          ) : (
            <ul className="divide-y divide-border">
              {todayVisits.map((v) => (
                <li key={v.id}>
                  <Link
                    to="/partner/visits/$visitId"
                    params={{ visitId: v.id }}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 text-[12px] font-bold">
                      {formatTime(v.time)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-foreground truncate">{v.patient}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{v.service}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium capitalize text-muted-foreground">
                      {v.status.replace(/_/g, " ")}
                    </span>
                    <ChevronRight size={15} className="text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
