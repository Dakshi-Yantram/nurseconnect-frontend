import { useEffect, useMemo, useState } from "react";
import { Loader2, Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { AddressPicker } from "@/components/AddressPicker";
import { forwardGeocode } from "@/lib/geocode";
import { SlotPicker, type SlotChoice } from "@/components/booking/SlotPicker";
import { ConsentForm } from "@/components/booking/ConsentForm";
import { VerificationPanel, type VerificationState } from "@/components/booking/VerificationPanel";
import { ReadMore } from "@/components/booking/ReadMore";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { fetchConsentOnFile, recordCareConsent, type ConsentOnFile } from "@/lib/consent";
import {
  optionLabel, type PackageGroup, type PackageMaterial,
} from "@/lib/package-materials";
import type { PackageEntity } from "@/lib/domain";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary";

/** Two-step picker: service type (group) → option. Falls back to a flat list. */
function PackageSelect({
  groups, packages, value, onChange,
}: {
  groups: PackageGroup[] | null;
  packages: PackageEntity[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const active = packages.filter((p) => p.rawStatus === "active");
  if (groups && groups.length > 0) {
    const visible = groups.filter((g) => g.options.some((o) => active.some((p) => p.id === o.id)));
    const gi = visible.findIndex((g) => g.options.some((o) => o.id === value));
    const group = gi >= 0 ? visible[gi] : null;
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-foreground">Care package *</span>
          <select
            className={field}
            value={gi >= 0 ? String(gi) : ""}
            onChange={(e) => onChange(visible[Number(e.target.value)]?.options[0]?.id)}
          >
            {gi < 0 && <option value="">Select a care package</option>}
            {visible.map((g, i) => <option key={`${g.heading}-${i}`} value={i}>{g.title || g.heading}</option>)}
          </select>
        </label>
        {group && group.type === "dropdown" && (
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-foreground">{group.heading} *</span>
            <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
              {group.options.map((o) => <option key={o.id} value={o.id}>{optionLabel(o)}</option>)}
            </select>
          </label>
        )}
      </div>
    );
  }
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-foreground">Care package *</span>
      <select className={field} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Select a care package</option>
        {active.map((p) => {
          const price = p.packagePrice ?? p.perVisitPrice;
          return <option key={p.id} value={p.id}>{p.name}{price != null ? ` — ${inr(price)}` : ""}</option>;
        })}
      </select>
    </label>
  );
}

type Step = "form" | "verify";

/**
 * The whole "New care booking" flow in one modal:
 *   form (address, package, patient, materials, slot, consent)  →
 *   verification (prescription + live photo, only when the package needs it)  →
 *   onReadyToPay(booking)  (the page then runs the materials check and payment).
 */
export function NewBookingModal({
  open, onClose, packages, groups, patients, initialPackageId, onReadyToPay,
}: {
  open: boolean;
  onClose: () => void;
  packages: PackageEntity[];
  groups: PackageGroup[] | null;
  patients: { id: string; name: string; plan?: string }[];
  initialPackageId?: string;
  onReadyToPay: (booking: any) => void;
}) {
  const [step, setStep] = useState<Step>("form");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | undefined>(initialPackageId);
  const [patientId, setPatientId] = useState<string>("");
  const [slot, setSlot] = useState<SlotChoice | null>(null);
  const [notes, setNotes] = useState("");
  const [suppliesMode, setSuppliesMode] = useState<"own" | "nurse_brings">("own");
  const [materials, setMaterials] = useState<PackageMaterial[]>([]);
  const [consentOnFile, setConsentOnFile] = useState<ConsentOnFile | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [consentSaved, setConsentSaved] = useState(false);
  const [verif, setVerif] = useState<VerificationState | null>(null);

  // Reset whenever the modal is (re)opened.
  useEffect(() => {
    if (!open) return;
    setStep("form");
    setPackageId(initialPackageId);
    setSlot(null);
    setNotes("");
    setSuppliesMode("own");
    setConsentChecked(false);
    setCreated(null);
    setConsentSaved(false);
    setVerif(null);
  }, [open, initialPackageId]);

  useEffect(() => {
    if (open && !patientId && patients.length > 0) setPatientId(patients[0].id);
  }, [open, patients, patientId]);

  const pkg = useMemo(() => packages.find((p) => p.id === packageId), [packages, packageId]);
  const patient = patients.find((p) => p.id === patientId);
  const needsSuppliesChoice = !!pkg?.requiresPrescription && !pkg?.materialIncluded;

  // Materials the nurse can bring (priced) — only fetched when relevant.
  useEffect(() => {
    setMaterials([]);
    if (!open || !packageId || !needsSuppliesChoice) return;
    let alive = true;
    apiFetch(`/api/care-packages/${packageId}/materials`)
      .then((r: any) => { if (alive) setMaterials(Array.isArray(r) ? r : []); })
      .catch(() => { /* feature off: only "I'll arrange" is offered */ });
    return () => { alive = false; };
  }, [open, packageId, needsSuppliesChoice]);

  useEffect(() => { if (!needsSuppliesChoice) setSuppliesMode("own"); }, [needsSuppliesChoice]);

  // Consent already on file for this patient? Then don't ask again.
  useEffect(() => {
    setConsentOnFile(null);
    setConsentChecked(false);
    if (!open || !patientId) return;
    let alive = true;
    fetchConsentOnFile(patientId).then((c) => { if (alive) setConsentOnFile(c); });
    return () => { alive = false; };
  }, [open, patientId]);

  const materialsTotal = materials.reduce((s, m) => s + Number(m.price || 0) * Number(m.quantity || 1), 0);
  const basePrice = pkg ? (pkg.packagePrice ?? pkg.perVisitPrice ?? null) : null;
  const addOn = suppliesMode === "nurse_brings" && needsSuppliesChoice ? materialsTotal : 0;
  const estimate = basePrice != null ? basePrice + addOn + (slot?.surcharge ?? 0) : null;

  const consentOk = !!consentOnFile || consentChecked;
  const canSubmit = !!addressId && !!pkg && !!patient && !!slot && consentOk && !busy;

  // Saved addresses created before coordinates were captured have none. Resolve
  // them from the typed text and store them, so the booking never depends on the
  // customer pressing "Use current location".
  async function ensureAddressHasLocation(id: string) {
    let list: any[] = [];
    try { list = await apiFetch("/api/consumers/me/addresses"); } catch { return; }
    const a = list.find((x) => x.id === id);
    if (!a) return;
    const has = a.latitude != null && a.longitude != null && !(Number(a.latitude) === 0 && Number(a.longitude) === 0);
    if (has) return;
    const found = await forwardGeocode(a);
    if (!found) return; // backend will try too, and show its own message
    try {
      await apiFetch(`/api/consumers/me/addresses/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          label: a.label, recipient_name: a.recipient_name, recipient_phone: a.recipient_phone,
          line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode,
          landmark: a.landmark, is_default: !!a.is_default, ...found,
        }),
      });
    } catch { /* non-fatal: backend resolves from the address text as well */ }
  }

  const submit = async () => {
    if (!canSubmit || !pkg || !patient || !slot) return;
    setBusy(true);
    try {
      let booking = created;
      if (!booking) {
        await ensureAddressHasLocation(addressId!);
        booking = await apiFetch("/api/bookings/", {
          method: "POST",
          body: JSON.stringify({
            patient_id: patient.id,
            package_id: pkg.id,
            booking_type: "one_time",
            scheduled_date: slot.date,
            scheduled_start_time: `${slot.time}:00`,
            is_urgent: false,
            address_id: addressId,
            supplies_mode: needsSuppliesChoice ? suppliesMode : undefined,
            special_instructions: notes.trim() || undefined,
          }),
        });
        setCreated(booking);
      }
      if (!consentOnFile && !consentSaved) {
        await recordCareConsent({
          patientId: patient.id,
          bookingId: booking.id,
          signedByName: patient.name,
          relationship: (patient.plan ?? "").toLowerCase() === "self" ? "self" : "family",
        });
        setConsentSaved(true);
      }
      // Prescription / medicine photo needed before payment?
      let v: VerificationState | null = null;
      try { v = await apiFetch(`/api/bookings/${booking.id}/verification`); } catch { /* none */ }
      if (v && v.required && !v.can_pay) {
        setVerif(v);
        setStep("verify");
      } else {
        onReadyToPay(booking);
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, "We couldn't create the booking. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const title = step === "form" ? "New care booking" : "Prescription & medicines";

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {step === "verify" && created ? (
        <div className="space-y-4">
          <VerificationPanel
            mode={{ kind: "booking", bookingId: created.id }}
            onChange={(s) => setVerif(s)}
          />
          <button
            type="button"
            disabled={!verif?.can_pay}
            onClick={() => onReadyToPay(created)}
            className="w-full rounded-lg bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Continue to payment
          </button>
          <p className="text-[11.5px] text-muted-foreground text-center">
            Your booking is saved. You can also finish this later from the booking page.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AddressPicker value={addressId} onChange={setAddressId} />

          <PackageSelect groups={groups} packages={packages} value={packageId} onChange={setPackageId} />

          {pkg && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{pkg.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {[
                      pkg.visitsPerCycle != null ? `${pkg.visitsPerCycle} visits` : null,
                      pkg.cycleDurationDays != null ? `${pkg.cycleDurationDays} days` : null,
                    ].filter(Boolean).join(" · ") || "Structured care package"}
                  </p>
                </div>
                {basePrice != null && <p className="text-[15px] font-semibold text-primary shrink-0">{inr(basePrice)}</p>}
              </div>
              {(pkg.description || pkg.tagline) && (
                <div className="mt-2"><ReadMore text={(pkg.description || pkg.tagline)!} lines={2} /></div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pkg.requiresPrescription && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10.5px] font-medium text-amber-800">Needs doctor's prescription</span>}
                {pkg.materialIncluded && <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10.5px] font-medium text-emerald-800">Materials included</span>}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-foreground">Patient *</span>
            <select className={field} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              {patients.length === 0 && <option value="">No patients added yet</option>}
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          {needsSuppliesChoice && (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <PackageIcon className="h-4 w-4 text-primary" /> Medicines & materials
              </legend>
              {([
                { v: "own" as const, t: "I'll arrange the medicines & materials", d: "You will upload the prescription and a live photo of the medicines before paying." },
                ...(materials.length > 0
                  ? [{ v: "nurse_brings" as const, t: `Add materials — ${inr(materialsTotal)}`, d: "The nurse brings the required materials. Prescription is still needed." }]
                  : []),
              ]).map((o) => (
                <label key={o.v} className={cn(
                  "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 cursor-pointer",
                  suppliesMode === o.v ? "border-primary bg-primary/5" : "border-border",
                )}>
                  <input type="radio" name="supplies" className="mt-1 accent-[var(--primary,#0a7)]" checked={suppliesMode === o.v} onChange={() => setSuppliesMode(o.v)} />
                  <span>
                    <span className="block text-[13px] font-medium text-foreground">{o.t}</span>
                    <span className="block text-[12px] text-muted-foreground">{o.d}</span>
                  </span>
                </label>
              ))}
              {suppliesMode === "nurse_brings" && materials.length > 0 && (
                <ul className="rounded-lg bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground space-y-0.5">
                  {materials.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span>{m.name}{Number(m.quantity) > 1 ? ` × ${m.quantity}` : ""}</span>
                      <span>{inr(Number(m.price || 0) * Number(m.quantity || 1))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}

          <SlotPicker value={slot} onChange={setSlot} />

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-foreground">Notes for the nurse (optional)</span>
            <textarea className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, allergies, anything we should know" />
          </label>

          <ConsentForm
            patientName={patient?.name ?? ""}
            onFile={consentOnFile}
            accepted={consentChecked}
            onAcceptedChange={setConsentChecked}
          />

          {estimate != null && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
              <span className="text-[13px] text-muted-foreground">Total (all taxes & fees included)</span>
              <span className="text-[16px] font-semibold text-foreground">{inr(estimate)}</span>
            </div>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {created ? "Continue" : "Continue to payment"}
          </button>
          {!addressId && <p className="text-[12px] text-amber-700 text-center">Please select or add a service address.</p>}
        </div>
      )}
    </Modal>
  );
}
