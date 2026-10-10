import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, MapPin, User } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { bindStatus } from "@/lib/workflow-bind";
import type { BookingEntity } from "@/lib/domain";
import { bookingRef, isPastBooking, needsPayment, relativeWhen, whenParts } from "@/lib/booking-view";

const RAIL: Record<string, string> = {
  emerald: "bg-emerald-500", primary: "bg-primary", muted: "bg-muted-foreground/30", rose: "bg-rose-500", amber: "bg-amber-500",
};

/** One consistent booking row for Home, Bookings, Notifications and Patients. */
export function BookingRow({
  b, tone = "primary", showPatient = true,
}: { b: BookingEntity; tone?: keyof typeof RAIL; showPatient?: boolean }) {
  const when = whenParts(b.startedAt);
  const rel = relativeWhen(b.startedAt);
  const past = isPastBooking(b);
  const unpaidExpired = past && b.rawStatus === "pending_payment";
  const pay = needsPayment(b);
  return (
    <Link
      to="/consumer/bookings/$bookingId"
      params={{ bookingId: b.id }}
      className="group flex items-stretch gap-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
    >
      <span className={`w-1 shrink-0 ${RAIL[tone]}`} aria-hidden />
      <div className="flex flex-1 items-center gap-3 py-3 pr-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13.5px] font-semibold text-foreground truncate">{b.service ?? "Care visit"}</span>
            <span className="hidden sm:inline text-[10.5px] font-mono text-muted-foreground shrink-0">{bookingRef(b)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
            {showPatient && b.patientName && b.patientName !== "—" && (
              <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{b.patientName}</span>
            )}
            {when && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />{when.date} · {when.time}
                {rel && !past && <span className="text-primary font-medium">({rel})</span>}
              </span>
            )}
            {b.area && b.area !== "—" && (
              <span className="hidden md:inline-flex items-center gap-1 truncate max-w-[220px]"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{b.area}</span></span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unpaidExpired
            ? <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Expired · not paid</span>
            : past && b.rawStatus !== "missed" && b.rawStatus !== "completed" && b.rawStatus !== "cancelled"
              ? <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Not completed</span>
              : <StatusBadge workflow="booking" state={bindStatus("booking", b.rawStatus)} />}
          {pay && <span className="hidden sm:inline rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">Pay now</span>}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </div>
      </div>
    </Link>
  );
}
