import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuth } from "@/lib/auth-context";
import { useBookings } from "@/lib/domain";
import { CreditCard, CheckCircle2, Clock, XCircle, AlertCircle, IndianRupee } from "lucide-react";
import { toAmount } from "@/lib/payment-status";



export const Route = createFileRoute("/_app/consumer/payments")({
  component: ConsumerPayments,
  head: () => ({ meta: [{ title: "Payments — NurseConnect" }] }),
});

// ---------------------------------------------------------------------------
// Payment state derivation — maps booking workflow state → payment status
// ---------------------------------------------------------------------------

type PaymentStatus = "paid" | "pending" | "failed" | "refunded" | "processing";

interface PaymentRow {
  bookingId: string;
  label: string;
  service: string;
  patientName: string;
  amount: number;
  paymentStatus: PaymentStatus;
  bookingState: string;
  date: string | null;
}

/**
 * Derives payment status from booking state.
 *
 * Booking workflow states → Payment meaning:
 *   completed              → paid       (service delivered, payment settled)
 *   active / in_progress   → processing (nurse on the way / at patient, payment in-flight)
 *   pending / claimed      → pending    (booked, awaiting service, payment authorised)
 *   cancelled              → refunded   (booking cancelled, refund due)
 *   escalated              → failed     (escalation may mean payment issue)
 */
function derivePaymentStatus(bookingState: string): PaymentStatus {
  switch (bookingState) {
    case "completed": return "paid";
    case "active":
    case "in_progress": return "processing";
    case "pending":
    case "claimed": return "pending";
    case "cancelled": return "refunded";
    case "escalated": return "failed";
    default: return "pending";
  }
}

/** Maps the real backend payment_status (BookingOut.payment_status) to the
 *  display categories this page already knows how to render. Only falls
 *  back to state-derived heuristics when the backend hasn't told us yet
 *  (e.g. still hydrating, or a demo/seed record with no payment row).
 *  Kept in sync with the same mapping in _app.consumer.bookings.$bookingId.tsx. */
function mapRealPaymentStatus(raw: string | undefined): PaymentStatus | null {
  switch (raw) {
    case "captured": return "paid";
    case "initiated": return "processing";
    case "pending": return "pending";
    case "failed": return "failed";
    case "refunded": case "partially_refunded": return "refunded";
    default: return null;
  }
}

/** Derive a realistic per-booking amount.
 *  In production this would come from a pricing API; here we
 *  use service-name heuristics so different rows show different amounts. */
function deriveAmount(service: string | undefined): number {
  const s = (service ?? "").toLowerCase();
  if (s.includes("live-in") || s.includes("live in")) return 8500;
  if (s.includes("post") || s.includes("surgery")) return 4200;
  if (s.includes("geriatric") || s.includes("elderly")) return 3600;
  if (s.includes("physio")) return 2800;
  if (s.includes("diabetes") || s.includes("diabetic")) return 2200;
  if (s.includes("wound")) return 1800;
  if (s.includes("blood") || s.includes("bp")) return 1400;
  return 2400; // default
}

function formatAmount(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
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
  processing: { label: "Processing", icon: Clock, classes: "text-blue-700 bg-blue-50 border-blue-200" },
  pending: { label: "Pending", icon: Clock, classes: "text-amber-700 bg-amber-50 border-amber-200" },
  refunded: { label: "Refunded", icon: XCircle, classes: "text-muted-foreground bg-muted border-border" },
  failed: { label: "Failed", icon: AlertCircle, classes: "text-rose-700 bg-rose-50 border-rose-200" },
};

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { label, icon: Icon, classes } = STATUS_CONFIG[status];
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
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const paid = rows.filter(r => r.paymentStatus === "paid").reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter(r => r.paymentStatus === "pending" || r.paymentStatus === "processing").reduce((s, r) => s + r.amount, 0);
  const refunded = rows.filter(r => r.paymentStatus === "refunded").reduce((s, r) => s + r.amount, 0);

  const cells = [
    { label: "Total charged", value: formatAmount(total), tone: "text-foreground bg-muted border-border" },
    { label: "Paid", value: formatAmount(paid), tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "Pending / processing", value: formatAmount(pending), tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Refunded", value: formatAmount(refunded), tone: "text-muted-foreground bg-muted border-border" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cells.map(c => (
        <div key={c.label} className={`rounded-lg border px-3 py-3 ${c.tone}`}>
          <div className="text-[10.5px] uppercase tracking-wide opacity-75">{c.label}</div>
          <div className="text-[18px] font-semibold leading-tight mt-0.5">{c.value}</div>
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

  const rows: PaymentRow[] = myBookings.map((b: any) => ({
    bookingId: b.id,
    label: `${(b.data as any)?.service ?? (b.data as any)?.serviceType ?? b.service ?? b.serviceType ?? "Service"} — ${(b.data as any)?.patientName ?? (b.data as any)?.patient ?? b.patientName ?? b.patient ?? "Patient"}`,
    service: b.service ?? b.serviceType ?? "",
    patientName: b.patientName ?? b.patient ?? "—",
    // Prefer the real backend amount/status (b.totalAmount / b.paymentStatus,
    // populated from Booking.total_amount / Booking.payment_status). Only
    // fall back to the service-name heuristic for demo/seed rows that predate
    // a real payment record.
    amount: toAmount(
      b.totalAmount,
      deriveAmount(
        (b.data as any)?.service ??
        (b.data as any)?.serviceType ??
        b.service ??
        b.serviceType ?? ""
      )
    ),
    paymentStatus: mapRealPaymentStatus(b.paymentStatus) ?? derivePaymentStatus(b.state ?? b.status ?? "pending"),
    bookingState: b.state ?? b.status ?? "pending",
    date: (b.data as any)?.date ?? null,
  }));

  // Sort: failed → pending → processing → paid → refunded
  const ORDER: Record<PaymentStatus, number> = {
    failed: 0, pending: 1, processing: 2, paid: 3, refunded: 4,
  };
  rows.sort((a, b) => ORDER[a.paymentStatus] - ORDER[b.paymentStatus]);

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
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.bookingId} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                      #{r.bookingId}
                    </td>
                    <td className="px-5 py-3 font-medium max-w-[260px] truncate">
                      {r.label}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-[12px]">
                      {r.date ? new Date(r.date).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      }) : "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold text-right tabular-nums">
                      {formatAmount(r.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <PaymentBadge status={r.paymentStatus} />
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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[11.5px] text-muted-foreground px-1">
        {(Object.entries(STATUS_CONFIG) as [PaymentStatus, typeof STATUS_CONFIG[PaymentStatus]][]).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <cfg.icon className="h-3.5 w-3.5" />
            <span className="font-medium">{cfg.label}</span>
            <span className="opacity-60">—</span>
            <span>{
              key === "paid" ? "Booking completed, settled" :
                key === "processing" ? "Visit in progress, payment in-flight" :
                  key === "pending" ? "Booking confirmed, awaiting completion" :
                    key === "refunded" ? "Booking cancelled, refund issued" :
                      "Payment issue — escalation raised"
            }</span>
          </span>
        ))}
      </div>
    </div>
  );
}
