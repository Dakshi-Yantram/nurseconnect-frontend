import { useState } from "react";
import { Loader2, Navigation, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { reverseGeocode } from "@/components/AddressForm";

// Captured during nurse/caregiver onboarding. Sets the worker's base location
// + how far they'll travel — used by geo-dispatch when their live location
// isn't fresh. Render this inside the onboarding gate (_app.partner.tsx) as part
// of "complete your profile", or as its own step.
export function WorkerServiceAreaForm({
  initialCity, initialRadius, onSaved,
}: {
  initialCity?: string | null;
  initialRadius?: number | null;
  onSaved?: () => void;
}) {
  const [city, setCity] = useState(initialCity ?? "");
  const [radius, setRadius] = useState(String(initialRadius ?? 10));
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function useMyLocation() {
    setError(null); setLocating(true);
    if (!navigator.geolocation) { setError("Location not available"); setLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLat(pos.coords.latitude); setLng(pos.coords.longitude);
        const g = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (g?.city) setCity(g.city);
        setLocating(false);
      },
      () => { setError("Couldn't get your location. Enter your city manually."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function save() {
    setError(null); setBusy(true);
    try {
      await apiFetch("/api/workers/me/service-area", {
        method: "PUT",
        body: JSON.stringify({
          base_city: city.trim() || null,
          latitude: lat, longitude: lng,
          service_radius_km: Number(radius) || 10,
        }),
      });
      setSaved(true);
      onSaved?.();
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        <MapPin size={15} className="text-primary" />
        <p className="text-[13.5px] font-bold text-foreground">Your service area</p>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        Set where you're based and how far you'll travel. Booking requests near this area will be sent to you.
      </p>

      <button onClick={useMyLocation} disabled={locating}
        className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 text-[12.5px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">
        {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
        Use my current location
      </button>
      {lat != null && <p className="mb-2 text-[11px] text-emerald-700">Base location captured</p>}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Base city</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kochi"
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Travel radius (km)</label>
          <input value={radius} onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="10"
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      {saved && <p className="mt-2 text-[12px] text-emerald-700">Service area saved.</p>}
      <button onClick={save} disabled={busy || !city.trim()}
        className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
        {busy ? "Saving…" : "Save service area"}
      </button>
    </div>
  );
}
