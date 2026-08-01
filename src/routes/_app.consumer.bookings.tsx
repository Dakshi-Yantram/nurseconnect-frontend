import { createFileRoute, Link, Outlet, useRouterState, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { Modal } from "@/components/shared/Modal";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { SchemaForm } from "@/lib/forms/SchemaForm";
import { BOOKING_REQUEST_SCHEMA } from "@/lib/forms/templates";
import type { FormSchema } from "@/lib/forms/schema";
import { useAuth } from "@/lib/auth-context";
import {
  useBookings, useConsumerPatients, usePackages, useRefetchBookings, type PackageEntity,
} from "@/lib/domain";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import {
  CalendarCheck, ChevronRight, Clock, HeartPulse,
  History as HistoryIcon, AlertTriangle, Plus, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { AddressPicker } from "@/components/AddressPicker";
import { PaymentDialog } from "@/components/PaymentDialog";
import { VisitOtpChip } from "@/components/VisitOtpChip";

export const Route = createFileRoute("/_app/consumer/bookings")({
  component: BookingsLayout,
  head: () => ({ meta: [{ title: "Bookings – NurseConnect" }] }),
  // Explicit optional-fields return type — without it TS infers each key as
  // "required, value possibly undefined" rather than truly optional, which
  // forces a `search` prop on every `<Link to="/consumer/bookings">` /
  // `<Link to="/consumer/bookings/$bookingId">` across the app.
  validateSearch: (s: Record<string, unknown>): { new?: boolean; package?: string; packageId?: string } => ({
    new: s.new === "1" || s.new === "true" || s.new === true ? true : undefined,
    package: typeof s.package === "string" ? s.package : undefined,
    packageId: typeof s.packageId === "string" ? s.packageId : undefined,
  }),
});

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function apiPost(path: string, body: unknown) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.detail?.[0]?.msg ?? err?.detail ?? `Request failed (${res.status})`
    );
  }
  return res.json();
}

function BookingsLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (pathname === "/consumer/bookings") return <ConsumerBookings />;
  return <Outlet />;
}

