/**
 * useWorkerBookingsSync
 * Save at: frontend/src/lib/orchestration/useWorkerBookingsSync.ts
 *
 * Fetches real bookings from the backend and seeds them into the
 * OrchestrationStore so the worker assignments page shows live data.
 * Polls every 30s automatically.
 */
import { useEffect, useRef } from "react";
import { useOrchestration } from "./index";
import { apiFetch } from "@/lib/api";

// Matches BookingOut from backend/app/schemas/schemas.py
interface BackendBooking {
  id: string;
  booking_ref: string;
  status: string;           // BookingStatus enum value
  is_urgent: boolean;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_duration_minutes: number;
  total_amount: string | number;
  distance_km?: number | null;
  address_snapshot: {
    line1?: string;
    city?: string;
    state?: string;
    area?: string;
    landmark?: string;
  };
  patient_id: string;
  service_id?: string | null;
  package_id?: string | null;
  worker_id?: string | null;
  created_at: string;
}

// BookingStatus enum → orchestration state
// (confirmed / rematch_pending are the two states new-requests returns)
function toState(status: string): string {
  switch (status) {
    case "confirmed":
    case "rematch_pending":   return "pending";      // → New Requests tab
    case "assigned":          return "claimed";
    case "in_progress":       return "in_progress";
    case "completed":         return "completed";
    case "cancelled":         return "cancelled";
    default:                  return "pending";
  }
}

// Map BackendBooking → data shape expected by links.ts helpers:
//   bookingPatientName() reads  data.patientName
//   bookingService()     reads  data.service
//   bookingArea()        reads  data.area
//   bookingStartedAt()   reads  data.started ?? data.startedAt
function toData(b: BackendBooking): Record<string, any> {
  const addr = b.address_snapshot ?? {};
  // Best human-readable area from address_snapshot
  const area = addr.area ?? addr.city ?? addr.line1 ?? "";

  // Format time as "HH:MM AM/PM" for display
  const started = b.scheduled_start_time
    ? b.scheduled_start_time.slice(0, 5)   // "HH:MM"
    : undefined;

  return {
    // ── links.ts field names (DO NOT rename these) ──
    patientName:  `Patient`,        // no patient name in BookingOut — see note below
    patient_name: `Patient`,
    patient:      `Patient`,
    service:      `Service`,        // no service name in BookingOut — see note below
    area,
    started,
    startedAt:    started,
    duration:     `${b.scheduled_duration_minutes}m`,

    // ── extra operational fields ──
    bookingRef:    b.booking_ref,
    scheduledDate: b.scheduled_date,
    totalAmount:   Number(b.total_amount ?? 0),
    isUrgent:      b.is_urgent,
    distanceKm:    b.distance_km,
    patientId:     b.patient_id,
    serviceId:     b.service_id,
    packageId:     b.package_id,
    backendStatus: b.status,
    enteredAt:     b.created_at,
    status:        toState(b.status),
  };
}

export function useWorkerBookingsSync(intervalMs = 30_000) {
  const store = useOrchestration();
  const seeded = useRef(new Set<string>());

  async function sync() {
    let bookings: BackendBooking[];
    try {
      bookings = await apiFetch("/api/v1/bookings/worker/new-requests");
    } catch (err) {
      console.warn("[useWorkerBookingsSync] fetch failed:", err);
      return;
    }

    for (const b of bookings) {
      const state = toState(b.status);
      const data  = toData(b);
      const existing = store.repos.booking.get(b.id);

      if (existing) {
        if (existing.state !== state || existing.data?.backendStatus !== b.status) {
          store.repos.booking.upsert({ ...existing, state, data: { ...existing.data, ...data } });
          (store as any).notify?.();
        }
      } else {
        seeded.current.add(b.id);
        store.createEntity("booking", data, "system", null, {
          id: b.id,
          state,
          notes: `Synced from backend (${b.booking_ref})`,
        });
      }
    }
  }

  useEffect(() => {
    sync();
    const id = setInterval(sync, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/*
 * ── IMPORTANT NOTE on patient_name and service name ─────────────────────────
 *
 * Your BookingOut schema (schemas.py) does NOT include patient_name or
 * service_name — it only has patient_id and service_id (UUIDs).
 *
 * To show real names on the cards you have two options:
 *
 * Option A (recommended) — Add computed fields to BookingOut in schemas.py:
 *
 *   class BookingOut(ORMModel):
 *       ...
 *       patient_name: Optional[str] = None   # populate via joined load
 *       service_name: Optional[str] = None   # populate via joined load
 *
 *   Then in bookings.py new_requests(), after fetching bookings do:
 *       bm.patient_name = booking.patient.full_name   # if relationship loaded
 *       bm.service_name = booking.service.name        # if relationship loaded
 *
 * Option B — fetch patient/service names separately in the frontend
 *   using /api/v1/patients/{id} and /api/v1/catalog/{id} after seeding.
 *
 * Until then, cards will show "Patient" and "Service" as placeholders.
 */