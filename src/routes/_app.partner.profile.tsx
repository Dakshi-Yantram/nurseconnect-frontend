import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, ArrowLeft, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/partner/profile")({
  component: PartnerProfile,
  head: () => ({ meta: [{ title: "Complete Profile — NurseConnect" }] }),
});

function PartnerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [registrationAuthority, setRegistrationAuthority] = useState("");
  const [registrationValidUntil, setRegistrationValidUntil] = useState("");

  // Home / service area — determines which bookings fall within reach.
  const [homeAddress, setHomeAddress] = useState("");
  const [baseCity, setBaseCity] = useState("");
  const [serviceRadius, setServiceRadius] = useState("10");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Bank details — required before a payout can actually be transferred.
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiFetch("/api/workers/me");
      setDateOfBirth(me.date_of_birth ?? "");
      setRegistrationNo(me.registration_no ?? "");
      setRegistrationAuthority(me.registration_authority ?? "");
      setRegistrationValidUntil(me.registration_valid_until ?? "");
      setHomeAddress(me.home_address ?? "");
      setBaseCity(me.base_city ?? "");
      setServiceRadius(me.service_radius_km != null ? String(me.service_radius_km) : "10");
      setHomeLat(me.home_latitude != null ? Number(me.home_latitude) : null);
      setHomeLng(me.home_longitude != null ? Number(me.home_longitude) : null);
      setBankHolder(me.bank_account_holder ?? "");
      setBankAccount(me.bank_account_number ?? "");
      setBankIfsc(me.bank_ifsc ?? "");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function captureLocation() {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError("Your browser can't share location. Enter your city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHomeLat(pos.coords.latitude);
        setHomeLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location. Allow access or enter your city.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      // Core registration details.
      await apiFetch("/api/workers/me", {
        method: "PUT",
        body: JSON.stringify({
          date_of_birth: dateOfBirth || undefined,
          registration_no: registrationNo || undefined,
          registration_authority: registrationAuthority || undefined,
          registration_valid_until: registrationValidUntil || undefined,
        }),
      });

      // Home / service area — separate endpoint (feeds dispatch radius).
      // Send the precise lat/lng too when captured, so dispatch measures real
      // distance rather than falling back to the city centroid.
      if (homeAddress.trim() || baseCity.trim() || (homeLat != null && homeLng != null)) {
        await apiFetch("/api/workers/me/service-area", {
          method: "PUT",
          body: JSON.stringify({
            home_address: homeAddress.trim() || undefined,
            base_city: baseCity.trim() || undefined,
            service_radius_km: Number(serviceRadius) || 10,
            latitude: homeLat ?? undefined,
            longitude: homeLng ?? undefined,
          }),
        });
      }

      // Bank details — only when all three are present, since the endpoint
      // requires the full set. Partial bank info is worse than none (a payout
      // would fail), so we don't send it until it's complete.
      if (bankHolder.trim() && bankAccount.trim() && bankIfsc.trim()) {
        await apiFetch("/api/workers/me/bank-details", {
          method: "PUT",
          body: JSON.stringify({
            bank_account_holder: bankHolder.trim(),
            bank_account_number: bankAccount.trim(),
            bank_ifsc: bankIfsc.trim().toUpperCase(),
          }),
        });
      }

      setSuccess(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-md px-4 py-8 space-y-4">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workspace
        </Link>

        <div>
          <h1 className="text-[18px] font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            These details are required before you can submit for review.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <FieldInput
            label="Date of Birth"
            type="date"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            required
          />
          <FieldInput
            label="Nursing Registration Number"
            type="text"
            value={registrationNo}
            onChange={setRegistrationNo}
            placeholder="e.g. RN123456"
            required
          />
          <FieldInput
            label="Registration Authority"
            type="text"
            value={registrationAuthority}
            onChange={setRegistrationAuthority}
            placeholder="e.g. Indian Nursing Council"
            required
          />
          <FieldInput
            label="Registration Valid Until"
            type="date"
            value={registrationValidUntil}
            onChange={setRegistrationValidUntil}
            required
          />

          <div className="pt-2 border-t border-border">
            <p className="text-[13px] font-semibold text-foreground mb-1">Home &amp; service area</p>
            <p className="text-[11.5px] text-muted-foreground mb-3">
              Where you're based and how far you'll travel. Used to match you with nearby visits.
            </p>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Full street address
                </label>
                <textarea
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  placeholder="House/flat no., street, area, landmark"
                  rows={3}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              <FieldInput
                label="Home city"
                type="text"
                value={baseCity}
                onChange={setBaseCity}
                placeholder="e.g. Hyderabad"
              />
              <FieldInput
                label="Travel radius (km)"
                type="number"
                value={serviceRadius}
                onChange={setServiceRadius}
                placeholder="10"
              />
              <div>
                <button
                  type="button"
                  onClick={captureLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12px] font-medium text-foreground hover:bg-secondary disabled:opacity-40"
                >
                  {locating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                  {locating ? "Getting location…" : "Use my current location"}
                </button>
                {homeLat != null && homeLng != null && (
                  <p className="mt-1.5 text-[11px] text-emerald-600">
                    Pinned at {homeLat.toFixed(5)}, {homeLng.toFixed(5)}
                  </p>
                )}
                {locError && <p className="mt-1.5 text-[11px] text-red-600">{locError}</p>}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-[13px] font-semibold text-foreground mb-1">Bank details</p>
            <p className="text-[11.5px] text-muted-foreground mb-3">
              Where your payouts are sent. Required before a completed-visit payout can be paid out.
            </p>
            <div className="space-y-4">
              <FieldInput
                label="Account holder name"
                type="text"
                value={bankHolder}
                onChange={setBankHolder}
                placeholder="As printed on your bank account"
              />
              <FieldInput
                label="Account number"
                type="text"
                value={bankAccount}
                onChange={setBankAccount}
                placeholder="Your bank account number"
              />
              <FieldInput
                label="IFSC code"
                type="text"
                value={bankIfsc}
                onChange={setBankIfsc}
                placeholder="e.g. HDFC0001234"
              />
            </div>
          </div>

          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          {success && <p className="text-[12.5px] text-emerald-600">Profile updated successfully!</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}