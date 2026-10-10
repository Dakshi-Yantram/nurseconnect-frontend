import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/shared/Card";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useIncidents, useBookings, type BookingEntity } from "@/lib/domain";
import { bookingRef, isPastBooking, needsPayment, relativeWhen, whenParts } from "@/lib/booking-view";
import {
  Bell, ChevronRight, AlertTriangle, CheckCircle2, Clock, CreditCard, Stethoscope, XCircle, Search, CalendarCheck,
} from "lucide-react";

export const Route = createFileRoute("/_app/consumer/notifications")({
  component: ConsumerNotifications,
  head: () => ({ meta: [{ title: "Notifications — NurseConnect" }] }),
});

type Item = { b: BookingEntity; icon: typeof Bell; tone: string; title: string; text: string; sort: number };

/** Turn a booking's current state into a plain-language update. */
function describe(b: BookingEntity): Item {
  const when = whenParts(b.startedAt);
  const at = when ? `${when.date} at ${when.time}` : "";
  const rel = relativeWhen(b.startedAt);
  const svc = b.service ?? "Care visit";
  const who = b.patientName && b.patientName !== "—" ? ` for ${b.patientName}` : "";
  const sort = Date.parse((b.startedAt ?? "").replace(" ", "T")) || 0;
  const mk = (icon: Item["icon"], tone: string, title: string, text: string, rank = 0): Item =>
    ({ b, icon, tone, title, text, sort: rank * 1e13 + sort });

  if (needsPayment(b)) return mk(CreditCard, "text-amber-700 bg-amber-50", "Payment pending", `${svc}${who} · ${at}. Pay to confirm your nurse.`, 9);
  switch (b.rawStatus) {
    case "pending_payment":
      return mk(XCircle, "text-muted-foreground bg-muted", "Booking expired", `${svc}${who} was not paid before ${at}.`, 1);
    case "prescription_pending":
      return mk(Stethoscope, "text-amber-700 bg-amber-50", "Prescription under review", `${svc}${who}. We'll confirm once it is verified.`, 8);
    case "searching_nurse":
      return mk(Search, "text-sky-700 bg-sky-50", "Finding your nurse", `${svc}${who} · ${at}.`, 7);
    case "confirmed": case "assigned":
      if (isPastBooking(b)) return mk(XCircle, "text-muted-foreground bg-muted", "Visit not completed", `${svc}${who} · ${at}.`, 1);
      return mk(CheckCircle2, "text-emerald-700 bg-emerald-50", b.rawStatus === "assigned" ? "Nurse assigned" : "Booking confirmed", `${svc}${who} · ${at}${rel ? ` (${rel})` : ""}.`, 6);
    case "worker_en_route":
      return mk(Clock, "text-primary bg-primary/10", "Your nurse is on the way", `${svc}${who}. Keep your start code ready.`, 10);
    case "worker_arrived":
      return mk(Clock, "text-primary bg-primary/10", "Your nurse has arrived", `${svc}${who}. Share the start code to begin.`, 10);
    case "in_progress":
      return mk(Clock, "text-emerald-700 bg-emerald-50", "Visit in progress", `${svc}${who}.`, 10);
    case "completed":
      return mk(CheckCircle2, "text-emerald-700 bg-emerald-50", "Visit completed", `${svc}${who} · ${at}. Your care summary is ready.`, 2);
    case "cancelled":
      return mk(XCircle, "text-muted-foreground bg-muted", "Booking cancelled", `${svc}${who} · ${at}.`, 1);
    case "missed":
      return mk(XCircle, "text-rose-700 bg-rose-50", "Visit missed", `${svc}${who} · ${at}.`, 1);
    case "disputed": case "quality_discrepancy_alert":
      return mk(AlertTriangle, "text-rose-700 bg-rose-50", "Under review", `Your care team is reviewing ${svc}${who}.`, 11);
    default:
      return mk(CalendarCheck, "text-muted-foreground bg-muted", "Booking update", `${svc}${who}.`, 3);
  }
}

