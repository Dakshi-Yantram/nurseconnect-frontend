import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { Drawer } from "@/components/shared/Drawer";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import {
  AlertTriangle, BadgeIndianRupee, Banknote, CheckCircle2, Clock,
  FileText, Loader2, RefreshCw, Search, Send, XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/payout-release")({
  component: PayoutReleasePage,
  head: () => ({ meta: [{ title: "Payout Release — NurseConnect" }] }),
});

// ---------------------------------------------------------------------------
// Cash remittance — mirrors app/api/v1/payments.py:
// GET /payments/cash/outstanding/all, POST /payments/cash/remit/{id}
//
// Distinct from the payout table above: a payout is money the COMPANY owes
// a provider; outstanding cash is money a provider is HOLDING on the
// company's behalf after collecting it from a customer at a cash booking.
// The two nets automatically settle against each other at payout time
// (see payout_service.apply_cash_recovery), but a provider who does few or
// no online-payout bookings can accumulate cash with nothing to net it
// against — remittance is how that gets closed out directly instead of
// waiting indefinitely for a payout to come along.
// ---------------------------------------------------------------------------
interface OutstandingCashRow {
  booking_id: string;
  booking_ref: string | null;
  worker_id: string | null;
  worker_name: string | null;
  amount: number;
  collected_at: string | null;
}

// ---------------------------------------------------------------------------
// Types — mirror app/api/v1/admin.py: /worker-payouts/ready-for-release
// and /worker-payouts/{id}/breakdown
// ---------------------------------------------------------------------------
interface ReadyRow {
  payout_id: string;
  booking_id: string;
  booking_ref: string | null;
  worker_id: string;
  worker_name: string | null;
  worker_has_bank: boolean;
  customer_amount: number | null;
  nurse_payout_amount: number;
  gross_amount: number;
  status: string;
  approval_status: string;
  releasable: boolean;
  razorpay_payout_id: string | null;
  razorpay_status: string | null;
  utr: string | null;
  attempt_count: number;
  max_attempts: number;
  failure_reason: string | null;
  ready_for_release_at: string | null;
  released_at: string | null;
  paid_at: string | null;
}

interface RateCardRow {
  code: string;
  label: string;
  sac_code: string | null;
  package_rate: string;
  gst_rate_pct: string;
  gst_on_service: string;
  platform_fee: string;
  gst_on_platform_fee: string;
  platform_fee_gross: string;
  customer_line_total: string;
  worker_earning: string;
  commission_pct: string;
  is_exempt: boolean;
}

interface Breakdown {
  payout_id: string;
  booking_ref: string | null;
  customer_amount: number | null;
  invoice_number: string | null;
  invoice_pdf_url: string | null;
  calculation: {
    rate_card: RateCardRow[];
    customer: Record<string, string>;
    split: Record<string, string>;
    deductions: { code: string; label: string; amount: string; note: string | null }[];
    total_deductions: string;
    worker_net_payable: string;
  } | null;
  stored: { gross_amount: number; tds_deducted: number; net_amount: number };
  status: string;
  approval_status: string;
  razorpay_payout_id: string | null;
  razorpay_status: string | null;
  utr: string | null;
  attempt_count: number;
  max_attempts: number;
  failure_reason: string | null;
  released_at: string | null;
  paid_at: string | null;
}

// ---------------------------------------------------------------------------
// Money is formatted to paisa here, unlike the rounded display elsewhere in
// the admin app. On a screen whose purpose is authorising a bank transfer,
// a rounded figure that disagrees with the amount actually sent is worse
// than a slightly busier number.
// ---------------------------------------------------------------------------
const inr = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === ""
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }) : "—";

/**
 * Payout state as the admin should read it.
 *
 * `processing` deliberately does NOT read as success. The backend only sets
 * `paid` when Razorpay confirms a terminal `processed`, and this screen keeps
 * that distinction visible: an in-flight transfer is shown as awaiting bank
 * confirmation, never as money delivered.
 *
 * A payout whose money-movement `status` is still the default (pending) but
 * whose `approval_status` isn't yet "approved" is NOT ready for release —
 * it just hasn't been rejected either. Labelling that as "Ready for
 * Release" (as this used to) contradicted the "Needs approval" chip shown
 * right next to it and the Ready-for-Release count above the table, which
 * both correctly exclude it. So the default case now reads the approval
 * gate first.
 */
