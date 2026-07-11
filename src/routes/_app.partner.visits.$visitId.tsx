import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Navigation, MapPin, KeyRound, CheckCircle2, PlayCircle,
  Activity, ClipboardList, FileText, AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLocationPublisher } from "@/lib/useLocationPublisher";

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

const CHECKLIST_ITEMS = [
  { key: "patient_identity_confirmed", label: "Confirmed patient identity" },
  { key: "vitals_recorded", label: "Recorded vital signs" },
  { key: "hand_hygiene", label: "Followed hand-hygiene protocol" },
  { key: "care_explained_to_family", label: "Explained care to the family" },
];

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
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [lastFlags, setLastFlags] = useState<string[] | null>(null);

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
    setError(null); setBusy("checklist");
    try {
      await apiFetch(`/api/visits/${bookingId}/checklist`, {
        method: "POST", body: JSON.stringify({ responses: checks }),
      });
      await reload();
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

      {/* Checklist */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList size={15} className="text-primary" />
          <p className="text-[13px] font-semibold text-foreground">Care checklist</p>
        </div>
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((it) => (
            <label key={it.key} className="flex items-center gap-2 text-[12.5px] text-foreground">
              <input type="checkbox" checked={!!checks[it.key]}
                onChange={(e) => setChecks((s) => ({ ...s, [it.key]: e.target.checked }))} />
              {it.label}
            </label>
          ))}
        </div>
        <button onClick={submitChecklist} disabled={busy !== null}
          className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-muted disabled:opacity-40">
          {busy === "checklist" ? "Saving…" : "Save checklist"}
        </button>
      </div>

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