import { apiErrorMessage, apiFetch as sharedApiFetch } from "@/lib/api";
import { createFileRoute, Link, Outlet, useRouterState, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { Modal } from "@/components/shared/Modal";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { NewBookingModal } from "@/components/booking/NewBookingModal";
import { ReadMore } from "@/components/booking/ReadMore";
import { searchItems } from "@/lib/package-search";
import { useAuth } from "@/lib/auth-context";
import {
  useBookings, useConsumerPatients, usePackages, useRefetchBookings, type PackageEntity,
} from "@/lib/domain";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import {
  CalendarCheck, ChevronRight, Clock, HeartPulse, Search, X,
  History as HistoryIcon, AlertTriangle, Plus, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { PaymentDialog } from "@/components/PaymentDialog";
import { VisitOtpChip } from "@/components/VisitOtpChip";
import { MaterialsChecklist } from "@/components/MaterialsChecklist";
import {
  allMaterialsChecked, optionLabel, optionPrice, packageMaterialsApi,
  type PackageGroup, type PackageMaterial,
} from "@/lib/package-materials";

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
  const [pendingBooking, setPendingBooking] = useState<any>(null);
  // Grouped catalogue (dropdown cards). null => feature off / not loaded: old flat list.
  const [groups, setGroups] = useState<PackageGroup[] | null>(null);
  // Booking-stage materials confirmation (shown between booking and payment).
  const [matStep, setMatStep] = useState<{ booking: any; materials: PackageMaterial[] } | null>(null);
  const [matChecked, setMatChecked] = useState<Record<string, boolean>>({});
  const [matBusy, setMatBusy] = useState(false);
  const [prefillPackageId, setPrefillPackageId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");

  const bookings = useBookings();
  const patients = useConsumerPatients(user?.id);
  const packages = usePackages();
  const refetchBookings = useRefetchBookings();

  useEffect(() => {
    packageMaterialsApi.listGrouped().then(setGroups).catch(() => setGroups(null));
  }, []);

  // Auto-open "New booking" when navigated here with ?new=1 (Care Package "Book").
  useEffect(() => {
    if (search.new) {
      if (search.packageId) setPrefillPackageId(search.packageId);
      setOpen(true);
      navigate({ to: "/consumer/bookings", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.new, search.package, search.packageId]);

  const openNewBooking = () => { setPrefillPackageId(undefined); setOpen(true); };
  const openBookingForPackage = (pkg: PackageEntity) => { setPrefillPackageId(pkg.id); setOpen(true); };

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
      b.rawStatus === "prescription_pending" ||
      b.rawStatus === "searching_nurse" ||
      b.rawStatus === "quality_discrepancy_alert" ||
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

  // Called by the booking modal once the booking exists and any prescription /
  // medicine photo has been collected. Next: materials check, then payment.
  const onReadyToPay = async (created: any) => {
    setOpen(false);
    let mats: PackageMaterial[] = [];
    try {
      const m = await packageMaterialsApi.getForBooking(created.id);
      mats = m && !m.acks?.booking ? (m.materials ?? []) : [];
    } catch { /* optional; server payment gate still applies */ }
    if (mats.length > 0) {
      setMatChecked({});
      setMatStep({ booking: created, materials: mats });
    } else {
      setPendingBooking(created);
    }
    refetchBookings();
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

        <CarePackagesGrid
          packages={packages} groups={groups} onBook={openBookingForPackage}
          query={query} onQuery={setQuery}
        />

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

      <NewBookingModal
        open={open}
        onClose={() => { setOpen(false); refetchBookings(); }}
        packages={packages}
        groups={groups}
        patients={patients}
        initialPackageId={prefillPackageId}
        onReadyToPay={onReadyToPay}
      />
      <Modal
        open={matStep !== null}
        onClose={() => { /* must confirm to continue; booking stays in "pending payment" */ setMatStep(null); }}
        title="Confirm materials"
      >
        {matStep && (
          <div className="space-y-4">
            <p className="text-[12.5px] text-muted-foreground">
              Please check that these items are available for the visit. You will see this list once more before payment.
            </p>
            <MaterialsChecklist materials={matStep.materials} checked={matChecked} onChange={setMatChecked} />
            <button
              disabled={matBusy || !allMaterialsChecked(matStep.materials, matChecked)}
              onClick={async () => {
                setMatBusy(true);
                try {
                  await packageMaterialsApi.ack(matStep.booking.id, "booking", matChecked);
                  const b = matStep.booking;
                  setMatStep(null);
                  setPendingBooking(b);
                } catch (e) {
                  toast.error(apiErrorMessage(e, "Couldn't save the confirmation. Please try again."));
                } finally {
                  setMatBusy(false);
                }
              }}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {matBusy ? "Saving…" : "Confirm & continue to payment"}
            </button>
          </div>
        )}
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
                  {b.bookingRef ? `${b.bookingRef} · ` : ""}{b.service ?? "Care visit"} · {b.patientName ?? "—"}
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
// One card per group: title, option dropdown (when it is a dropdown group), price, Book.
function GroupCard({
  group, packages, onBook,
}: { group: PackageGroup; packages: PackageEntity[]; onBook: (pkg: PackageEntity) => void }) {
  const opts = group.options.filter(o => packages.some(p => p.id === o.id && p.rawStatus === "active"));
  const [sel, setSel] = useState(opts[0]?.id);
  if (opts.length === 0) return null;
  const cur = opts.find(o => o.id === sel) ?? opts[0];
  const pkg = packages.find(p => p.id === cur.id)!;
  const price = optionPrice(cur);
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-[14px] font-semibold text-foreground">
        {group.type === "dropdown" ? (group.title || group.heading) : cur.name}
      </h3>
      {group.type === "dropdown" && (
        <select
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          value={cur.id}
          onChange={e => setSel(e.target.value)}
        >
          {opts.map(o => <option key={o.id} value={o.id}>{optionLabel(o)}</option>)}
        </select>
      )}
      <div className="mt-3 min-h-[36px]">
        <ReadMore
          text={cur.description || cur.included_scope || "Structured visits from verified care professionals."}
          lines={3}
          extra={(cur.included_scope && cur.description) || cur.scope_boundary || cur.dropdown_note ? (
            <div className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {cur.included_scope && cur.description && <p><span className="font-semibold text-foreground">Included: </span>{cur.included_scope}</p>}
              {cur.scope_boundary && <p><span className="font-semibold text-foreground">Not included: </span>{cur.scope_boundary}</p>}
              {cur.dropdown_note && <p>{cur.dropdown_note}</p>}
            </div>
          ) : undefined}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cur.requires_prescription && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10.5px] font-medium text-amber-800">Needs doctor's prescription</span>}
        {cur.material_included && <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10.5px] font-medium text-emerald-800">Materials included</span>}
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
}

function CarePackagesGrid({
  packages, groups, onBook, query, onQuery,
}: {
  packages: PackageEntity[]; groups: PackageGroup[] | null; onBook: (pkg: PackageEntity) => void;
  query: string; onQuery: (q: string) => void;
}) {
  const active = packages.filter(p => p.rawStatus === "active");

  const useGroups = !!groups && groups.length > 0;
  const textOfGroup = (g: PackageGroup) =>
    [g.title, g.heading, g.category, ...g.options.flatMap(o => [o.name, o.dropdown_option, o.description, o.included_scope])]
      .filter(Boolean).join(" ");
  const textOfPkg = (p: PackageEntity) =>
    [p.name, p.code, p.tagline, p.description, p.targetCondition].filter(Boolean).join(" ");

  const groupRes = useMemo(
    () => (useGroups ? searchItems(groups!, query, textOfGroup) : null),
    [useGroups, groups, query],
  );
  const flatRes = useMemo(
    () => (!useGroups ? searchItems(active, query, textOfPkg) : null),
    [useGroups, active, query],
  );
  const visibleGroups = groupRes?.items ?? [];
  const visibleFlat = flatRes?.items ?? [];
  const noMatch = query.trim() !== "" && (useGroups ? visibleGroups.length === 0 : visibleFlat.length === 0);
  const didYouMean = (groupRes ?? flatRes)?.didYouMean ?? null;
  const examples = (useGroups
    ? groups!.map(g => g.title || g.heading)
    : active.map(p => p.name)
  ).filter(Boolean).slice(0, 4);

  if (active.length === 0) return null;

  const searchBox = (
    <div className="px-4 pt-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search care packages — e.g. injection, wound dressing, elderly care"
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-9 text-[13px] outline-none focus:border-primary"
          aria-label="Search care packages"
        />
        {query && (
          <button type="button" onClick={() => onQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  const notFound = noMatch && (
    <div className="m-4 rounded-xl border border-dashed border-border px-4 py-6 text-center">
      <p className="text-[14px] font-semibold text-foreground">Package not found</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        We couldn't find "{query.trim()}". Try searching with different keywords.
      </p>
      {didYouMean && (
        <p className="mt-2 text-[12.5px]">
          Did you mean{" "}
          <button type="button" onClick={() => onQuery(didYouMean)} className="font-semibold text-primary underline">{didYouMean}</button>?
        </p>
      )}
      {examples.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {examples.map(ex => (
            <button key={ex} type="button" onClick={() => onQuery(ex)} className="rounded-full border border-border px-3 py-1 text-[12px] hover:border-primary hover:text-primary">
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (useGroups) {
    return (
      <Card title="Care Packages" padded={false}>
        {searchBox}
        {notFound}
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((g, i) => <GroupCard key={`${g.heading}-${i}`} group={g} packages={packages} onBook={onBook} />)}
        </div>
      </Card>
    );
  }

  return (
    <Card title="Care Packages" padded={false}>
      {searchBox}
      {notFound}
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleFlat.map(pkg => {
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

              <div className="mt-3 min-h-[36px]">
                <ReadMore
                  text={pkg.tagline || pkg.description || pkg.targetCondition || "Structured visits from verified care professionals."}
                  lines={2}
                  extra={pkg.description && pkg.tagline ? <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{pkg.description}</p> : undefined}
                />
              </div>

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