/**
 * Tele-Doctor workflow — /api/teleconsult/*, /api/bookings/*, /api/eprescriptions/*.
 *
 * Mirrors the mobile app's services/teleconsult.service.ts (same backend,
 * same stage machine: waiting -> diet_review -> patient_assessment ->
 * prescription -> completed, forward-only) and adds what the mobile queue
 * screen doesn't need to: claiming a new booking and starting the video
 * call, both already-generic backend endpoints reused as-is.
 */
import { apiFetch } from "@/lib/api";

export type TeleConsultStage =
  | "waiting"
  | "diet_review"
  | "patient_assessment"
  | "prescription"
  | "completed";

export interface TeleConsultOut {
  id: string;
  booking_id: string;
  doctor_worker_id: string;
  patient_id: string;
  patient_name: string | null;
  stage: TeleConsultStage;
  diet_notes: string | null;
  patient_issues: string | null;
  patient_all_okay: boolean | null;
  prescription_id: string | null;
  created_at: string;
}

export interface AvailableTeleBooking {
  id: string;
  booking_ref?: string;
  patient_name?: string | null;
  service_name?: string | null;
  scheduled_date?: string;
  scheduled_start_time?: string;
  is_urgent?: boolean;
}

export const teleconsultService = {
  // ---- Finding + claiming a booking ------------------------------------
  /**
   * Unassigned bookings this doctor is qualified + opted in for. For a
   * Tele-Doctor this is never geography-filtered server-side (see
   * app/api/v1/bookings.py::new_requests) — a video consultation has no
   * meaningful distance, so every eligible booking anywhere shows up here.
   */
  availableBookings: () => apiFetch("/api/bookings/worker/new-requests") as Promise<AvailableTeleBooking[]>,

  /** Concurrency-safe claim — the database decides the single winner. */
  acceptBooking: (bookingId: string) =>
    apiFetch(`/api/bookings/${bookingId}/accept`, { method: "POST" }),

  // ---- Queue + stage progression (mirrors the mobile queue exactly) ---
  /** Called once the doctor is assigned and ready to begin. Idempotent. */
  start: (bookingId: string) =>
    apiFetch("/api/teleconsult/start", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId }),
    }) as Promise<TeleConsultOut>,

  myQueue: (stage?: TeleConsultStage) =>
    apiFetch(`/api/teleconsult/queue${stage ? `?stage=${stage}` : ""}`) as Promise<TeleConsultOut[]>,

  /** Advances waiting/diet_review -> patient_assessment. */
  submitDiet: (id: string, dietNotes: string) =>
    apiFetch(`/api/teleconsult/${id}/diet`, {
      method: "PATCH",
      body: JSON.stringify({ diet_notes: dietNotes }),
    }) as Promise<TeleConsultOut>,

  /** Advances patient_assessment -> prescription. */
  submitPatientIssues: (id: string, allOkay: boolean, issues?: string) =>
    apiFetch(`/api/teleconsult/${id}/patient-issues`, {
      method: "PATCH",
      body: JSON.stringify({ all_okay: allOkay, issues: allOkay ? null : issues }),
    }) as Promise<TeleConsultOut>,

  /** Backend requires an e-Rx already linked (see eprescriptionsService.create). */
  complete: (id: string) =>
    apiFetch(`/api/teleconsult/${id}/complete`, { method: "PATCH", body: JSON.stringify({}) }) as Promise<TeleConsultOut>,
};

// ---------------------------------------------------------------------------
// e-Prescriptions — required before a consultation can be marked complete.
// ---------------------------------------------------------------------------
export interface DrugLine {
  name: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  scheduled_drug?: boolean;
}

export const eprescriptionsService = {
  getSignature: () =>
    apiFetch("/api/eprescriptions/signature") as Promise<{
      has_signature: boolean;
      signature_url: string | null;
      uploaded_at: string | null;
    }>,

  uploadSignature: (imageBase64: string) =>
    apiFetch("/api/eprescriptions/signature", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64 }),
    }),

  create: (payload: {
    booking_id: string;
    drugs_listed: DrugLine[];
    diet_notes?: string;
    patient_issues?: string;
    valid_days?: number;
  }) => apiFetch("/api/eprescriptions", { method: "POST", body: JSON.stringify(payload) }),
};

// ---------------------------------------------------------------------------
// Video calling — the SAME booking-based call API used for audio calls
// elsewhere in the app (see src/hooks/useCall.ts / CallButton.tsx). Kept as
// plain fetch wrappers here; src/hooks/useVideoCall.ts owns the RealtimeKit
// SDK session built from these responses.
// ---------------------------------------------------------------------------
export interface CallStartResult {
  call_session_id: string;
  dyte_meeting_id: string;
  dyte_auth_token: string;
  dyte_org_id: string;
}

export const teleCallService = {
  start: (bookingId: string) =>
    apiFetch(`/api/bookings/${bookingId}/call/start`, { method: "POST" }) as Promise<CallStartResult>,
  join: (bookingId: string, callSessionId: string) =>
    apiFetch(`/api/bookings/${bookingId}/call/${callSessionId}/join`, { method: "POST" }) as Promise<CallStartResult>,
  end: (bookingId: string, callSessionId: string, reason: "completed" | "declined" | "no_answer" = "completed") =>
    apiFetch(`/api/bookings/${bookingId}/call/${callSessionId}/end`, {
      method: "POST",
      body: JSON.stringify({ end_reason: reason }),
    }),
};
