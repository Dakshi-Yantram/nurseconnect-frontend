import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Navigation, MapPin, KeyRound, CheckCircle2, PlayCircle,
  Activity, ClipboardList, FileText, AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLocationPublisher } from "@/lib/useLocationPublisher";
import { ChatPanel } from "@/components/shared/ChatPanel";

export const Route = createFileRoute("/_app/partner/visits/$visitId")({
  component: PartnerVisitDetail,
});

type Booking = {
  id: string;
  booking_ref?: string;
  status: string;
  service_name?: string | null;
  patient_name?: string | null;
  scheduled_date: string;
  scheduled_start_time: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  address_snapshot?: { line1?: string; city?: string; state?: string; pincode?: string } | null;
};
type Vital = {
  id: string;
  bp_systolic?: number | null; bp_diastolic?: number | null;
  pulse?: number | null; spo2?: number | null; temperature_f?: number | string | null;
  abnormal_flags?: string[] | null; escalation_triggered?: boolean; recorded_at: string;
};

function mapsUrl(b: Booking): string {
  if (b.latitude != null && b.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
  }
  const a = b.address_snapshot ?? {};
  const q = [a.line1, a.city, a.state, a.pincode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || "destination")}`;
}

type WorkflowQuestion = {
  id: string; type: string; text: string; required?: boolean; options?: Array<string | { label: string; value: string }>;
};
type WorkflowFieldDef = {
  field_id: string; type: string; label: string; required?: boolean; blocks_checkout?: boolean;
  options?: Array<string | { label: string; value: string }>;
};
type WorkflowResponse = {
  checklist_template: { id: string; code: string; version: number; questions: WorkflowQuestion[] } | null;
  documentation_template: { id: string; template_code: string; version: number; mandatory_fields: WorkflowFieldDef[] } | null;
  existing_responses: {
    checklist: Array<{ question_id: string; answer_json: any }>;
    documentation: Array<{ field_id: string; value_json: any; file_url: string | null }>;
  };
  completion_status: { can_checkout: boolean; missing_items: string[]; blocking_items: string[] };
};

function optionValue(o: string | { label: string; value: string }): string {
  return typeof o === "string" ? o : o.value;
}
function optionLabel(o: string | { label: string; value: string }): string {
  return typeof o === "string" ? o : o.label;
}

function PartnerVisitDetail() {
  const { visitId } = Route.useParams();
  // NOTE: `b` (the booking state) must be declared BEFORE it's referenced
  // below in useLocationPublisher. The previous version referenced `b` in
  // that call before the `useState` line that creates it, which threw
  // "ReferenceError: Cannot access 'b' before initialization" on every load
  // of this page (visible after accepting a booking).
  const [b, setB] = useState<Booking | null>(null);
  useLocationPublisher(visitId, ["assigned","worker_en_route","worker_arrived"].includes(b?.status ?? "")); // booking id
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bk, vs] = await Promise.allSettled([
        apiFetch(`/api/bookings/${visitId}`),
        apiFetch(`/api/visits/${visitId}/vitals`),
      ]);
      if (bk.status === "fulfilled") setB(bk.value);
      setVitals(vs.status === "fulfilled" && Array.isArray(vs.value) ? vs.value : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => { load(); }, [load]);

  function parseErr(e: any): string {
    let msg = String(e?.message ?? e);
    try { const j = JSON.parse(msg); msg = j.detail?.message ?? j.message ?? j.detail ?? msg; } catch { /* keep */ }
    return msg;
  }

  async function startVisit() {
    setError(null); setBusy("start");
    try {
      await apiFetch(`/api/visits/${visitId}/verify-start-otp`, {
        method: "POST", body: JSON.stringify({ otp: otp.trim() }),
      });
      setOtp("");
      await load();
    } catch (e: any) { setError(parseErr(e)); } finally { setBusy(null); }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }
  if (!b) {
    return <div className="p-8 text-center text-[13px] text-muted-foreground">{error ?? "Visit not found."}</div>;
  }

  const a = b.address_snapshot ?? {};
  const inProgress = b.status === "in_progress";
  const completed = b.status === "completed";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-xl px-4 py-8 space-y-4">
        {/* Header */}
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[15px] font-bold text-foreground">{b.service_name ?? "Care visit"}</p>
          <p className="text-[12.5px] text-muted-foreground">
            {b.patient_name ? `${b.patient_name} · ` : ""}#{(b.booking_ref ?? b.id).slice(0, 10)}
          </p>
          <p className="text-[12.5px] text-muted-foreground mt-1">
            {new Date(b.scheduled_date).toLocaleDateString("en-IN")} · {b.scheduled_start_time.slice(0, 5)}
          </p>
        </div>

        {/* Address + navigation */}
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-foreground">Service address</p>
              <p className="text-[12.5px] text-muted-foreground">
                {[a.line1, a.city, a.state, a.pincode].filter(Boolean).join(", ") || "Address on map"}
              </p>
            </div>
          </div>
          <a href={mapsUrl(b)} target="_blank" rel="noreferrer"
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90">
            <Navigation size={15} /> Navigate with Google Maps
          </a>
        </div>

        <ChatPanel scope="booking" id={visitId} />

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</div>}

        {completed ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="text-emerald-600" size={26} />
            <p className="text-[14px] font-bold text-foreground">Visit completed</p>
          </div>
        ) : !inProgress ? (
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={15} className="text-primary" />
              <p className="text-[13px] font-semibold text-foreground">Start visit</p>
            </div>
            <p className="text-[12px] text-muted-foreground mb-3">Ask the family for the 4-digit start code.</p>
            <div className="flex gap-2">
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric" placeholder="1234"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-[15px] tracking-[0.3em] text-center font-bold" />
              <button onClick={startVisit} disabled={busy !== null || otp.length !== 4}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
                {busy === "start" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Start
              </button>
            </div>
          </div>
        ) : (
          <ExecutionPanel bookingId={visitId} booking={b} vitals={vitals}
            busy={busy} setBusy={setBusy} setError={setError} parseErr={parseErr} reload={load} />
        )}
      </div>
    </div>
  );
}

function ExecutionPanel({
  bookingId, booking, vitals, busy, setBusy, setError, parseErr, reload,
}: {
  bookingId: string; booking: Booking; vitals: Vital[];
  busy: string | null; setBusy: (v: string | null) => void;
  setError: (v: string | null) => void; parseErr: (e: any) => string; reload: () => Promise<void>;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [lastFlags, setLastFlags] = useState<string[] | null>(null);

  // Dynamic per-service questionnaire — resolved from the booking's
  // checklist/documentation template (package > service > fallback), not a
  // hardcoded list. Wired to the same /api/care/workflow endpoints that
  // gate checkout via validate_documentation_completion, so filling this in
  // is what actually unblocks "Complete visit & check out" below.
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [docAnswers, setDocAnswers] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const loadWorkflow = useCallback(async () => {
    setWorkflowLoading(true);
    try {
      const wf: WorkflowResponse = await apiFetch(`/api/care/workflow/${bookingId}`);
      setWorkflow(wf);
      const a: Record<string, any> = {};
      for (const r of wf.existing_responses?.checklist ?? []) a[r.question_id] = r.answer_json?.value;
      setAnswers(a);
      const d: Record<string, any> = {};
      for (const r of wf.existing_responses?.documentation ?? []) d[r.field_id] = r.value_json?.value ?? (r.file_url ? { file_url: r.file_url } : undefined);
      setDocAnswers(d);
    } catch {
      setWorkflow(null);
    } finally {
      setWorkflowLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { loadWorkflow(); }, [loadWorkflow]);

  const num = (s?: string) => (s && s.trim() !== "" ? Number(s) : null);

  async function recordVitals() {
    setError(null); setBusy("vitals"); setLastFlags(null);
    try {
      const res = await apiFetch(`/api/visits/${bookingId}/vitals`, {
        method: "POST",
        body: JSON.stringify({
          bp_systolic: num(v.bp_systolic), bp_diastolic: num(v.bp_diastolic),
          pulse: num(v.pulse), spo2: num(v.spo2),
          temperature_f: num(v.temperature_f), respiratory_rate: num(v.respiratory_rate),
        }),
      });
      setLastFlags(res?.abnormal_flags ?? []);
      setV({});
      await reload();
    } catch (e: any) { setError(parseErr(e)); } finally { setBusy(null); }
  }

  async function submitChecklist() {
    if (!workflow?.checklist_template) return;
    setError(null); setBusy("checklist");
    try {
      const responses = workflow.checklist_template.questions
        .filter(q => answers[q.id] !== undefined && answers[q.id] !== "")
        .map(q => ({ question_id: q.id, answer: answers[q.id] }));
      await apiFetch(`/api/care/workflow/${bookingId}/responses`, {
        method: "POST", body: JSON.stringify({ responses }),
      });
      await loadWorkflow();
    } catch (e: any) { setError(parseErr(e)); } finally { setBusy(null); }
  }

  async function uploadDocPhoto(fieldId: string, file: File) {
    setError(null); setUploading(fieldId);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("field_id", fieldId);
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${(import.meta.env.VITE_API_URL ?? "http://localhost:8000")}/api/care/workflow/${bookingId}/documentation/file`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDocAnswers(s => ({ ...s, [fieldId]: { file_url: data.file_url } }));
    } catch (e: any) { setError(parseErr(e)); } finally { setUploading(null); }
  }

  async function submitDocumentation() {
    if (!workflow?.documentation_template) return;
    setError(null); setBusy("documentation");
    try {
      const items = workflow.documentation_template.mandatory_fields
        .filter(f => docAnswers[f.field_id] !== undefined && docAnswers[f.field_id] !== "")
        .map(f => {
          const v = docAnswers[f.field_id];
          return v && typeof v === "object" && "file_url" in v
            ? { field_id: f.field_id, file_url: v.file_url }
            : { field_id: f.field_id, value: v };
        });
      await apiFetch(`/api/care/workflow/${bookingId}/documentation`, {
        method: "POST", body: JSON.stringify({ items }),
      });
      await loadWorkflow();
    } catch (e: any) { setError(parseErr(e)); } finally { setBusy(null); }
  }

  async function checkout() {
    setError(null); setBusy("checkout");
    try {
      const coords: { latitude: number; longitude: number } = await new Promise((resolve) => {
        const fallback = { latitude: Number(booking.latitude ?? 0), longitude: Number(booking.longitude ?? 0) };
        if (!navigator.geolocation) return resolve(fallback);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
          () => resolve(fallback),
          { timeout: 4000 },
        );
      });
      await apiFetch(`/api/visits/${bookingId}/checkout`, {
        method: "POST",
        body: JSON.stringify({ ...coords, family_summary: summary || undefined, care_notes: notes || undefined }),
      });
      await reload();
    } catch (e: any) {
      setError(parseErr(e)); // 422 lists which template requirements are missing
    } finally { setBusy(null); }
  }

  const field = (key: string, label: string, ph: string) => (
    <div>
      <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      <input value={v[key] ?? ""} onChange={(e) => setV((s) => ({ ...s, [key]: e.target.value }))}
        inputMode="numeric" placeholder={ph}
        className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
    </div>
  );

  return (
    <>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 flex items-center gap-2">
        <PlayCircle className="text-emerald-600" size={18} />
        <p className="text-[13px] font-semibold text-foreground">Visit in progress</p>
      </div>

      {/* Vitals */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={15} className="text-primary" />
          <p className="text-[13px] font-semibold text-foreground">Record vitals</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("bp_systolic", "BP systolic", "120")}
          {field("bp_diastolic", "BP diastolic", "80")}
          {field("pulse", "Pulse", "72")}
          {field("spo2", "SpO2 %", "98")}
          {field("temperature_f", "Temp F", "98.6")}
          {field("respiratory_rate", "Resp rate", "16")}
        </div>
        {lastFlags && lastFlags.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Abnormal: {lastFlags.join(", ")} — an escalation may have been raised.
          </div>
        )}
        <button onClick={recordVitals} disabled={busy !== null}
          className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
          {busy === "vitals" ? "Saving…" : "Save vitals"}
        </button>
        {vitals.length > 0 && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">{vitals.length} reading(s) recorded this visit.</p>
        )}
      </div>

      {/* Care questionnaire — dynamic, resolved from this booking's service/package checklist template */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList size={15} className="text-primary" />
          <p className="text-[13px] font-semibold text-foreground">Care questionnaire</p>
        </div>
        {workflowLoading ? (
          <p className="text-[12px] text-muted-foreground">Loading…</p>
        ) : !workflow?.checklist_template ? (
          <p className="text-[12px] text-muted-foreground">No questionnaire configured for this service.</p>
        ) : (
          <>
            <div className="space-y-3">
              {workflow.checklist_template.questions.map((q) => (
                <WorkflowField
                  key={q.id}
                  id={q.id} type={q.type} label={q.text} required={q.required} options={q.options}
                  value={answers[q.id]} onChange={(val) => setAnswers((s) => ({ ...s, [q.id]: val }))}
                />
              ))}
            </div>
            <button onClick={submitChecklist} disabled={busy !== null}
              className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-muted disabled:opacity-40">
              {busy === "checklist" ? "Saving…" : "Save questionnaire"}
            </button>
          </>
        )}
      </div>

      {/* Documentation — dynamic fields, some may block checkout */}
      {workflow?.documentation_template && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={15} className="text-primary" />
            <p className="text-[13px] font-semibold text-foreground">Visit documentation</p>
          </div>
          <div className="space-y-3">
            {workflow.documentation_template.mandatory_fields.map((f) => (
              f.type === "photo" ? (
                <div key={f.field_id}>
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    {f.label}{f.required ? " *" : ""}
                  </label>
                  <input type="file" accept="image/*"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocPhoto(f.field_id, file); }}
                    className="mt-0.5 w-full text-[12px]" disabled={uploading === f.field_id} />
                  {docAnswers[f.field_id]?.file_url && (
                    <p className="mt-1 text-[11px] text-emerald-700">Uploaded ✓</p>
                  )}
                </div>
              ) : (
                <WorkflowField
                  key={f.field_id}
                  id={f.field_id} type={f.type} label={f.label} required={f.required} options={f.options}
                  value={docAnswers[f.field_id]} onChange={(val) => setDocAnswers((s) => ({ ...s, [f.field_id]: val }))}
                />
              )
            ))}
          </div>
          <button onClick={submitDocumentation} disabled={busy !== null}
            className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-muted disabled:opacity-40">
            {busy === "documentation" ? "Saving…" : "Save documentation"}
          </button>
        </div>
      )}

      {workflow && !workflow.completion_status.can_checkout && workflow.completion_status.blocking_items.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
          Before checkout: {workflow.completion_status.blocking_items.join(", ")}
        </div>
      )}

      {/* Family summary + checkout */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={15} className="text-primary" />
          <p className="text-[13px] font-semibold text-foreground">Family summary & checkout</p>
        </div>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
          placeholder="Summary the family will see (what you did, how the patient is doing)…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder="Clinical care notes (internal)…"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
        <button onClick={checkout} disabled={busy !== null}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
          {busy === "checkout" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          Complete visit & check out
        </button>
      </div>
    </>
  );
}