function ConsumerBookings() {
  const { user } = useAuth();
  const search = useSearch({ from: "/_app/consumer/bookings" });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<any>(null);
  // Prefill notes + selection when arriving from a Care Package's "Book" button
  const [prefillNotes, setPrefillNotes] = useState<string | undefined>(undefined);
  const [prefillPackageId, setPrefillPackageId] = useState<string | undefined>(undefined);
  // Tracks the currently-selected package in the open form so the preview
  // panel below the dropdown can show its visits/days/price live.
  const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>(undefined);

  const bookings = useBookings();
  const patients = useConsumerPatients(user?.id);
  const packages = usePackages();
  const refetchBookings = useRefetchBookings();


  // Auto-open "New booking" modal when navigated here with ?new=1
  // (e.g. clicking "Book" on a Care Package card) — skips the extra click.
  useEffect(() => {
    if (search.new) {
      if (search.package) setPrefillNotes(`Package: ${search.package}`);
      if (search.packageId) { setPrefillPackageId(search.packageId); setSelectedPackageId(search.packageId); }
      setOpen(true);
      // clean the URL so a refresh/back doesn't reopen the modal
      navigate({ to: "/consumer/bookings", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.new, search.package, search.packageId]);

  // The only bookable unit is an admin-managed care package — no
  // standalone services. Price shown here always matches what admin set,
  // since it's read from the same /api/care-packages data admin writes to.
  const packageOptions = useMemo(() => {
    const activePackages = packages.filter(p => p.rawStatus === "active");
    return activePackages.map(p => {
      const price = p.packagePrice ?? p.perVisitPrice;
      return {
        label: `${p.name}${price != null ? ` — ₹${price.toLocaleString("en-IN")}` : ""}`,
        value: p.id,
      };
    });
  }, [packages]);

  const selectedPackage = useMemo(
    () => packages.find(p => p.id === selectedPackageId),
    [packages, selectedPackageId],
  );

  // "+ New Booking" — blank modal, full package dropdown to choose from.
  // Also clears the previously-selected service address: each booking is
  // for a specific patient, and a family account may have patients at
  // different locations, so the address choice must never silently carry
  // over from whichever booking was created last.
  const openNewBooking = () => {
    setPrefillNotes(undefined);
    setPrefillPackageId(undefined);
    setSelectedPackageId(undefined);
    setAddressId(null);
    setOpen(true);
  };

  // A package card's "Book" button — same modal, pre-filled and narrowed
  // to that one package so the choice made on the card carries through.
  const openBookingForPackage = (pkg: PackageEntity) => {
    setPrefillNotes(`Package: ${pkg.name}`);
    setPrefillPackageId(pkg.id);
    setSelectedPackageId(pkg.id);
    setAddressId(null);
    setOpen(true);
  };

  const liveSchema: FormSchema = useMemo(() => {
    const patientField = BOOKING_REQUEST_SCHEMA.sections[0].fields[0];
    const serviceField = BOOKING_REQUEST_SCHEMA.sections[0].fields[1];

    return {
      ...BOOKING_REQUEST_SCHEMA,
      sections: BOOKING_REQUEST_SCHEMA.sections.map((section, i) => {
        if (i !== 0) return section;
        return {
          ...section,
          fields: section.fields.map(f => {
            if (f.key === patientField.key) {
              return {
                ...f,
                kind: "select" as const,
                options: patients.map(p => ({ label: p.name, value: p.id })),
              };
            }
            if (f.key === serviceField.key) {
              // Coming from a Care Package's "Book" button — narrow the
              // dropdown to just that package so the choice made on the
              // Care Packages page carries through unambiguously.
              const filtered = prefillPackageId
                ? packageOptions.filter(o => o.value === prefillPackageId)
                : packageOptions;
              return { ...f, options: filtered };
            }
            return f;
          }),
        };
      }),
    };
  }, [patients, packageOptions, prefillPackageId]);

  // Buckets match the real backend BookingStatus values (app/models/enums.py):
  // draft, pending_payment, confirmed, assigned, worker_en_route,
  // worker_arrived, in_progress, completed, cancelled, missed,
  // rematch_pending, disputed. The previous version checked for
  // "pending"/"claimed"/"active"/"escalated", none of which the backend
  // ever produces — every booking from "nurse accepted" through "nurse
  // arrived" was silently falling through both buckets.
  const care = {
    all: bookings,
    upcoming: bookings.filter(b =>
      b.rawStatus === "pending_payment" ||
      b.rawStatus === "confirmed" ||
      b.rawStatus === "assigned" ||
      b.rawStatus === "worker_en_route" ||
      b.rawStatus === "worker_arrived" ||
      b.rawStatus === "rematch_pending"
    ),
    inCare: bookings.filter(b => b.rawStatus === "in_progress"),
    completed: bookings.filter(b =>
      b.rawStatus === "completed" ||
      b.rawStatus === "cancelled" ||
      b.rawStatus === "missed"
    ),
    escalated: bookings.filter(b => b.rawStatus === "disputed"),
  };

  const onCreate = async (values: Record<string, unknown>) => {
    const patient = patients.find(p => p.id === values.patient_name);
    if (!patient) {
      toast.error("Select a patient");
      return;
    }
    const packageId = String(values.service ?? "");
    if (!packages.some(p => p.id === packageId)) {
      toast.error("Select a care package");
      return;
    }
    if (!addressId) {
      toast.error("Select or add the patient's Rohini service address");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiPost("/api/bookings/", {
        patient_id: patient.id,
        // Prices from the package's own package_price/per_visit_price —
        // always the same number shown in the dropdown above and set by admin.
        package_id: packageId,
        booking_type: "one_time",
        scheduled_date: values.preferred_date,
        scheduled_start_time: (() => {
          const t = (values.preferred_time as string) || "10:00 AM";
          const [time, period] = t.split(" ");
          const [h, m] = time.split(":").map(Number);
          const hours24 = period === "PM" && h !== 12 ? h + 12 : (period === "AM" && h === 12 ? 0 : h);
          return `${String(hours24).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        })(),
        is_urgent: false,
        address_id: addressId,
        special_instructions: values.notes || undefined,
      });

      setOpen(false);
      setPendingBooking(created);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const isEmpty = care.all.length === 0;

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold">Booking journey</div>
            <div className="text-[12.5px] text-muted-foreground">
              Visits grouped by care stage — alerts, what's happening now, what's coming next, and what has recently completed.
            </div>
          </div>
          <button
            onClick={openNewBooking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 transition shrink-0"
          >
            <Plus className="h-4 w-4" /> New Booking
          </button>
        </div>

        <CarePackagesGrid packages={packages} onBook={openBookingForPackage} />

        {isEmpty ? (
          <Card><EmptyState icon={CalendarCheck} title="No bookings yet" description="Create your first booking to begin the care journey." /></Card>
        ) : (
          <>
            {care.escalated.length > 0 && (
              <RuntimeBoundary label="Care alerts">
                <JourneySection
                  title={<span className="flex items-center gap-2 text-rose-700"><AlertTriangle className="h-4 w-4" /> Needs review</span>}
                  rows={care.escalated} tone="rose"
                />
              </RuntimeBoundary>
            )}
            <RuntimeBoundary label="In care now">
              <JourneySection
                title={<span className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-emerald-600" /> In care now</span>}
                rows={care.inCare} tone="emerald"
                emptyHint="No visits are currently underway."
              />
            </RuntimeBoundary>
            <RuntimeBoundary label="Upcoming care">
              <JourneySection
                title={<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Upcoming</span>}
                rows={care.upcoming} tone="primary"
                emptyHint="No upcoming visits scheduled."
              />
            </RuntimeBoundary>
            <RuntimeBoundary label="Completed care">
              <JourneySection
                title={<span className="flex items-center gap-2"><HistoryIcon className="h-4 w-4 text-muted-foreground" /> Recently completed</span>}
                rows={care.completed} tone="muted"
                emptyHint="Completed visits will appear here."
              />
            </RuntimeBoundary>
          </>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setSelectedPackageId(prefillPackageId); }}
        title="New care booking"
      >
        <div className="space-y-4">
          <AddressPicker value={addressId} onChange={setAddressId} />

          {selectedPackage && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{selectedPackage.name}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  {[
                    selectedPackage.visitsPerCycle != null ? `${selectedPackage.visitsPerCycle} visits` : null,
                    selectedPackage.cycleDurationDays != null ? `${selectedPackage.cycleDurationDays} days` : null,
                  ].filter(Boolean).join(" · ") || "Structured care package"}
                </p>
              </div>
              {(selectedPackage.packagePrice ?? selectedPackage.perVisitPrice) != null && (
                <p className="text-[15px] font-semibold text-primary shrink-0">
                  ₹{(selectedPackage.packagePrice ?? selectedPackage.perVisitPrice)!.toLocaleString("en-IN")}
                </p>
              )}
            </div>
          )}

          <SchemaForm
            schema={liveSchema}
            onSubmit={onCreate}
            onValuesChange={(v) => setSelectedPackageId(typeof v.service === "string" ? v.service : undefined)}
            submitLabel="Request booking"
            initialValues={{
              ...(prefillNotes ? { notes: prefillNotes } : {}),
              ...(prefillPackageId ? { service: prefillPackageId } : {}),
            }}
          />
        </div>
      </Modal>
      <PaymentDialog
        booking={pendingBooking}
        open={pendingBooking !== null}
        onClose={() => setPendingBooking(null)}
        onConfirmed={async () => { setPendingBooking(null); await refetchBookings(); }}
      />
    </>
  );
}

// ── Journey section component ────────────────────────────────────────────────
function JourneySection({
  title,
  rows,
  tone,
  emptyHint,
}: {
  title: ReactNode;
  rows: any[];
  tone: string;
  emptyHint?: string;
}) {
  const accentMap: Record<string, string> = {
    rose: "text-rose-700",
    emerald: "text-emerald-600",
    primary: "text-primary",
    muted: "text-muted-foreground",
  };

  if (rows.length === 0 && !emptyHint) return null;

  return (
    <Card title={title} padded={false}>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-muted-foreground">{emptyHint}</p>
      ) : (
        rows.map((b) => {
          const state = bindStatus("booking", b.rawStatus);
          return (
            <Link
              key={b.id}
              to="/consumer/bookings/$bookingId"
              params={{ bookingId: b.id }}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">
                  #{b.id.slice(0, 8)} · {b.service ?? "Service"} · {b.patientName ?? "—"}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {b.area ?? "—"}{b.startedAt ? ` · ${b.startedAt}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <VisitOtpChip bookingId={b.id} status={b.rawStatus} />
                <StatusBadge workflow="booking" state={state} />
                <SLAIndicator workflow="booking" state={state} enteredAt={parseEnteredAt(b.startedAt)} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })
      )}
    </Card>
  );
}

// ── Care package cards — browse admin-managed packages, "Book" opens the
// same booking modal above, pre-filled to that package. ─────────────────────
function CarePackagesGrid({ packages, onBook }: { packages: PackageEntity[]; onBook: (pkg: PackageEntity) => void }) {
  const active = packages.filter(p => p.rawStatus === "active");
  if (active.length === 0) return null;

  return (
    <Card title="Care Packages" padded={false}>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {active.map(pkg => {
          const price = pkg.packagePrice ?? pkg.perVisitPrice;
          return (
            <article key={pkg.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-semibold text-foreground">{pkg.name}</h3>
                  {pkg.code && <p className="mt-0.5 text-[11px] text-muted-foreground">{pkg.code}</p>}
                </div>
                {pkg.insuranceCovered && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10.5px] font-medium text-sky-700 shrink-0">
                    <ShieldCheck className="h-3 w-3" /> Insurance
                  </span>
                )}
              </div>

              <p className="mt-3 line-clamp-2 min-h-[36px] text-[12.5px] leading-relaxed text-muted-foreground">
                {pkg.tagline || pkg.description || pkg.targetCondition || "Structured visits from verified care professionals."}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <PkgStat label="Visits" value={pkg.visitsPerCycle ?? "-"} />
                <PkgStat label="Days" value={pkg.cycleDurationDays ?? "-"} />
                <PkgStat label="Tier" value={(pkg.minTier ?? "-").replace("tier", "T")} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Package price</p>
                  <p className="text-[15px] font-semibold text-foreground">
                    {price != null ? `₹${price.toLocaleString("en-IN")}` : "Price on request"}
                  </p>
                </div>
                <button
                  onClick={() => onBook(pkg)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
                >
                  Book <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function PkgStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-secondary/60 px-2 py-2">
      <div className="text-[13px] font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}