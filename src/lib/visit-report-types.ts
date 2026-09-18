// Shared shapes for a single vital-sign reading and a nurse's visit report.
// Used by VisitCheckoutForm, CareSummaryCard and any route that needs to
// read/write a visit's report — kept in one place so the two modular
// components and their consumers don't drift out of sync with each other
// or with the backend's GET/PUT /api/visits/{bookingId}/report and
// GET /api/visits/{bookingId}/vitals response shapes.

export type Vital = {
  id: string;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse?: number | null;
  spo2?: number | null;
  temperature_f?: number | string | null;
  abnormal_flags?: string[] | null;
  escalation_triggered?: boolean;
  recorded_at: string;
};

// GET /api/visits/{bookingId}/report — the nurse's own saved report (same
// data the family sees in "Care summary" on their booking page, plus the
// internal care_notes that are never shown to them).
export type VisitReport = {
  care_notes?: string | null;
  family_summary?: string | null;
  actual_duration_minutes?: number | null;
  check_out_at?: string | null;
};
