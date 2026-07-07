/**
 * Phase 9B — Runtime entity relationship normalization.
 *
 * Centralizes how operational surfaces resolve relationships off a booking
 * EntityRecord so route components stop reaching for ad-hoc field fallbacks
 * like `b.patient ?? b.patient_name`. The orchestration repository remains
 * the authoritative source — this module is a thin, hydration-safe
 * projection layer over `EntityRecord.data` that keeps relationship
 * derivation consistent across consumer / worker / reviewer / admin
 * portals and makes a future backend swap a single-file change.
 *
 * Pure functions only — no React, no state, no side effects. Safe to import
 * from both SSR and client renderers.
 */
import type { EntityRecord } from "./repositories";
import { resolvePatientIdByName } from "@/lib/mock-data";

/** Canonical, presentation-ready projection of a booking record's
 *  operational relationships. Optional fields degrade safely to undefined
 *  so callers can render "—" without re-deriving fallback chains. */
export interface BookingLink {
  id: string;
  patientId?: string;
  patientName?: string;
  service?: string;
  area?: string;
  startedAt?: string;
  duration?: string;
  nurseName?: string;
  ownerId?: string;
  ownerRole?: string;
  ownerName?: string;
  claimedBy?: string;
  claimedByName?: string;
  claimedAt?: string;
  notes?: string;
}

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
};

/** Read the patient display name from any booking-shaped record, tolerating
 *  the legacy `patient` / `patient_name` field split that predates this
 *  normalization pass. */
export function bookingPatientName(rec: { data?: any } | null | undefined): string | undefined {
  const d = rec?.data ?? {};
  return str(d.patientName) ?? str(d.patient) ?? str(d.patient_name);
}

/** Read the patient identity from any booking-shaped record. Falls back
 *  through the canonical name index so legacy records authored before id
 *  propagation keep linking through identity. */
export function bookingPatientId(rec: { data?: any } | null | undefined): string | undefined {
  const d = rec?.data ?? {};
  if (d.patientId) return String(d.patientId);
  const name = bookingPatientName(rec);
  return name ? resolvePatientIdByName(name) : undefined;
}

export function bookingService(rec: { data?: any } | null | undefined): string | undefined {
  return str(rec?.data?.service);
}
export function bookingArea(rec: { data?: any } | null | undefined): string | undefined {
  return str(rec?.data?.area);
}
export function bookingStartedAt(rec: { data?: any } | null | undefined): string | undefined {
  return str(rec?.data?.started) ?? str(rec?.data?.startedAt);
}
export function bookingDuration(rec: { data?: any } | null | undefined): string | undefined {
  return str(rec?.data?.duration);
}
export function bookingNurseName(rec: { data?: any } | null | undefined): string | undefined {
  return str(rec?.data?.nurse) ?? str(rec?.data?.nurseName);
}
export function bookingClaimant(rec: { data?: any } | null | undefined):
  { id?: string; name?: string; at?: string } {
  const d = rec?.data ?? {};
  return {
    id:   str(d.claimedBy),
    name: str(d.claimedByName),
    at:   str(d.claimedAt),
  };
}
export function bookingOwner(rec: { data?: any } | null | undefined):
  { id?: string; role?: string; name?: string } {
  const d = rec?.data ?? {};
  return {
    id:   str(d.ownerId),
    role: str(d.ownerRole),
    name: str(d.ownerName),
  };
}

/** Build the canonical relationship projection from an EntityRecord. */
export function toBookingLink(rec: EntityRecord): BookingLink {
  const claim = bookingClaimant(rec);
  const owner = bookingOwner(rec);
  return {
    id: rec.id,
    patientId:     bookingPatientId(rec),
    patientName:   bookingPatientName(rec),
    service:       bookingService(rec),
    area:          bookingArea(rec),
    startedAt:     bookingStartedAt(rec),
    duration:      bookingDuration(rec),
    nurseName:     bookingNurseName(rec),
    ownerId:       owner.id,
    ownerRole:     owner.role,
    ownerName:     owner.name,
    claimedBy:     claim.id,
    claimedByName: claim.name,
    claimedAt:     claim.at,
    notes:         rec.data?.notes ? String(rec.data.notes) : undefined,
  };
}

/**
 * Normalize a booking creation draft (e.g. from a SchemaForm) into the
 * persistence-ready shape the repository expects. Ensures the patient
 * identity and the legacy/canonical name fields stay in sync, and stamps
 * ownership in a single place so consumer surfaces don't re-implement the
 * mapping inline.
 */
export interface NormalizeBookingDraftInput {
  values: Record<string, unknown>;
  owner?: { id?: string | null; role?: string | null; name?: string | null };
}
export function normalizeBookingDraft({ values, owner }: NormalizeBookingDraftInput): Record<string, any> {
  const name = str(values.patient_name) ?? str((values as any).patientName) ?? str((values as any).patient);
  const patientId = name ? resolvePatientIdByName(name) : undefined;
  const consentOk = !!(values as any).treatment_ok;
  return {
    // Ownership — stamped once, consumed by ownership-aware selectors.
    ownerId:   owner?.id   ?? "consumer-anon",
    ownerRole: owner?.role ?? "consumer",
    ownerName: owner?.name ?? "Consumer",
    // Patient identity — keep canonical + legacy aliases aligned so any
    // reader (link helpers, queue selectors, journey panels) resolves the
    // same person regardless of which field they sample first.
    patientId,
    patientName:  name,
    patient:      name,
    patient_name: name,
    // Operational fields — pass through with safe coercion.
    service:        str(values.service),
    area:           str(values.area),
    preferred_date: str((values as any).preferred_date),
    preferred_time: str((values as any).preferred_time),
    duration:       str((values as any).duration_hint) ?? str((values as any).duration),
    started:        str((values as any).preferred_time) ?? "TBD",
    notes:          str((values as any).notes),
    // Consent ledger — stamp the timestamp once so lifecycle readiness
    // never has to re-derive it from the form payload.
    consentAccepted: consentOk,
    consentAt:       consentOk ? new Date().toISOString() : undefined,
  };
}
