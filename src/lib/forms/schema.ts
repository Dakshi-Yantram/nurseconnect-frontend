/**
 * Schema-driven form runtime (Phase 3 foundation).
 *
 * Defines a JSON-serializable schema for clinical checklists, consents,
 * documentation, care packages, and assessments. The schema is consumed by
 * `<SchemaForm>` so pages stop hardcoding form layouts.
 *
 * Supports:
 *   - typed fields (text / textarea / number / select / radio / checkbox / date / signature / readonly)
 *   - grouped sections with optional collapsible state
 *   - conditional visibility via `showWhen`
 *   - runtime validation rules (required / min / max / pattern)
 *   - role-aware visibility (`visibleToRoles`)
 *   - readonly / editable modes
 *   - help text + version metadata for future version-aware rendering
 */
import type { Role } from "@/lib/rbac";
import { isSlotPast } from "./timeSlots";

export type FieldKind =
  | "text" | "textarea" | "number" | "select" | "radio"
  | "checkbox" | "date" | "time_slot" | "signature" | "readonly";

export interface FieldOption { label: string; value: string }

export interface FieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

/** Predicate against current form values. */
export type Condition =
  | { field: string; equals: string | number | boolean }
  | { field: string; in: Array<string | number> }
  | { field: string; truthy: true };

export interface FieldSchema {
  key: string;
  label: string;
  kind: FieldKind;
  help?: string;
  placeholder?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  showWhen?: Condition;
  visibleToRoles?: Role[];
  default?: unknown;
  /** Span (1-3) inside a section grid; defaults to 1. */
  span?: 1 | 2 | 3;
  /**
   * For `kind: "date"` fields only: disallow picking/submitting a date
   * before today. Opt-in per field (rather than a blanket rule on every
   * date input) because plenty of date fields in this app — date of birth,
   * a past incident date, an existing document's issue date — are supposed
   * to accept past dates. Booking-scheduling fields like "Preferred date"
   * are the ones that should set this.
   */
  noPast?: boolean;
  /**
   * For `kind: "time_slot"` only: the key of the "date" field this time is
   * scheduled against, so slots already past on that specific day (when
   * it's today) can be excluded. Without this the slot list can't tell
   * "today" from any other day.
   */
  linkedDateField?: string;
}

export interface SectionSchema {
  key: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  fields: FieldSchema[];
  showWhen?: Condition;
  visibleToRoles?: Role[];
}

export interface FormSchema {
  key: string;
  title: string;
  version: string;
  description?: string;
  sections: SectionSchema[];
}

export type FormValues = Record<string, unknown>;

// ----- Evaluators -----------------------------------------------------------
export function evalCondition(c: Condition | undefined, values: FormValues): boolean {
  if (!c) return true;
  const v = values[c.field];
  if ("equals" in c) return v === c.equals;
  if ("in" in c) return c.in.includes(v as any);
  if ("truthy" in c) return !!v;
  return true;
}

export function isFieldVisible(field: FieldSchema, values: FormValues, role: Role | null): boolean {
  if (field.visibleToRoles && role && !field.visibleToRoles.includes(role)) return false;
  return evalCondition(field.showWhen, values);
}

export function isSectionVisible(section: SectionSchema, values: FormValues, role: Role | null): boolean {
  if (section.visibleToRoles && role && !section.visibleToRoles.includes(role)) return false;
  return evalCondition(section.showWhen, values);
}

export interface FieldError { field: string; message: string }

export function validateForm(schema: FormSchema, values: FormValues, role: Role | null): FieldError[] {
  const errors: FieldError[] = [];
  for (const section of schema.sections) {
    if (!isSectionVisible(section, values, role)) continue;
    for (const field of section.fields) {
      if (!isFieldVisible(field, values, role)) continue;
      const v = values[field.key];
      const rules = field.validation;

      // Structural (kind-based) checks that must run regardless of whether
      // a `validation` ruleset is present — a "time_slot" or "noPast date"
      // field can be optional and still need this to keep it from silently
      // accepting a time/date that's already gone.
      if (field.kind === "date" && field.noPast && typeof v === "string" && v) {
        // Compare as plain "YYYY-MM-DD" strings (both the input value and
        // today's date in the browser's local timezone) rather than Date
        // objects, so a UTC/local offset can never make "today" itself
        // look like it's in the past.
        const todayStr = new Date().toLocaleDateString("en-CA"); // en-CA => YYYY-MM-DD
        if (v < todayStr) {
          errors.push({ field: field.key, message: rules?.message ?? `${field.label} cannot be in the past` });
        }
      }
      if (field.kind === "time_slot" && typeof v === "string" && v) {
        const linkedDate = field.linkedDateField ? (values[field.linkedDateField] as string | undefined) : undefined;
        if (isSlotPast(linkedDate, v)) {
          errors.push({ field: field.key, message: rules?.message ?? `${field.label} has already passed — pick a later time` });
        }
      }

      if (!rules) continue;
      const present = v !== undefined && v !== null && v !== "";
      if (rules.required && !present) {
        errors.push({ field: field.key, message: rules.message ?? `${field.label} is required` });
        continue;
      }
      if (!present) continue;
      if (rules.min !== undefined && typeof v === "number" && v < rules.min) errors.push({ field: field.key, message: rules.message ?? `Min ${rules.min}` });
      if (rules.max !== undefined && typeof v === "number" && v > rules.max) errors.push({ field: field.key, message: rules.message ?? `Max ${rules.max}` });
      if (rules.pattern && typeof v === "string" && !new RegExp(rules.pattern).test(v)) {
        errors.push({ field: field.key, message: rules.message ?? `${field.label} format invalid` });
      }
    }
  }
  return errors;
}

export function defaultValues(schema: FormSchema): FormValues {
  const out: FormValues = {};
  for (const s of schema.sections) for (const f of s.fields) {
    if (f.default !== undefined) out[f.key] = f.default;
    else if (f.kind === "checkbox") out[f.key] = false;
    else out[f.key] = "";
  }
  return out;
  
}