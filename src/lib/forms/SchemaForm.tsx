/**
 * Runtime renderer for schema-driven forms.
 * Pages pass a `FormSchema` + values; the renderer handles conditional
 * visibility, role gating, validation, and readonly mode.
 */
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  defaultValues, isFieldVisible, isSectionVisible, validateForm,
  type FieldError, type FieldSchema, type FormSchema, type FormValues,
} from "./schema";
import { toast } from "sonner";
interface Props {
  schema: FormSchema;
  initialValues?: FormValues;
  readonly?: boolean;
  onSubmit?: (values: FormValues) => void;
  submitLabel?: string;
  footer?: ReactNode;
}

const baseInput = "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary";

export function SchemaForm({
  schema, initialValues, readonly, onSubmit, submitLabel = "Save", footer,
}: Props) {
  const { user } = useAuth();
  const role = user?.role ?? null;
  const [values, setValues] = useState<FormValues>(() => ({ ...defaultValues(schema), ...(initialValues ?? {}) }));
  const [touched, setTouched] = useState(false);

  const errors: FieldError[] = useMemo(
    () => validateForm(schema, values, role),
    [schema, values, role],
  );
  const errorMap = useMemo(() => Object.fromEntries(errors.map(e => [e.field, e.message])), [errors]);

  const set = (key: string, v: unknown) => setValues(prev => ({ ...prev, [key]: v }));

  return (
    <form
  onSubmit={(e) => {
    e.preventDefault();
    setTouched(true);
    if (errors.length > 0) {
      toast.error("Please fill all required fields before saving");
      return;
    }
    onSubmit?.(values);
  }}
  className="space-y-6"
  suppressHydrationWarning
>
      <header>
        <h3 className="text-[14px] font-semibold text-foreground">{schema.title}</h3>
        {schema.description && <p className="text-[12px] text-muted-foreground mt-0.5">{schema.description}</p>}
        <p className="text-[11px] text-muted-foreground mt-1">v{schema.version}</p>
      </header>

      {schema.sections.map(section => {
        if (!isSectionVisible(section, values, role)) return null;
        return (
          <section key={section.key} className="nc-card p-5 space-y-4">
            <div>
              <div className="text-[13px] font-semibold">{section.title}</div>
              {section.description && <div className="text-[12px] text-muted-foreground mt-0.5">{section.description}</div>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {section.fields.map(field => {
                if (!isFieldVisible(field, values, role)) return null;
                const span = field.span ?? 1;
                const err = touched ? errorMap[field.key] : undefined;
                return (
                  <div key={field.key} className={cn(
                    span === 3 ? "md:col-span-3" : span === 2 ? "md:col-span-2" : "md:col-span-1",
                  )}>
                    <Label field={field} />
                    <FieldInput
                      field={field}
                      value={values[field.key]}
                      onChange={(v) => set(field.key, v)}
                      readonly={!!readonly}
                    />
                    {field.help && <p className="text-[11px] text-muted-foreground mt-1">{field.help}</p>}
                    {err && <p className="text-[11px] text-rose-600 mt-1">{err}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!readonly && (
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-muted-foreground">
            {errors.length > 0 && touched ? `${errors.length} issue(s) to resolve` : ""}
          </div>
          <div className="flex items-center gap-2">
            {footer}
            <button type="submit"
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium hover:opacity-95">
              {submitLabel}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function Label({ field }: { field: FieldSchema }) {
  if (field.kind === "checkbox") return null;
  return (
    <label className="block text-[12px] font-medium text-foreground mb-1">
      {field.label}
      {field.validation?.required && <span className="text-rose-600"> *</span>}
    </label>
  );
}

function FieldInput({
  field, value, onChange, readonly,
}: { field: FieldSchema; value: unknown; onChange: (v: unknown) => void; readonly: boolean }) {
  const disabled = readonly;
  switch (field.kind) {
    case "textarea":
      return <textarea disabled={disabled} className={cn(baseInput, "min-h-[80px]")}
        value={String(value ?? "")} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />;
    case "number":
      return <input type="number" disabled={disabled} className={baseInput}
        value={value === "" || value === undefined ? "" : Number(value)}
        onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
    case "date":
      return <input type="date" disabled={disabled} className={baseInput}
        value={String(value ?? "")} onChange={e => onChange(e.target.value)} />;
    case "select":
      return (
        <select disabled={disabled} className={baseInput}
          value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3 pt-1">
          {field.options?.map(o => (
            <label key={o.value} className="inline-flex items-center gap-2 text-[13px]">
              <input type="radio" disabled={disabled} checked={value === o.value}
                onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 text-[13px]">
          <input type="checkbox" disabled={disabled} checked={!!value}
            onChange={e => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case "signature":
      return (
        <div className={cn(baseInput, "min-h-[64px] flex items-center text-muted-foreground text-[12px]")}>
          {value ? `Signed by ${String(value)}` : disabled ? "— No signature —" : "Tap to sign"}
          {!disabled && !value && (
            <button type="button" className="ml-auto text-[12px] text-primary"
              onClick={() => onChange(`${new Date().toLocaleString()}`)}>Sign</button>
          )}
        </div>
      );
    case "readonly":
      return <div className={cn(baseInput, "bg-muted/30 text-muted-foreground")}>{String(value ?? "—")}</div>;
    case "text":
    default:
      return <input type="text" disabled={disabled} className={baseInput}
        value={String(value ?? "")} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />;
  }
}