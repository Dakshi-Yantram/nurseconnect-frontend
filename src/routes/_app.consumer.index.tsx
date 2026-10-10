import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { BookingRow } from "@/components/consumer/BookingRow";
import { useAuth } from "@/lib/auth-context";
import { useConsumerPatients, useBookings, type BookingEntity } from "@/lib/domain";
import { bucketOf, needsPayment, relativeWhen, whenParts, bookingRef } from "@/lib/booking-view";
import {
  CalendarCheck, ChevronRight, AlertTriangle, Clock, HeartPulse, History as HistoryIcon,
  Plus, Wallet, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_app/consumer/")({
  component: ConsumerHome,
  head: () => ({ meta: [{ title: "My Care — NurseConnect" }] }),
});

// Sections come from one shared rule (lib/booking-view.ts → bucketOf) so Home,
// Bookings, Patients and Notifications can never disagree. useBookings() is
// already server-scoped to the logged-in consumer.
function useCare() {
  const bookings = useBookings();
  return useMemo(() => {
    const by = (k: string) => bookings.filter((b) => bucketOf(b) === k);
    const upcoming = by("upcoming").sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
    return {
      all: bookings,
      upcoming,
      inCare: by("in_care"),
      review: by("review"),
      notCompleted: by("not_completed").sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")),
      done: by("done").sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")),
      toPay: bookings.filter(needsPayment),
    };
  }, [bookings]);
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function ConsumerHome() {
  const { user } = useAuth();
  const care = useCare();
  const patients = useConsumerPatients(user?.id ?? null).slice(0, 4);
  const first = user?.name?.split(" ")[0];
  const next = care.upcoming[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[20px] font-semibold leading-tight">{greeting()}{first ? `, ${first}` : ""}</div>
          <div className="text-[12.5px] text-muted-foreground mt-0.5">Here's where your family's care stands today.</div>
        </div>
        <Link
          to="/consumer/bookings"
          search={{ new: true }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New booking
        </Link>
      </div>

      {/* Needs attention */}
      {(care.review.length > 0 || care.toPay.length > 0) && (
        <div className="space-y-2">
          {care.review.length > 0 && (
            <Link to="/consumer/bookings/$bookingId" params={{ bookingId: care.review[0].id }}
              className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 hover:bg-rose-100/60">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-rose-800">Your care team is reviewing a visit</div>
                <div className="text-[12px] text-rose-700/80 truncate">{care.review[0].service} · {care.review[0].patientName}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-rose-600" />
            </Link>
          )}
          {care.toPay.length > 0 && (
            <Link to="/consumer/bookings/$bookingId" params={{ bookingId: care.toPay[0].id }}
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100/60">
              <Wallet className="h-5 w-5 text-amber-700 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-amber-900">
                  {care.toPay.length === 1 ? "1 booking is waiting for payment" : `${care.toPay.length} bookings are waiting for payment`}
                </div>
                <div className="text-[12px] text-amber-800/80">Pay now so we can send a nurse.</div>
              </div>
              <span className="rounded-full bg-amber-700 px-3 py-1 text-[11.5px] font-semibold text-white">Pay now</span>
            </Link>
          )}
        </div>
      )}

      {/* Next visit hero */}
      {next && (
        <Link to="/consumer/bookings/$bookingId" params={{ bookingId: next.id }}
          className="block rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 hover:bg-primary/10 transition-colors">
          <div className="text-[10.5px] uppercase tracking-wide font-semibold text-primary">Next visit</div>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-foreground truncate">{next.service}</div>
              <div className="text-[12.5px] text-muted-foreground">
                For {next.patientName} · {bookingRef(next)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-semibold text-foreground">
                {whenParts(next.startedAt)?.date} · {whenParts(next.startedAt)?.time}
              </div>
              {relativeWhen(next.startedAt) && <div className="text-[12px] font-medium text-primary">{relativeWhen(next.startedAt)}</div>}
            </div>
          </div>
        </Link>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="In care now" value={care.inCare.length} hint="Visits underway" tone="text-emerald-700 bg-emerald-50 border-emerald-200" />
        <Tile label="Upcoming" value={care.upcoming.length} hint="Scheduled next" tone="text-primary bg-primary/5 border-primary/20" />
        <Tile label="Completed" value={care.done.filter((b) => b.rawStatus === "completed").length} hint="Visits delivered" tone="text-foreground bg-muted border-border" />
        <Tile label="Needs review" value={care.review.length} hint="Open with care team" tone="text-rose-700 bg-rose-50 border-rose-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RuntimeBoundary label="In care now">
          <Section
            icon={<HeartPulse className="h-4 w-4 text-emerald-600" />} title="In care now"
            rows={care.inCare.slice(0, 5)} tone="emerald"
            empty="No visit is in progress" hint="When a nurse is on the way or with the patient, it shows here."
          />
        </RuntimeBoundary>
        <RuntimeBoundary label="Upcoming care">
          <Section
            icon={<Clock className="h-4 w-4 text-primary" />} title="Upcoming"
            action={<Link to="/consumer/bookings" className="text-primary">View all</Link>}
            rows={care.upcoming.slice(0, 5)} tone="primary"
            empty="No upcoming visits" hint="Book a care package and it will appear here."
          />
        </RuntimeBoundary>
      </div>

      <RuntimeBoundary label="Recently completed">
        <Section
          icon={<HistoryIcon className="h-4 w-4 text-muted-foreground" />} title="Recently completed"
          action={<Link to="/consumer/bookings" className="text-primary">Full history</Link>}
          rows={care.done.slice(0, 4)} tone="muted"
          empty="No completed visits yet" hint="Finished visits will be listed here."
        />
      </RuntimeBoundary>

      {care.notCompleted.length > 0 && (
        <RuntimeBoundary label="Not completed">
          <Section
            icon={<HistoryIcon className="h-4 w-4 text-amber-600" />} title="Expired or missed"
            rows={care.notCompleted.slice(0, 3)} tone="amber"
            empty="" hint="Bookings whose time passed without payment or a visit."
          />
        </RuntimeBoundary>
      )}

      <RuntimeBoundary label="Patients">
        <Card
          title="Your patients"
          action={<Link to="/consumer/patients" className="text-primary inline-flex items-center gap-1">Manage <ArrowRight className="h-3 w-3" /></Link>}
          padded={false}
        >
          {patients.length === 0 ? (
            <div className="p-5"><EmptyState title="No patients yet" /></div>
          ) : patients.map((p) => {
            const mine = care.all.filter((b) => b.patientId === p.id);
            const up = mine.filter((b) => bucketOf(b) === "upcoming").length;
            const done = mine.filter((b) => b.rawStatus === "completed").length;
            return (
              <Link key={p.id} to="/consumer/patients/$patientId" params={{ patientId: p.id }}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-[13px] font-semibold shrink-0">
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{p.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">{up} upcoming · {done} completed</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            );
          })}
        </Card>
      </RuntimeBoundary>
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="text-[10.5px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-[24px] font-semibold leading-tight mt-0.5">{value}</div>
      <div className="text-[11px] opacity-75 mt-0.5">{hint}</div>
    </div>
  );
}

function Section({
  icon, title, action, rows, tone, empty, hint,
}: {
  icon: React.ReactNode; title: string; action?: React.ReactNode;
  rows: BookingEntity[]; tone: "primary" | "emerald" | "muted" | "amber";
  empty: string; hint?: string;
}) {
  return (
    <Card title={<span className="flex items-center gap-2">{icon} {title}</span>} action={action} padded={false}>
      {rows.length === 0
        ? <div className="p-5"><EmptyState icon={CalendarCheck} title={empty} description={hint} /></div>
        : rows.map((b) => <BookingRow key={b.id} b={b} tone={tone} />)}
    </Card>
  );
}
