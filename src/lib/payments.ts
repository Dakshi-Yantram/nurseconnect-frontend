// frontend/src/lib/payments.ts
import { apiFetch } from "@/lib/api";

export interface PayForBookingInput {
  bookingId: string;
  description?: string;
  prefillEmail?: string;
}

export interface PayForBookingResult {
  verified: boolean;
}

export interface RefundBookingResult {
  verified: boolean;
  refundId: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Payment methods (GET /payments/methods/{id}) and Cash-on-Delivery.
//
// Cash is a separate flow, not a branch inside payForBooking(): no order is
// created, no gateway opens, and nothing is "verified" in the signature
// sense — the booking is simply confirmed with the amount due at the visit.
// Mirrors the mobile app's payment.service.ts / cash_payment.py split so the
// same booking behaves identically from either client.
// ---------------------------------------------------------------------------
export type PaymentMethodId = "razorpay" | "cash";

export interface PaymentMethodOption {
  method: PaymentMethodId;
  label: string;
  description: string;
  available: boolean;
  reason: string | null;
}

export interface PaymentMethodsResult {
  booking_id: string;
  amount: number;
  current_method: PaymentMethodId;
  methods: PaymentMethodOption[];
}

/** Which payment methods this booking may use, and why not if not. */
export async function fetchPaymentMethods(bookingId: string): Promise<PaymentMethodsResult> {
  return apiFetch(`/api/payments/methods/${bookingId}`);
}

export interface CashSelectResult {
  verified: boolean;
  booking_status: string;
  payment_status: string;
  payment_method: PaymentMethodId;
  cash_due: boolean;
}

/**
 * Customer chooses to pay cash at the visit. Confirms the booking and
 * starts dispatch — no money moves yet, so `verified` is correctly false
 * here; check `cash_due` instead to confirm the booking went through.
 */
export async function selectCashPayment(bookingId: string): Promise<CashSelectResult> {
  const res = await apiFetch("/api/payments/cash/select", {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId }),
  });
  return {
    verified: !!res?.verified,
    booking_status: res?.booking_status,
    payment_status: res?.payment_status,
    payment_method: res?.payment_method,
    cash_due: !!res?.cash_due,
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function isMockOrder(order: { razorpay_key_id?: string; razorpay_order_id?: string }): boolean {
  return (
    !order.razorpay_key_id ||
    order.razorpay_key_id.endsWith("_placeholder") ||
    !!order.razorpay_order_id?.startsWith("order_mock_")
  );
}

export async function payForBooking(
  { bookingId, description, prefillEmail }: PayForBookingInput
): Promise<PayForBookingResult> {
  // Matches PaymentOrderRequest { booking_id } → PaymentOrderResponse
  const order = await apiFetch("/api/payments/order", {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId }),
  });

  // Backend has no real Razorpay credentials configured (MOCK_EXTERNAL_PROVIDERS=true
  // or RAZORPAY_KEY_ID missing) — it already returned a mock order. Opening the real
  // Razorpay checkout with a placeholder key/mock order_id always fails with 401, so
  // we short-circuit and simulate a successful payment directly against /verify,
  // which accepts mock signatures when the backend is in mock mode.
  if (isMockOrder(order)) {
    const mockPaymentId = `pay_mock_${Math.random().toString(36).slice(2, 16)}`;
    const mockSignature = `mock_${Math.random().toString(36).slice(2, 34)}`;
    const verifyRes = await apiFetch("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify({
        booking_id: bookingId,
        razorpay_order_id: order.razorpay_order_id,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: mockSignature,
      }),
    });
    return { verified: !!verifyRes?.verified };
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error("Payment gateway failed to load");

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.razorpay_key_id,
      amount: order.amount, // already in paise
      currency: order.currency ?? "INR",
      name: "NurseConnect",
      description,
      order_id: order.razorpay_order_id,
      prefill: { email: prefillEmail },
      handler: async (response: any) => {
        try {
          const verifyRes = await apiFetch("/api/payments/verify", {
            method: "POST",
            body: JSON.stringify({
              booking_id: bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          resolve({ verified: !!verifyRes?.verified });
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });
    rzp.open();
  });
}

/**
 * Requests a refund for a booking.
 *
 * Backend route: POST /api/payments/refund/{booking_id}
 * Backend expects:
 *   - amount: float in rupees (it multiplies by 100 to paise internally)
 *   - reason: string
 *
 * Requests a refund.
 *
 * Backend route: POST /api/payments/refund/{booking_id}
 * Backend expects JSON body:
 *   - amount: float in rupees
 *   - reason: string
 */
export async function refundBooking(
  bookingId: string,
  amountRupees: number,
  reason: string
): Promise<RefundBookingResult> {
  const res = await apiFetch(`/api/payments/refund/${bookingId}`, {
    method: "POST",
    body: JSON.stringify({
      amount: amountRupees,
      reason,
    }),
  });

  return {
    verified: true,
    refundId: res?.refund_id ?? res?.refundId,
    status: res?.status,
  };
}