function payoutState(row: { status: string; razorpay_status: string | null; approval_status: string }) {
  switch (row.status) {
    case "paid":
      return row.razorpay_status === "manual_settlement"
        ? { label: "Settled manually", tone: "info" as const, icon: CheckCircle2 }
        : { label: "Paid", tone: "success" as const, icon: CheckCircle2 };
    case "processing":
      return { label: "Awaiting bank confirmation", tone: "warning" as const, icon: Clock };
    case "failed":
      return { label: "Failed", tone: "danger" as const, icon: XCircle };
    case "on_hold":
      return { label: "On hold", tone: "muted" as const, icon: AlertTriangle };
    default:
      return row.approval_status === "approved"
        ? { label: "Ready for release", tone: "primary" as const, icon: Banknote }
        : { label: "Awaiting approval", tone: "warning" as const, icon: Clock };
  }
}

function PayoutReleasePage() {
  const [rows, setRows] = useState<ReadyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detail, setDetail] = useState<Breakdown | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/admin/worker-payouts/ready-for-release")
      .then((data: ReadyRow[]) => setRows(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load payouts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Outstanding cash — independent load, own loading/error state, so a
  // slow or failing cash query never blocks the payout table above it.
  const [cashRows, setCashRows] = useState<OutstandingCashRow[]>([]);
  const [cashLoading, setCashLoading] = useState(true);
  const [cashBusyId, setCashBusyId] = useState<string | null>(null);

  const loadCash = () => {
    setCashLoading(true);
    apiFetch("/api/payments/cash/outstanding/all")
      .then((data: { total_outstanding: number; bookings: OutstandingCashRow[] }) =>
        setCashRows(data.bookings ?? []))
      .catch(() => setCashRows([]))
      .finally(() => setCashLoading(false));
  };

  useEffect(() => { loadCash(); }, []);

  const remitCash = async (bookingId: string) => {
    setCashBusyId(bookingId);
    try {
      await apiFetch(`/api/payments/cash/remit/${bookingId}`, { method: "POST" });
      toast.success("Cash marked as remitted.");
      loadCash();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record remittance");
    } finally {
      setCashBusyId(null);
    }
  };

  const openBreakdown = async (payoutId: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data: Breakdown = await apiFetch(`/api/admin/worker-payouts/${payoutId}/breakdown`);
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the breakdown");
    } finally {
      setDetailLoading(false);
    }
  };

  const release = async (payoutId: string) => {
    setBusyId(payoutId);
    setConfirmId(null);
    try {
      const result = await apiFetch(`/api/admin/worker-payouts/${payoutId}/release`, {
        method: "POST",
      });
      // The response distinguishes confirmed settlement from an accepted but
      // unconfirmed transfer, and the toast must not overstate either.
      if (result.already_released) {
        toast.info("Already released — no second transfer was made.");
      } else if (result.status === "paid" && result.manual) {
        toast.success("Recorded as a manual settlement (RazorpayX not configured).");
      } else if (result.status === "paid") {
        toast.success(`Payout confirmed by Razorpay${result.utr ? ` · UTR ${result.utr}` : ""}`);
      } else if (result.status === "processing") {
        toast.warning("Sent to Razorpay — awaiting bank confirmation.");
      } else if (result.status === "failed") {
        toast.error(result.error ?? "Payout failed.");
      } else {
        toast.info(`Payout status: ${result.status}`);
      }
      load();
      if (detail?.payout_id === payoutId) openBreakdown(payoutId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Release failed";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const syncStatus = async (payoutId: string) => {
    setBusyId(payoutId);
    try {
      const result = await apiFetch(`/api/admin/worker-payouts/${payoutId}/sync-status`, {
        method: "POST",
      });
      toast.info(
        result.status === "paid"
          ? `Confirmed paid${result.utr ? ` · UTR ${result.utr}` : ""}`
          : `Razorpay reports: ${result.razorpay_status ?? result.status}`,
      );
      load();
      if (detail?.payout_id === payoutId) openBreakdown(payoutId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach Razorpay");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => rows.filter((r) =>
      !query ||
      (r.worker_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (r.booking_ref ?? "").toLowerCase().includes(query.toLowerCase()),
    ),
    [rows, query],
  );

  const readyCount = rows.filter((r) => r.releasable).length;
  const inFlightCount = rows.filter((r) => r.status === "processing").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const readyValue = rows
    .filter((r) => r.releasable)
    .reduce((sum, r) => sum + Number(r.nurse_payout_amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold leading-tight">Payout Release</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Completed bookings whose nurse payout is ready to be released through Razorpay Payouts.
          A payout is only marked paid once Razorpay confirms the transfer.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Ready for Release</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-blue-600">{readyCount}</div>
        </div>
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Value to Release</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums">{inr(readyValue)}</div>
        </div>
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Awaiting Bank</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-amber-600">{inFlightCount}</div>
        </div>
        <div className="nc-card p-4">
          <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Failed</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-rose-600">{failedCount}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-9 pl-8 pr-3 text-[13px] rounded-md border border-border bg-background"
            placeholder="Search nurse or booking ref..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[12.5px] rounded-md border border-border text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && <div className="nc-card p-4 text-[13px] text-rose-600">{error}</div>}

      <Card
        title={
          <span className="flex items-center gap-2">
            <BadgeIndianRupee className="h-4 w-4 text-muted-foreground" />
            Payout queue
            <StatusChip label={filtered.length} tone="muted" />
          </span>
        }
        padded={false}
      >
        <div className="divide-y divide-border">
          {loading && <div className="px-5 py-6 text-[13px] text-muted-foreground">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              Nothing waiting for release.
            </div>
          )}
          {!loading && filtered.map((p) => {
            const state = payoutState(p);
            const isBusy = busyId === p.payout_id;
            return (
              <div key={p.payout_id} className="px-4 sm:px-5 py-3.5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">
                      {p.worker_name ?? "Unknown nurse"}
                      {p.booking_ref && (
                        <span className="text-muted-foreground font-normal"> · {p.booking_ref}</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      Customer paid {inr(p.customer_amount)} · Nurse receives{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {inr(p.nurse_payout_amount)}
                      </span>{" "}
                      · Ready {formatDateTime(p.ready_for_release_at)}
                    </div>
                    {!p.worker_has_bank && (
                      <div className="text-[11px] text-rose-600 mt-0.5">
                        No bank details on file — release will fail until they are added.
                      </div>
                    )}
                    {p.status === "failed" && p.failure_reason && (
                      <div className="text-[11px] text-rose-600 mt-0.5">
                        {p.failure_reason} (attempt {p.attempt_count}/{p.max_attempts})
                      </div>
                    )}
                    {p.utr && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        UTR {p.utr}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.approval_status !== "approved" && (
                      <StatusChip label="Needs approval" tone="warning" />
                    )}
                    <StatusChip label={state.label} tone={state.tone} dot />
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => openBreakdown(p.payout_id)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-border text-muted-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" /> View breakdown
                  </button>

                  {p.releasable && (
                    confirmId === p.payout_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-muted-foreground">
                          Send {inr(p.nurse_payout_amount)} to {p.worker_name}?
                        </span>
                        <button
                          onClick={() => release(p.payout_id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md bg-blue-600 text-white disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Confirm release
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="h-8 px-2 text-[12.5px] rounded-md border border-border"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(p.payout_id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md bg-blue-600 text-white disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" /> Release Payment
                      </button>
                    )
                  )}

                  {p.status === "processing" && (
                    <button
                      onClick={() => syncStatus(p.payout_id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-amber-200 text-amber-700 disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Check with Razorpay
                    </button>
                  )}

                  {p.approval_status !== "approved" && p.status !== "paid" && (
                    <span className="text-[11.5px] text-muted-foreground">
                      Approve this payout first on Payout Approvals.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Outstanding cash — see the type comment above for why this is a
          separate table rather than folded into the payout list above. */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-sky-700" />
            <h3 className="text-[14px] font-semibold text-foreground">
              Outstanding cash to remit
            </h3>
          </div>
          <button onClick={loadCash} disabled={cashLoading}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50">
            <RefreshCw size={13} className={cashLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-3">
          Cash a care professional collected at a visit but hasn&apos;t yet handed to the
          company. Confirming here records the remittance; it does not move any money —
          use it once you have actually received the cash from the provider.
        </p>
        {cashLoading ? (
          <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : cashRows.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-muted-foreground">
            No provider is currently holding uncollected cash.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {cashRows.map((r) => (
              <div key={r.booking_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate">
                    {r.worker_name ?? "Unknown provider"}
                    <span className="text-muted-foreground font-normal"> — {r.booking_ref ?? r.booking_id}</span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Collected {r.collected_at ? formatDateTime(r.collected_at) : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[13px] font-semibold tabular-nums">{inr(r.amount)}</span>
                  <button
                    onClick={() => remitCash(r.booking_id)}
                    disabled={cashBusyId === r.booking_id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {cashBusyId === r.booking_id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <CheckCircle2 size={13} />}
                    Mark remitted
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <BreakdownDrawer
        detail={detail}
        loading={detailLoading}
        onClose={() => setDetail(null)}
        onRelease={release}
        busy={busyId !== null}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakdown drawer — the complete calculation, admin only.
// ---------------------------------------------------------------------------
function Row({ label, value, strong, tone }: {
  label: string; value: string; strong?: boolean; tone?: "danger" | "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={`text-[12.5px] ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className={`text-[12.5px] tabular-nums ${strong ? "font-semibold" : ""} ${
        tone === "danger" ? "text-rose-600" : tone === "success" ? "text-emerald-600" : "text-foreground"
      }`}>
        {value}
      </span>
    </div>
  );
}

function BreakdownDrawer({ detail, loading, onClose, onRelease, busy }: {
  detail: Breakdown | null;
  loading: boolean;
  onClose: () => void;
  onRelease: (id: string) => void;
  busy: boolean;
}) {
  const open = loading || detail !== null;
  const calc = detail?.calculation;
  const releasable =
    detail?.approval_status === "approved" &&
    (detail?.status === "pending" || detail?.status === "failed");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="xl"
      title="Payout breakdown"
      description={detail?.booking_ref ? `Booking ${detail.booking_ref}` : undefined}
      footer={
        detail && releasable ? (
          <button
            onClick={() => onRelease(detail.payout_id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Release {inr(detail.stored.net_amount)}
          </button>
        ) : undefined
      }
    >
      {loading && <div className="text-[13px] text-muted-foreground">Loading calculation…</div>}

      {detail && (
        <div className="space-y-6">
          {/* Headline: the exact amount that will be transferred. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="nc-card p-4">
              <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Customer paid</div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums">{inr(detail.customer_amount)}</div>
            </div>
            <div className="nc-card p-4">
              <div className="text-[11.5px] text-muted-foreground font-medium uppercase tracking-wide">Platform retains</div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-violet-600">
                {inr(calc?.split.platform_fee_gross)}
              </div>
            </div>
            <div className="nc-card p-4 border-blue-200 bg-blue-50/50">
              <div className="text-[11.5px] text-blue-700 font-medium uppercase tracking-wide">Nurse receives</div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-blue-700">
                {inr(detail.stored.net_amount)}
              </div>
            </div>
          </div>

          {/* The modular charges table, exactly as configured. */}
          {calc && calc.rate_card.length > 0 && (
            <div>
              <h4 className="text-[13px] font-semibold mb-2">Charges table</h4>
              <div className="overflow-x-auto nc-card">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground text-left text-[11px]">
                      <th className="px-3 py-2 font-medium">Component</th>
                      <th className="px-3 py-2 font-medium text-right">Package rate</th>
                      <th className="px-3 py-2 font-medium text-right">GST</th>
                      <th className="px-3 py-2 font-medium text-right">Platform fee</th>
                      <th className="px-3 py-2 font-medium text-right">GST on fee</th>
                      <th className="px-3 py-2 font-medium text-right">Customer pays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.rate_card.map((r) => (
                      <tr key={r.code} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="font-medium">{r.label}</div>
                          <div className="text-[10.5px] text-muted-foreground">
                            {r.sac_code ? `SAC ${r.sac_code} · ` : ""}
                            {r.is_exempt ? "Exempt" : `${Number(r.gst_rate_pct)}% GST`}
                            {" · nurse "}{inr(r.worker_earning)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{inr(r.package_rate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.is_exempt ? <span className="text-muted-foreground">—</span> : inr(r.gst_on_service)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{inr(r.platform_fee)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{inr(r.gst_on_platform_fee)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {inr(r.customer_line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Customer side */}
            {calc && (
              <div>
                <h4 className="text-[13px] font-semibold mb-1">Customer invoice</h4>
                <div className="divide-y divide-border">
                  <Row label="Exempt supply value" value={inr(calc.customer.exempt_value)} />
                  <Row label="Taxable value" value={inr(calc.customer.taxable_value)} />
                  <Row label="CGST" value={inr(calc.customer.cgst_amount)} />
                  <Row label="SGST" value={inr(calc.customer.sgst_amount)} />
                  {Number(calc.customer.subsidy_amount) > 0 && (
                    <Row label="Less: subsidy" value={`- ${inr(calc.customer.subsidy_amount)}`} tone="danger" />
                  )}
                  <Row label="Total charged" value={inr(calc.customer.total_amount)} strong />
                </div>
                {detail.invoice_number && (
                  <div className="mt-2 text-[11.5px] text-muted-foreground">
                    Invoice {detail.invoice_number}
                    {detail.invoice_pdf_url && (
                      <>
                        {" · "}
                        <a
                          href={detail.invoice_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Open PDF
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Nurse side */}
            {calc && (
              <div>
                <h4 className="text-[13px] font-semibold mb-1">Nurse payout</h4>
                <div className="divide-y divide-border">
                  <Row label="Service value earned" value={inr(calc.split.worker_service_value)} />
                  <Row
                    label={`Less: platform fee (${Number(calc.split.commission_pct)}%)`}
                    value={`- ${inr(calc.split.platform_fee_taxable)}`}
                    tone="danger"
                  />
                  <Row
                    label="Less: 18% GST on platform fee"
                    value={`- ${inr(calc.split.platform_fee_gst)}`}
                    tone="danger"
                  />
                  <Row label="Net take-home" value={inr(calc.split.worker_gross)} strong />
                  {calc.deductions.map((d) => (
                    <Row
                      key={d.code}
                      label={`Less: ${d.label}${d.note ? ` (${d.note})` : ""}`}
                      value={`- ${inr(d.amount)}`}
                      tone="danger"
                    />
                  ))}
                  <Row label="Final disbursal" value={inr(detail.stored.net_amount)} strong tone="success" />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Nurse share {Number(calc.split.worker_share_pct)}% · platform {Number(calc.split.commission_pct)}%.
                  The customer never sees this split.
                </div>
              </div>
            )}
          </div>

          {/* Transfer state */}
          <div>
            <h4 className="text-[13px] font-semibold mb-1">Transfer</h4>
            <div className="divide-y divide-border">
              <Row label="Payout status" value={payoutState(detail).label} />
              {detail.razorpay_status && <Row label="Razorpay status" value={detail.razorpay_status} />}
              {detail.razorpay_payout_id && <Row label="Razorpay payout ID" value={detail.razorpay_payout_id} />}
              {detail.utr && <Row label="Bank UTR" value={detail.utr} />}
              <Row label="Attempts" value={`${detail.attempt_count} / ${detail.max_attempts}`} />
              <Row label="Released at" value={formatDateTime(detail.released_at)} />
              <Row label="Confirmed paid at" value={formatDateTime(detail.paid_at)} />
            </div>
            {detail.failure_reason && (
              <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {detail.failure_reason}
              </div>
            )}
            {detail.status === "processing" && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                This transfer has been accepted by Razorpay but not yet confirmed by the bank.
                It is not counted as paid until Razorpay reports settlement.
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