// Generic renderer for one dynamic checklist question or documentation
// field, driven entirely by the template's declared `type` — no per-service
// hardcoding. Supported types match care_workflow_engine.SUPPORTED_QUESTION_TYPES.
function WorkflowField({
  id, type, label, required, options, value, onChange,
}: {
  id: string; type: string; label: string; required?: boolean;
  options?: Array<string | { label: string; value: string }>;
  value: any; onChange: (val: any) => void;
}) {
  const labelEl = (
    <label htmlFor={id} className="text-[11px] font-semibold text-muted-foreground">
      {label}{required ? " *" : ""}
    </label>
  );

  if (type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-[12.5px] text-foreground">
        <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {label}{required ? " *" : ""}
      </label>
    );
  }
  if (type === "number") {
    return (
      <div>
        {labelEl}
        <input id={id} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
      </div>
    );
  }
  if (type === "textarea") {
    return (
      <div>
        {labelEl}
        <textarea id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2}
          className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
      </div>
    );
  }
  if (type === "single_select" && options?.length) {
    return (
      <div>
        {labelEl}
        <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]">
          <option value="" disabled>Select…</option>
          {options.map((o) => <option key={optionValue(o)} value={optionValue(o)}>{optionLabel(o)}</option>)}
        </select>
      </div>
    );
  }
  if (type === "multi_select" && options?.length) {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div>
        {labelEl}
        <div className="mt-1 space-y-1">
          {options.map((o) => {
            const ov = optionValue(o);
            return (
              <label key={ov} className="flex items-center gap-2 text-[12.5px] text-foreground">
                <input type="checkbox" checked={selected.includes(ov)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, ov] : selected.filter(s => s !== ov))} />
                {optionLabel(o)}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  // text (default)
  return (
    <div>
      {labelEl}
      <input id={id} type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
    </div>
  );
}