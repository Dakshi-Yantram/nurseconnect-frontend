import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuth } from "@/lib/auth-context";
import { useBookings } from "@/lib/domain";
import { bookingRef, isPastBooking, whenParts } from "@/lib/booking-view";
import { CreditCard, CheckCircle2, Clock, XCircle, AlertCircle, IndianRupee } from "lucide-react";
import {
  toAmount,
  deriveAmount,
  derivePaymentStatus,
  mapRealPaymentStatus,
  formatINR as formatAmount,
  type PaymentStatus,
} from "@/lib/payment-status";
import { InvoiceButton } from "@/components/shared/InvoiceButton";



export const Route = createFileRoute("/_app/consumer/payments")({
  component: ConsumerPayments,
  head: () => ({ meta: [{ title: "Payments — NurseConnect" }] }),
});

// ---------------------------------------------------------------------------
// Payment state derivation lives in @/lib/payment-status — imported above so
// this page, the booking-detail pages and any future screen share one
// mapping rather than three copies that can silently drift apart (this file
// used to keep its own copy "in sync by hand" with the others, which is how
// a case like cash_due gets missed in one place but not another).
// ---------------------------------------------------------------------------

interface PaymentRow {
  bookingId: string;
  label: string;
  service: string;
  patientName: string;
  amount: number;
  paymentStatus: PaymentStatus;
  bookingState: string;
  date: string | null;
  ref: string;
  expired: boolean;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PaymentStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  classes: string;
}> = {
  paid: { label: "Paid", icon: CheckCircle2, classes: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  processing: { label: "In progress", icon: Clock, classes: "text-blue-700 bg-blue-50 border-blue-200" },
  pending: { label: "Pending", icon: Clock, classes: "text-amber-700 bg-amber-50 border-amber-200" },
  refunded: { label: "Refunded", icon: XCircle, classes: "text-muted-foreground bg-muted border-border" },
  failed: { label: "Failed", icon: AlertCircle, classes: "text-rose-700 bg-rose-50 border-rose-200" },
  cash_due: { label: "Pending", icon: Clock, classes: "text-amber-700 bg-amber-50 border-amber-200" },
};

function PaymentBadge({ status, expired }: { status: PaymentStatus; expired?: boolean }) {
  const base = STATUS_CONFIG[status];
  const { label, icon: Icon, classes } = expired
    ? { label: "Expired", icon: XCircle, classes: "text-muted-foreground bg-muted border-border" }
    : base;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${classes}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

function SummaryStrip({ rows }: { rows: PaymentRow[] }) {
  // Expired (never paid, slot over) is not money owed, so it is left out of every total.
  const live = rows.filter((r) => !r.expired);
  const total = live.reduce((s, r) => s + r.amount, 0);
  const paid = live.filter((r) => r.paymentStatus === "paid").reduce((s, r) => s + r.amount, 0);
  const pending = live.filter((r) => ["pending", "processing", "cash_due", "failed"].includes(r.paymentStatus)).reduce((s, r) => s + r.amount, 0);
  const refunded = live.filter((r) => r.paymentStatus === "refunded").reduce((s, r) => s + r.amount, 0);

  const cells = [
    { label: "Total", value: formatAmount(total), tone: "text-foreground bg-muted border-border" },
    { label: "Paid", value: formatAmount(paid), tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "To pay", value: formatAmount(pending), tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Refunded", value: formatAmount(refunded), tone: "text-muted-foreground bg-muted border-border" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cells.map(c => (
        <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.tone}`}>
          <div className="text-[10.5px] uppercase tracking-wide opacity-75">{c.label}</div>
          <div className="text-[20px] font-semibold leading-tight mt-0.5">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function ConsumerPayments() {
  const { user } = useAuth();
  const allBookings = useBookings();

  // Filter to only this consumer's bookings (by ownerId / familyId if available,
  // otherwise show all — same pattern used by useConsumerCareSnapshot)
  const myBookings = user?.id
    ? allBookings.filter((b: any) =>
      b.ownerId === user.id ||
      b.familyId === user.id ||
      b.consumerId === user.id ||
      // fallback: no owner field means show all (dev / demo data)
      (!b.ownerId && !b.familyId && !b.consumerId)
    )
    : allBookings;

  const rows: PaymentRow[] = myBookings.map((b: any) => {
    const status = mapRealPaymentStatus(b.paymentStatus) ?? derivePaymentStatus(b.rawStatus ?? "pending");
    const w = whenParts(b.startedAt);
    return {
      bookingId: b.id,
      ref: bookingRef(b),
      label: `${b.service ?? "Care visit"}${b.patientName && b.patientName !== "—" ? ` — ${b.patientName}` : ""}`,
      service: b.service ?? "",
      patientName: b.patientName ?? "—",
      amount: toAmount(b.totalAmount, 0),
      paymentStatus: status,
      bookingState: b.rawStatus ?? "pending",
      date: w ? `${w.date} · ${w.time}` : null,
      // Slot is over and it was never paid: show "Expired", not "Pending".
      expired: status !== "paid" && status !== "refunded" && isPastBooking(b) && b.rawStatus === "pending_payment",
    };
  });

  // Sort: failed → pending → processing → paid → refunded
  const ORDER: Record<PaymentStatus, number> = {
    // cash_due sits with pending/processing — it needs the customer's
    // attention (a visit is coming where they'll pay), just like an online
    // payment still in flight.
    failed: 0, pending: 1, cash_due: 2, processing: 3, paid: 4, refunded: 5,
  };
  rows.sort((a, b) => (Number(a.expired) - Number(b.expired)) || (ORDER[a.paymentStatus] - ORDER[b.paymentStatus]));

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <div className="text-[18px] font-semibold flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-muted-foreground" /> Payments
        </div>
        <div className="text-[12.5px] text-muted-foreground">
          A full view of charges across all bookings — what's been paid, what's pending, and what's been refunded.
        </div>
      </div>

      {/* Summary strip */}
      {rows.length > 0 && <SummaryStrip rows={rows} />}

      {/* Table */}
      <Card title="Recent charges" padded={false}>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={CreditCard} title="No charges yet" description="Payments will appear here once bookings are made." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-left text-[11.5px]">
                  <th className="px-5 py-2.5 font-medium">Booking</th>
                  <th className="px-5 py-2.5 font-medium">Description</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Receipt</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.bookingId} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                      {r.ref}
                    </td>
                    <td className="px-5 py-3 font-medium max-w-[260px] truncate">
                      {r.label}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-[12px]">
                      {r.date ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold text-right tabular-nums">
                      {formatAmount(r.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <PaymentBadge status={r.paymentStatus} expired={r.expired} />
                    </td>
                    <td className="px-5 py-3">
                      {r.paymentStatus === "paid" || r.paymentStatus === "refunded" ? (
                        <InvoiceButton bookingId={r.bookingId} label="Download" />
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to="/consumer/bookings/$bookingId"
                        params={{ bookingId: r.bookingId }}
                        className="text-[12px] text-primary hover:underline"
                      >
                        View booking →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-muted-foreground px-1">
        <span><b className="font-medium text-foreground">Paid</b> — payment received</span>
        <span><b className="font-medium text-foreground">Pending</b> — not paid yet; pay from the booking</span>
        <span><b className="font-medium text-foreground">Expired</b> — slot passed without payment</span>
        <span><b className="font-medium text-foreground">Refunded</b> — money returned to you</span>
      </div>
    </div>
  );
}
