import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useIncidents, useBookings } from "@/lib/domain";
import { bindStatus } from "@/lib/workflow-bind";
import { Bell, ChevronRight, AlertTriangle, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_app/consumer/notifications")({
  component: ConsumerNotifications,
  head: () => ({ meta: [{ title: "Notifications — NurseConnect" }] }),
});

function ConsumerNotifications() {
  const allIncidents = useIncidents();
  const bookings = useBookings();

  const bookingPriority: Record<string, number> = {
    escalated: 0,
    active: 1,
    in_progress: 2,
    claimed: 3,
    pending_payment: 4,
    pending: 5,
    completed: 6,
  };

  const bookingByPatientId = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((booking) => {
      if (booking.patientId && !map.has(booking.patientId)) {
        map.set(booking.patientId, booking.id);
      }
    });
    return map;
  }, [bookings]);

  const resolveBookingIdForIncident = (incident: ReturnType<typeof useIncidents>[number]) => {
    if ((incident as any).bookingId) return String((incident as any).bookingId);

    if (incident.patientId) {
      const byPatientId = bookings
        .filter((booking) => booking.patientId === incident.patientId)
        .sort((a, b) => (bookingPriority[a.rawStatus] ?? 99) - (bookingPriority[b.rawStatus] ?? 99))[0];
      if (byPatientId) return byPatientId.id;

      const mapped = bookingByPatientId.get(incident.patientId);
      if (mapped) return mapped;
    }

    const patientName = incident.title.split("—").pop()?.trim();
    if (!patientName) return undefined;

    return bookings.find(
      (booking) => booking.patientName.toLowerCase() === patientName.toLowerCase(),
    )?.id;
  };

  // Only show alerts that actually link somewhere — avoids rendering
  // dead-end rows for demo/seed incidents unrelated to this consumer.
  const incidents = useMemo(() => {
    return allIncidents
      .map((i) => ({ incident: i, bookingId: resolveBookingIdForIncident(i) }))
      .filter((x) => x.bookingId)
      .slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIncidents, bookings]);

  return (
    <div className="space-y-6">
      <Card
        title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /> Care alerts</span>}
        padded={false}
      >
        {incidents.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Bell} title="No active alerts" description="Clinical alerts for your patients will appear here." />
          </div>
        ) : (
          incidents.map(({ incident: i, bookingId }) => (
            <Link
              key={i.id}
              to="/consumer/bookings/$bookingId"
              params={{ bookingId: bookingId! }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{i.title}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {i.id} · reporter {i.reporter}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SeverityBadge severity={i.severity} />
                <StatusBadge workflow="incident" state={bindStatus("incident", i.rawStatus)} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </Card>

      {/* Booking updates section unchanged */}
      <Card
        title={<span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-primary" /> Booking updates</span>}
        padded={false}
      >
        {bookings.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={CalendarCheck} title="No booking updates" description="Updates for your bookings will appear here." />
          </div>
        ) : (
          bookings.map(b => (
            <Link
              key={b.id}
              to="/consumer/bookings/$bookingId"
              params={{ bookingId: b.id }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">
                  #{b.id} — {b.service}
                </div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {b.patientName} · {b.area}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge workflow="booking" state={bindStatus("booking", b.rawStatus)} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}