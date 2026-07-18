/**
 * Representative schema templates for the runtime form renderer.
 *
 * Migration target — care package, consent, clinical checklist,
 * documentation and assessment forms should be authored as schemas here
 * (or fetched from the backend) rather than hand-coded inside pages.
 *
 * Per-service resolvers (Phase 6C):
 *   `getChecklistForBooking(bookingData)` and
 *   `getDocumentationForBooking(bookingData)` pick the schema variant by
 *   booking.service so the worker app renders the right form per visit
 *   instead of one global template.
 */
import type { FormSchema } from "./schema";

export const CARE_PACKAGE_SCHEMA: FormSchema = {
  key: "care_package", title: "Care Package Configuration", version: "1.0",
  description: "Configure package coverage, cadence and clinical rules.",
  sections: [
    {
      key: "basics", title: "Package basics", fields: [
        { key: "name", label: "Package name", kind: "text", validation: { required: true }, span: 2 },
        {
          key: "service_tier", label: "Service tier", kind: "select", validation: { required: true },
          options: [
            { label: "Basic", value: "basic" },
            { label: "Care+", value: "care_plus" },
            { label: "Family Pro", value: "family_pro" },
          ]
        },
        { key: "summary", label: "Summary", kind: "textarea", span: 3 },
      ]
    },
    {
      key: "coverage", title: "Coverage", fields: [
        { key: "visits_per_week", label: "Visits per week", kind: "number", validation: { required: true, min: 1, max: 14 } },
        { key: "hours_per_visit", label: "Hours per visit", kind: "number", validation: { required: true, min: 1, max: 12 } },
        { key: "includes_clinical", label: "Includes clinical assessments", kind: "checkbox" },
        { key: "live_in", label: "Live-in care", kind: "checkbox" },
        {
          key: "live_in_room", label: "Room arrangement", kind: "textarea",
          showWhen: { field: "live_in", truthy: true }, span: 3
        },
      ]
    },
    {
      key: "review", title: "Review & activation",
      visibleToRoles: ["admin_super" as any, "admin_clinical" as any, "admin_ops" as any],
      fields: [
        { key: "activation_date", label: "Activation date", kind: "date", validation: { required: true } },
        { key: "reviewer_note", label: "Reviewer notes", kind: "textarea", span: 3 },
      ]
    },
  ],
};

export const CONSENT_SCHEMA: FormSchema = {
  key: "consent_record", title: "Care Consent", version: "2.0",
  description: "Confirm consent for treatment, data processing and family sharing.",
  sections: [
    {
      key: "consents", title: "Consent items", fields: [
        { key: "treatment_consent", label: "I consent to clinical treatment", kind: "checkbox", validation: { required: true } },
        { key: "data_consent", label: "I consent to data processing per privacy policy", kind: "checkbox", validation: { required: true } },
        { key: "family_sharing", label: "Share updates with family contacts", kind: "checkbox" },
        {
          key: "family_contact", label: "Family contact (name & phone)", kind: "text",
          showWhen: { field: "family_sharing", truthy: true }, span: 2
        },
      ]
    },
    {
      key: "signature", title: "Signature", fields: [
        { key: "signed_by", label: "Signed by", kind: "signature", validation: { required: true }, span: 3 },
      ]
    },
  ],
};

export const CLINICAL_CHECKLIST_SCHEMA: FormSchema = {
  key: "clinical_checklist", title: "Visit Clinical Checklist", version: "1.3",
  description: "Capture vitals and observations for the current visit.",
  sections: [
    {
      key: "vitals", title: "Vitals", fields: [
        { key: "bp", label: "Blood pressure", kind: "text", placeholder: "120/80", validation: { required: true, pattern: "^\\d{2,3}/\\d{2,3}$", message: "Use 120/80 format" } },
        { key: "hr", label: "Heart rate (bpm)", kind: "number", validation: { required: true, min: 30, max: 220 } },
        { key: "temp", label: "Temperature (°F)", kind: "number", validation: { required: true, min: 90, max: 110 } },
        { key: "spo2", label: "SpO₂ (%)", kind: "number", validation: { required: true, min: 60, max: 100 } },
      ]
    },
    {
      key: "observations", title: "Observations", fields: [
        {
          key: "alert", label: "Patient alert & oriented", kind: "radio",
          options: [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }], validation: { required: true }
        },
        { key: "pain_level", label: "Pain level (0–10)", kind: "number", validation: { min: 0, max: 10 } },
        { key: "notes", label: "Notes", kind: "textarea", span: 3 },
        { key: "escalate", label: "Escalation needed", kind: "checkbox" },
        {
          key: "escalate_reason", label: "Escalation reason", kind: "textarea",
          showWhen: { field: "escalate", truthy: true }, span: 3,
          validation: { required: true, message: "Required when escalating" }
        },
      ]
    },
  ],
};

export const DOCUMENTATION_SCHEMA: FormSchema = {
  key: "visit_documentation", title: "Visit Documentation", version: "1.0",
  description: "Final documentation submitted at visit close-out.",
  sections: [
    {
      key: "summary", title: "Visit summary", fields: [
        { key: "interventions", label: "Interventions performed", kind: "textarea", validation: { required: true }, span: 3 },
        { key: "patient_response", label: "Patient response", kind: "textarea", span: 3 },
        { key: "next_steps", label: "Recommended next steps", kind: "textarea", span: 3 },
      ]
    },
    {
      key: "attest", title: "Attestation", fields: [
        { key: "attestation", label: "I attest the above is accurate", kind: "checkbox" },
        { key: "signature", label: "Signature", kind: "signature", span: 3 },
      ]
    },
  ],
};

