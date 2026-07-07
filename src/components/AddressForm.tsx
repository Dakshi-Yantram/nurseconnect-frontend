import { useState } from "react";
import { Loader2, Navigation } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export type Address = {
  id: string;
  label: string;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  landmark?: string | null;
  is_default: boolean;
};

export const EMPTY_ADDRESS = {
  label: "Home", recipient_name: "", recipient_phone: "", line1: "", line2: "",
  city: "", state: "", pincode: "", landmark: "", latitude: null as number | null,
  longitude: null as number | null, is_default: false,
};

// Reverse-geocode GPS to an address via OpenStreetMap Nominatim (free, no key).
export async function reverseGeocode(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { "Accept-Language": "en" },
    });
    const j = await r.json();
    const a = j.address ?? {};
    return {
      line1: [a.house_number, a.road].filter(Boolean).join(" ") || j.display_name?.split(",")[0] || "",
      line2: [a.suburb, a.neighbourhood].filter(Boolean).join(", "),
      city: a.city || a.town || a.village || a.county || "",
      state: a.state || "",
      pincode: a.postcode || "",
    };
  } catch {
    return null;
  }
}

// Returns the saved address (with id) via onSaved so callers can auto-select it.
export function AddressForm({
  initial, onCancel, onSaved,
}: {
  initial: typeof EMPTY_ADDRESS & { id?: string };
  onCancel: () => void;
  onSaved: (saved: Address) => void | Promise<void>;
}) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function useMyLocation() {
    setError(null); setLocating(true);
    if (!navigator.geolocation) { setError("Location not available"); setLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const g = await reverseGeocode(latitude, longitude);
        setF((s) => ({ ...s, latitude, longitude, ...(g ?? {}) }));
        setLocating(false);
      },
      () => { setError("Couldn't get your location. Enter it manually."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function save() {
    setError(null);
    if (!f.line1.trim()) { setError("Address line 1 is required"); return; }
    setBusy(true);
    try {
      const body = JSON.stringify(f);
      const saved: Address = f.id
        ? await apiFetch(`/api/consumers/me/addresses/${f.id}`, { method: "PUT", body })
        : await apiFetch("/api/consumers/me/addresses", { method: "POST", body });
      await onSaved(saved);
    } catch (e: any) { setError(String(e?.message ?? e)); } finally { setBusy(false); }
  }

  const inp = (k: keyof typeof EMPTY_ADDRESS, ph: string, cls = "") => (
    <input value={(f as any)[k] ?? ""} onChange={(e) => set(k as string, e.target.value)} placeholder={ph}
      className={cn("rounded-lg border border-border bg-background px-3 py-2 text-[13px]", cls)} />
  );

  return (
    <div className="rounded-xl border border-primary/20 bg-card px-5 py-4">
      <p className="text-[14px] font-bold text-foreground mb-3">{f.id ? "Edit address" : "New address"}</p>

      <button onClick={useMyLocation} disabled={locating}
        className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 text-[12.5px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">
        {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
        Use my current location
      </button>
      {f.latitude != null && <p className="mb-2 text-[11px] text-emerald-700">Location captured · pin set</p>}

      <div className="grid grid-cols-2 gap-2">
        <select value={f.label} onChange={(e) => set("label", e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[13px]">
          <option>Home</option><option>Work</option><option>Other</option>
        </select>
        {inp("pincode", "PIN code")}
        {inp("line1", "Flat / House no, Building *", "col-span-2")}
        {inp("line2", "Area / Street", "col-span-2")}
        {inp("landmark", "Landmark (optional)", "col-span-2")}
        {inp("city", "City")}
        {inp("state", "State")}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-[11.5px] font-semibold text-muted-foreground mb-2">Booking for someone else? (optional)</p>
        <div className="grid grid-cols-2 gap-2">
          {inp("recipient_name", "Recipient name")}
          {inp("recipient_phone", "Recipient phone")}
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-foreground">
        <input type="checkbox" checked={f.is_default} onChange={(e) => set("is_default", e.target.checked)} />
        Set as default address
      </label>

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-border px-4 py-2 text-[13px] font-semibold hover:bg-muted">Cancel</button>
        <button onClick={save} disabled={busy} className="flex-1 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
          {busy ? "Saving…" : "Save address"}
        </button>
      </div>
    </div>
  );
}
