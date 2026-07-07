import { useState } from "react";
import { apiFetch } from "@/lib/api";

// Minimal shape of the booking returned by POST /api/bookings/
export type CreatedBooking = {
  id: string;
  booking_ref?: string;
  base_amount: number | string;
  surge_amount: number | string;
  subsidy_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
};



const inr = (n: number | string) => `₹${Number(n).toLocaleString("en-IN")}`;

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Opens after a booking is created (status = pending_payment). Shows the cost
// breakdown, creates a Razorpay order, runs checkout, then verifies — which is
// what flips the booking to CONFIRMED and triggers dispatch to nearby nurses.
export function PaymentDialog({
      booking, open, onClose, onConfirmed,
}: {
  booking: CreatedBooking | null;

  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !booking) return null;
  const b = booking;
  const rows = [
    { label: "Base price", value: booking.base_amount },
    { label: "Urgent surcharge", value: booking.surge_amount },
    { label: "Subsidy", value: booking.subsidy_amount, negative: true },
    { label: "Tax", value: booking.tax_amount },
  ].filter((r) => Number(r.value) !== 0);

  async function pay() {
    if (!booking) return;
    const currentBooking = booking;


    setError(null);
    setBusy(true);

    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load payment gateway");

      const order = await apiFetch("/api/payments/order", {
        method: "POST",
        body: JSON.stringify({ booking_id: currentBooking.id }),
      });

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.razorpay_key_id,
          order_id: order.razorpay_order_id,
          amount: order.amount,
          currency: order.currency,
          name: "NurseConnect",
          description: `Booking ${currentBooking.booking_ref ?? ""}`,
          handler: async (resp: any) => {
            try {
              await apiFetch("/api/payments/verify", {
                method: "POST",
                body: JSON.stringify({
                  booking_id: currentBooking.id,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                }),
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        });
        rzp.open();
      });

      onConfirmed();
      onClose();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">

        <h2 className="text-[16px] font-bold text-foreground">Payment</h2>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Confirm your booking by paying securely. Your request goes out to nearby nurses right after.
        </p>

        <div className="mt-4 rounded-xl border border-border divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={r.negative ? "text-emerald-700" : "text-foreground"}>
                {r.negative ? "− " : ""}{inr(r.value)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 text-[14px] font-bold">
            <span>Total</span>
            <span>{inr(booking.total_amount)}</span>
          </div>
        </div>

        {error && <p className="mt-3 text-[12.5px] text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-muted disabled:opacity-40">
            Cancel
          </button>
          <button onClick={pay} disabled={busy}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
            {busy ? "Processing…" : `Pay ${inr(booking.total_amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