export const BOOKING_REQUEST_SCHEMA: FormSchema = {
  key: "booking_request", title: "New Care Booking", version: "1.0",
  description: "Request a nurse visit for a patient under your care.",
  sections: [
    {
      key: "patient", title: "Patient & service", fields: [
        { key: "patient_name", label: "Patient", kind: "text", validation: { required: true } },
        {
          key: "service", label: "Service", kind: "select", validation: { required: true },
          options: [
            { label: "Geriatric Care", value: "Geriatric Care" },
            { label: "Wound Dressing", value: "Wound Dressing" },
            { label: "Post-Op", value: "Post-Op" },
            { label: "Diabetes Check", value: "Diabetes Check" },
            { label: "IV Therapy", value: "IV Therapy" },
          ]
        },
        { key: "area", label: "Service area", kind: "text", validation: { required: true }, placeholder: "e.g. Indiranagar, BLR" },
      ]
    },
    {
      key: "schedule", title: "Schedule", fields: [
        { key: "preferred_date", label: "Preferred date", kind: "date", validation: { required: true } },
        { key: "preferred_time", label: "Preferred time", kind: "text", placeholder: "10:00 AM" },
        {
          key: "duration_hint", label: "Duration", kind: "select",
          options: [
            { label: "Up to 1h", value: "1h" },
            { label: "Up to 2h", value: "2h" },
            { label: "Half day", value: "4h" },
            { label: "Full day", value: "8h" },
          ]
        },
      ]
    },
    {
      key: "consent", title: "Consent confirmation", fields: [
        { key: "treatment_ok", label: "I confirm consent for clinical treatment", kind: "checkbox", validation: { required: true } },
        { key: "notes", label: "Additional notes", kind: "textarea", span: 3 },
      ]
    },
  ],
};

// ----- Per-service variants (Phase 6C) --------------------------------------
// Narrow tweaks on top of the base clinical checklist so wound/diabetes/IV
// visits capture the right field set without forking the renderer.

export const WOUND_CHECKLIST_SCHEMA: FormSchema = {
  ...CLINICAL_CHECKLIST_SCHEMA,
  key: "wound_checklist", title: "Wound Care Checklist", version: "1.0",
  sections: [
    CLINICAL_CHECKLIST_SCHEMA.sections[0],
    {
      key: "wound", title: "Wound assessment", fields: [
        { key: "wound_site", label: "Wound site", kind: "text", validation: { required: true } },
        {
          key: "wound_stage", label: "Stage", kind: "select",
          options: [
            { label: "Stage I", value: "1" },
            { label: "Stage II", value: "2" },
            { label: "Stage III", value: "3" },
            { label: "Stage IV", value: "4" },
          ], validation: { required: true }
        },
        {
          key: "drainage", label: "Drainage / exudate", kind: "select",
          options: [
            { label: "None", value: "none" },
            { label: "Minimal", value: "min" },
            { label: "Moderate", value: "mod" },
            { label: "Heavy", value: "heavy" },
          ], validation: { required: true }
        },
        { key: "dressing_changed", label: "Dressing changed", kind: "checkbox" },
        { key: "wound_notes", label: "Notes", kind: "textarea", span: 3 },
      ]
    },
    CLINICAL_CHECKLIST_SCHEMA.sections[1],
  ],
};

export const DIABETES_CHECKLIST_SCHEMA: FormSchema = {
  ...CLINICAL_CHECKLIST_SCHEMA,
  key: "diabetes_checklist", title: "Diabetes Visit Checklist", version: "1.0",
  sections: [
    CLINICAL_CHECKLIST_SCHEMA.sections[0],
    {
      key: "glycemic", title: "Glycemic monitoring", fields: [
        { key: "fasting_bg", label: "Fasting BG (mg/dL)", kind: "number", validation: { required: true, min: 30, max: 600 } },
        { key: "post_meal_bg", label: "Post-meal BG (mg/dL)", kind: "number", validation: { min: 30, max: 600 } },
        { key: "insulin_admin", label: "Insulin administered", kind: "checkbox" },
        {
          key: "insulin_dose", label: "Insulin dose (units)", kind: "number",
          showWhen: { field: "insulin_admin", truthy: true },
          validation: { required: true, message: "Required when insulin administered" }
        },
        { key: "diet_notes", label: "Diet & lifestyle notes", kind: "textarea", span: 3 },
      ]
    },
    CLINICAL_CHECKLIST_SCHEMA.sections[1],
  ],
};

// Service → schema lookup. Falls back to the generic clinical checklist.
const CHECKLIST_BY_SERVICE: Record<string, FormSchema> = {
  "Wound Dressing": WOUND_CHECKLIST_SCHEMA,
  "Diabetes Check": DIABETES_CHECKLIST_SCHEMA,
};

export function getChecklistForBooking(data: { service?: string } | null | undefined): FormSchema {
  const svc = data?.service ?? "";
  return CHECKLIST_BY_SERVICE[svc] ?? CLINICAL_CHECKLIST_SCHEMA;
}

// Documentation currently shares one template across services; the resolver
// gives us a single seam to specialize later without re-touching pages.
export function getDocumentationForBooking(_data: { service?: string } | null | undefined): FormSchema {
  return DOCUMENTATION_SCHEMA;
}
