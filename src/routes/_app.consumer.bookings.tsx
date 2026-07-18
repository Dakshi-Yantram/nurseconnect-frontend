import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { Modal } from "@/components/shared/Modal";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { WorkflowActionButton } from "@/components/shared/WorkflowActionButton";
import { SchemaForm } from "@/lib/forms/SchemaForm";
import { BOOKING_REQUEST_SCHEMA } from "@/lib/forms/templates";
import type { FormSchema } from "@/lib/forms/schema";
import { useAuth } from "@/lib/auth-context";
import {
  useBookings, useConsumerPatients, useServices, useRefetchBookings,
} from "@/lib/domain";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import {
  CalendarCheck, Plus, ChevronRight, Clock, HeartPulse,
  History as HistoryIcon, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { AddressPicker } from "@/components/AddressPicker";
import { PaymentDialog } from "@/components/PaymentDialog";

export const Route = createFileRoute("/_app/consumer/bookings")({
  component: BookingsLayout,
  head: () => ({ meta: [{ title: "Bookings – NurseConnect" }] }),
});

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── City → approximate coordinates map ──────────────────────────────────────
// Used as a fallback when the consumer profile has no stored lat/lng.
// Covers the major Indian cities NurseConnect operates in.
const CITY_COORDS: Record<string, { lat: number; lng: number; state: string; pincode: string }> = {
  "hyderabad": { lat: 17.3850, lng: 78.4867, state: "Telangana", pincode: "500001" },
  "bangalore": { lat: 12.9716, lng: 77.5946, state: "Karnataka", pincode: "560001" },
  "bengaluru": { lat: 12.9716, lng: 77.5946, state: "Karnataka", pincode: "560001" },
  "chennai": { lat: 13.0827, lng: 80.2707, state: "Tamil Nadu", pincode: "600001" },
  "mumbai": { lat: 19.0760, lng: 72.8777, state: "Maharashtra", pincode: "400001" },
  "delhi": { lat: 28.6139, lng: 77.2090, state: "Delhi", pincode: "110001" },
  "delhi ncr": { lat: 28.6139, lng: 77.2090, state: "Delhi", pincode: "110001" },
  "kolkata": { lat: 22.5726, lng: 88.3639, state: "West Bengal", pincode: "700001" },
  "kochi": { lat: 9.9312, lng: 76.2673, state: "Kerala", pincode: "682001" },
  "thrissur": { lat: 10.5276, lng: 76.2144, state: "Kerala", pincode: "680001" },
  "pune": { lat: 18.5204, lng: 73.8567, state: "Maharashtra", pincode: "411001" },
  "coimbatore": { lat: 11.0168, lng: 76.9558, state: "Tamil Nadu", pincode: "641001" },
  "jaipur": { lat: 26.9124, lng: 75.7873, state: "Rajasthan", pincode: "302001" },
  "warangal": { lat: 17.9784, lng: 79.5941, state: "Telangana", pincode: "506001" },
  "visakhapatnam": { lat: 17.6868, lng: 83.2185, state: "Andhra Pradesh", pincode: "530001" },
  "vijayawada": { lat: 16.5062, lng: 80.6480, state: "Andhra Pradesh", pincode: "520001" },
};

// Resolve coordinates and address fields for a booking.
// Priority: (1) browser Geolocation API, (2) consumer profile stored lat/lng,
// (3) city name lookup, (4) Hyderabad default.
async function resolveLocation(
  consumerCity?: string | null,
  consumerState?: string | null,
  consumerPincode?: string | null,
  consumerLat?: number | null,
  consumerLng?: number | null,
): Promise<{ latitude: number; longitude: number; state: string; pincode: string; city: string }> {

  // 1) Try browser Geolocation (best accuracy, real-time)
  const browserCoords = await new Promise<GeolocationCoordinates | null>((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 4000, maximumAge: 60000 },
    );
  });

  if (browserCoords) {
    const cityKey = (consumerCity ?? "").toLowerCase().trim();
    const cityData = CITY_COORDS[cityKey];
    return {
      latitude: browserCoords.latitude,
      longitude: browserCoords.longitude,
      state: consumerState ?? cityData?.state ?? "India",
      pincode: consumerPincode ?? cityData?.pincode ?? "000000",
      city: consumerCity ?? "Unknown",
    };
  }

  // 2) Consumer profile stored coordinates
  if (consumerLat && consumerLng) {
    const cityKey = (consumerCity ?? "").toLowerCase().trim();
    const cityData = CITY_COORDS[cityKey];
    return {
      latitude: consumerLat,
      longitude: consumerLng,
      state: consumerState ?? cityData?.state ?? "India",
      pincode: consumerPincode ?? cityData?.pincode ?? "000000",
      city: consumerCity ?? "Unknown",
    };
  }

  // 3) City name lookup from consumer profile
  const cityKey = (consumerCity ?? "").toLowerCase().trim();
  if (cityKey && CITY_COORDS[cityKey]) {
    const cityData = CITY_COORDS[cityKey];
    return {
      latitude: cityData.lat,
      longitude: cityData.lng,
      state: consumerState ?? cityData.state,
      pincode: consumerPincode ?? cityData.pincode,
      city: consumerCity ?? cityKey,
    };
  }

  // 4) Hyderabad default (NurseConnect HQ city)
  return {
    latitude: 17.3850,
    longitude: 78.4867,
    state: "Telangana",
    pincode: "500001",
    city: consumerCity ?? "Hyderabad",
  };
}

