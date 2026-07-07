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

export type FieldKind =
  | "text" | "textarea" | "number" | "select" | "radio"
  | "checkbox" | "date" | "signature" | "readonly";

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