type ServerNotification = {
  id: string; title?: string | null; body?: string | null; created_at: string;
  read_at?: string | null; payload?: { booking_id?: string } | null;
};

function ConsumerNotifications() {
  const allIncidents = useIncidents();
  const bookings = useBookings();
  const navigate = useNavigate();

  // The real notification inbox (e.g. "Visit report is ready"). This page used
  // to build everything from booking state and never read it.
  const [inbox, setInbox] = useState<ServerNotification[]>([]);
  useEffect(() => {
    let live = true;
    apiFetch("/api/notifications/")
      .then((r: any) => { if (live && Array.isArray(r)) setInbox(r); })
      .catch(() => { /* the booking-based updates below still render */ });
    return () => { live = false; };
  }, []);

  const openNotification = async (n: ServerNotification) => {
    if (!n.read_at) {
      setInbox((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    }
    const bid = n.payload?.booking_id;
    if (bid) navigate({ to: "/consumer/bookings/$bookingId", params: { bookingId: bid } });
  };

  const incidents = useMemo(
    () => allIncidents
      .map((i) => ({ i, bookingId: i.bookingId ?? bookings.find((b) => b.patientId && b.patientId === i.patientId)?.id }))
      .filter((x) => x.bookingId)
      .slice(0, 4),
    [allIncidents, bookings],
  );

  const items = useMemo(() => bookings.map(describe).sort((a, b) => b.sort - a.sort), [bookings]);
  const action = items.filter((x) => x.sort >= 6e13);
  const earlier = items.filter((x) => x.sort < 6e13);

  const row = (x: Item) => (
    <Link key={x.b.id} to="/consumer/bookings/$bookingId" params={{ bookingId: x.b.id }}
      className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <span className={`mt-0.5 h-8 w-8 rounded-full grid place-items-center shrink-0 ${x.tone}`}><x.icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-foreground">{x.title}</div>
        <div className="text-[12px] text-muted-foreground">{x.text}</div>
        <div className="mt-0.5 text-[10.5px] font-mono text-muted-foreground/70">{bookingRef(x.b)}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[18px] font-semibold">Notifications</div>
        <div className="text-[12.5px] text-muted-foreground">Updates on your bookings and your patients' care.</div>
      </div>

      {incidents.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /> Care alerts</span>} padded={false}>
          {incidents.map(({ i, bookingId }) => (
            <Link key={i.id} to="/consumer/bookings/$bookingId" params={{ bookingId: bookingId! }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{i.title}</div>
                <div className="text-[11.5px] text-muted-foreground">Our care team is following up.</div>
              </div>
              <SeverityBadge severity={i.severity} />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </Card>
      )}

      {inbox.length > 0 && (
        <Card title="Messages" padded={false}>
          {inbox.slice(0, 15).map((n) => (
            <button key={n.id} type="button" onClick={() => openNotification(n)}
              className="w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <span className="mt-0.5 h-8 w-8 rounded-full grid place-items-center shrink-0 text-primary bg-primary/10"><Bell className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-semibold text-foreground">{n.title || "Update"}</div>
                  {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                </div>
                {n.body && <div className="text-[12px] text-muted-foreground line-clamp-2">{n.body}</div>}
                <div className="mt-0.5 text-[10.5px] text-muted-foreground/70">
                  {new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
            </button>
          ))}
        </Card>
      )}

      {items.length === 0 && inbox.length === 0 ? (
        <Card><EmptyState icon={Bell} title="You're all caught up" description="Updates for your bookings will appear here." /></Card>
      ) : (
        <>
          {action.length > 0 && <Card title="Needs your attention" padded={false}>{action.map(row)}</Card>}
          {earlier.length > 0 && <Card title="Earlier updates" padded={false}>{earlier.map(row)}</Card>}
        </>
      )}
    </div>
  );
}