async function apiPost(path: string, body: unknown) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.detail?.[0]?.msg ?? err?.detail ?? `Request failed (${res.status})`
    );
  }
  return res.json();
}

// Fetch the logged-in consumer's profile to get stored location fields.
async function fetchConsumerProfile() {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const res = await fetch(`${API}/api/consumers/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function BookingsLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (pathname === "/consumer/bookings") return <ConsumerBookings />;
  return <Outlet />;
}

function ConsumerBookings() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<any>(null);
  // Store consumer profile for location resolution
  const [consumerProfile, setConsumerProfile] = useState<any>(null);

  const bookings = useBookings();
  const patients = useConsumerPatients(user?.id);
  const services = useServices();
  const refetchBookings = useRefetchBookings();

  // Load consumer profile on mount for location fields
  useEffect(() => {
    fetchConsumerProfile().then(setConsumerProfile);
  }, []);

  const liveSchema: FormSchema = useMemo(() => {
    const patientField = BOOKING_REQUEST_SCHEMA.sections[0].fields[0];
    const serviceField = BOOKING_REQUEST_SCHEMA.sections[0].fields[1];

    return {
      ...BOOKING_REQUEST_SCHEMA,
      sections: BOOKING_REQUEST_SCHEMA.sections.map((section, i) => {
        if (i !== 0) return section;
        return {
          ...section,
          fields: section.fields.map(f => {
            if (f.key === patientField.key) {
              return {
                ...f,
                kind: "select" as const,
                options: patients.map(p => ({ label: p.name, value: p.id })),
              };
            }
            if (f.key === serviceField.key) {
              return {
                ...f,
                options: services.map(s => ({ label: s.name, value: s.id })),
              };
            }
            return f;
          }),
        };
      }),
    };
  }, [patients, services]);

  const care = {
    all: bookings,
    upcoming: bookings.filter(b =>
      b.rawStatus === "pending_payment" ||
      b.rawStatus === "pending" ||
      b.rawStatus === "confirmed" ||
      b.rawStatus === "claimed"
    ),
    inCare: bookings.filter(b =>
      b.rawStatus === "active" ||
      b.rawStatus === "in_progress"
    ),
    completed: bookings.filter(b => b.rawStatus === "completed"),
    escalated: bookings.filter(b => b.rawStatus === "escalated"),
  };

  const onCreate = async (values: Record<string, unknown>) => {
    const patient = patients.find(p => p.id === values.patient_name);
    if (!patient) {
      toast.error("Select a patient");
      return;
    }
    const service = services.find(s => s.id === values.service);
    if (!service) {
      toast.error("Select a service");
      return;
    }

    setSubmitting(true);
    try {
      // ── PATCH 1: Resolve real location instead of hardcoded Bangalore ──
      const location = await resolveLocation(
        consumerProfile?.city,
        consumerProfile?.state,
        consumerProfile?.pincode,
        consumerProfile?.latitude ? Number(consumerProfile.latitude) : null,
        consumerProfile?.longitude ? Number(consumerProfile.longitude) : null,
      );

      const created = await apiPost("/api/bookings/", {
        patient_id: patient.id,
        service_id: service.id,
        booking_type: "one_time",
        scheduled_date: values.preferred_date,
        scheduled_start_time: (() => {
          const t = (values.preferred_time as string) || "10:00 AM";
          const [time, period] = t.split(" ");
          const [h, m] = time.split(":").map(Number);
          const hours24 = period === "PM" && h !== 12 ? h + 12 : (period === "AM" && h === 12 ? 0 : h);
          return `${String(hours24).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        })(),
        is_urgent: false,
        address_id: addressId || undefined,
        // fallback inline address when no saved address selected
        ...(!addressId ? {
          address: { line1: values.area || "—", city: location.city, state: location.state, pincode: location.pincode },
          latitude: location.latitude, longitude: location.longitude,
        } : {}),
        special_instructions: values.notes || undefined,
      });

      setOpen(false);
      setPendingBooking(created);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const isEmpty = care.all.length === 0;

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold">Booking journey</div>
            <div className="text-[12.5px] text-muted-foreground">
              Visits grouped by care stage — alerts, what's happening now, what's coming next, and what has recently completed.
            </div>
          </div>
          <WorkflowActionButton action="consumer.create_booking" icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setOpen(true)}>
            New booking
          </WorkflowActionButton>
        </div>

        {isEmpty ? (
          <Card><EmptyState icon={CalendarCheck} title="No bookings yet" description="Create your first booking to begin the care journey." /></Card>
        ) : (
          <>
            {care.escalated.length > 0 && (
              <RuntimeBoundary label="Care alerts">
                <JourneySection
                  title={<span className="flex items-center gap-2 text-rose-700"><AlertTriangle className="h-4 w-4" /> Needs review</span>}
                  rows={care.escalated} tone="rose"
                />
              </RuntimeBoundary>
            )}
            <RuntimeBoundary label="In care now">
              <JourneySection
                title={<span className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-emerald-600" /> In care now</span>}
                rows={care.inCare} tone="emerald"
                emptyHint="No visits are currently underway."
              />
            </RuntimeBoundary>
            <RuntimeBoundary label="Upcoming care">
              <JourneySection
                title={<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Upcoming</span>}
                rows={care.upcoming} tone="primary"
                emptyHint="No upcoming visits scheduled."
              />
            </RuntimeBoundary>
            <RuntimeBoundary label="Completed care">
              <JourneySection
                title={<span className="flex items-center gap-2"><HistoryIcon className="h-4 w-4 text-muted-foreground" /> Recently completed</span>}
                rows={care.completed} tone="muted"
                emptyHint="Completed visits will appear here."
              />
            </RuntimeBoundary>
          </>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New care booking">
        <div className="mb-4">
          <AddressPicker value={addressId} onChange={setAddressId} />
        </div>
        <SchemaForm
          schema={liveSchema}
          onSubmit={onCreate}
          submitLabel="Request booking"
        />
      </Modal>
      <PaymentDialog
        booking={pendingBooking}
        open={pendingBooking !== null}
        onClose={() => setPendingBooking(null)}
        onConfirmed={async () => { setPendingBooking(null); await refetchBookings(); }}
      />
    </>
  );
}

// ── Journey section component ────────────────────────────────────────────────
function JourneySection({
  title,
  rows,
  tone,
  emptyHint,
}: {
  title: ReactNode;
  rows: any[];
  tone: string;
  emptyHint?: string;
}) {
  const accentMap: Record<string, string> = {
    rose: "text-rose-700",
    emerald: "text-emerald-600",
    primary: "text-primary",
    muted: "text-muted-foreground",
  };

  if (rows.length === 0 && !emptyHint) return null;

  return (
    <Card title={title} padded={false}>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-muted-foreground">{emptyHint}</p>
      ) : (
        rows.map((b) => {
          const state = bindStatus("booking", b.rawStatus);
          return (
            <Link
              key={b.id}
              to="/consumer/bookings/$bookingId"
              params={{ bookingId: b.id }}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">
                  #{b.id.slice(0, 8)} · {b.service ?? "Service"} · {b.patientName ?? "—"}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {b.area ?? "—"}{b.startedAt ? ` · ${b.startedAt}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge workflow="booking" state={state} />
                <SLAIndicator workflow="booking" state={state} enteredAt={parseEnteredAt(b.startedAt)} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })
      )}
    </Card>
  );
}
