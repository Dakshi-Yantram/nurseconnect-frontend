/**
 * Care-consent text + recording, used inside the booking flow.
 *
 * One short consent paragraph with a single tick box replaces the old
 * stand-alone "Consents" page. The patient's consent is recorded once per
 * consent-text version: if a valid consent is already on file for the patient,
 * the booking form shows it as "on file" and does not ask again.
 *
 * NOTE: the wording below is a product draft — have it reviewed by legal /
 * clinical governance before launch, and bump CONSENT_VERSION whenever the
 * wording changes (that is what makes returning patients re-consent).
 */
import { apiFetch } from "@/lib/api";

export const CONSENT_VERSION = "3.0";

export function consentParagraphs(patientName: string): string[] {
  const p = patientName || "the patient";
  return [
    `I request NurseConnect to arrange home nursing care for ${p}. I confirm that I am ${p}, or that I am the patient's family member / legal guardian and am authorised to give this consent on their behalf.`,
    `I understand that a registered nurse will carry out the booked service, that it is based on a doctor's prescription or instruction, and that every clinical procedure carries some inherent risk. I have told, or will tell, the nurse about allergies, current medicines and medical conditions before the visit begins, and I may ask the nurse to stop at any time.`,
    `I agree that personal and health information of ${p} may be collected, stored and processed by NurseConnect and its care partners only to deliver, document, review and improve this care, as described in the Privacy Policy. I can withdraw this consent at any time; this will not affect care already given.`,
    `I also agree that the nurse may take photographs of the treated area (for example a wound before and after treatment) solely for care documentation. These photographs are stored securely and are not shared outside the care team.`,
    `I understand that a visit may be rescheduled or cancelled if the prescription or medicines cannot be verified.`,
  ];
}

async function sha256Hex(text: string): Promise<string | undefined> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined; // insecure context / old browser — hash is optional
  }
}

export interface ConsentOnFile {
  givenAt: string;
  by: string | null;
}

/** The patient's current-version care consent, if one is on file. */
export async function fetchConsentOnFile(patientId: string): Promise<ConsentOnFile | null> {
  try {
    const list = await apiFetch(`/api/consents/patient/${patientId}`);
    const items: any[] = Array.isArray(list) ? list : list?.items ?? [];
    const now = Date.now();
    const hit = items.find(
      (c) =>
        c.consent_type === "service" &&
        c.status === "given" &&
        c.consent_text_version === CONSENT_VERSION &&
        (!c.expires_at || new Date(c.expires_at).getTime() > now),
    );
    return hit ? { givenAt: hit.given_at, by: hit.consented_by_name ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * Record the consent for a booking: the treatment/data record and the
 * clinical-photo record the nurse app requires before photos can be uploaded.
 * `signedByName` is the PATIENT's name (the person the booking is for).
 */
export async function recordCareConsent(opts: {
  patientId: string;
  bookingId: string;
  signedByName: string;
  relationship: "self" | "family";
}): Promise<void> {
  const hash = await sha256Hex(consentParagraphs(opts.signedByName).join("\n"));
  const base = {
    patient_id: opts.patientId,
    booking_id: opts.bookingId,
    consented_by_name: opts.signedByName,
    relationship_to_patient: opts.relationship,
    capture_method: "digital_checkbox",
    consent_text_version: CONSENT_VERSION,
    consent_text_hash: hash,
  };
  await apiFetch("/api/consents", { method: "POST", body: JSON.stringify({ ...base, consent_type: "service" }) });
  await apiFetch("/api/consents", { method: "POST", body: JSON.stringify({ ...base, consent_type: "photo" }) });
}
