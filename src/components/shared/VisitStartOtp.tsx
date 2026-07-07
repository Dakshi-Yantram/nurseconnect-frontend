import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateOtpResponse {
  sent: boolean;
  sms_sent?: boolean;
  message: string;
  expires_in_seconds: number;
}

interface VerifyOtpResponse {
  id: string;
  booking_id: string;
  status: string;
  check_in_at: string;
}

interface ApiErrorDetail {
  code: string;
  message: string;
  attempts_remaining?: number;
}

// ─── Consumer side: generate OTP ─────────────────────────────────────────────

interface GenerateVisitOtpProps {
  bookingId: string;
  onGenerated?: (res: GenerateOtpResponse) => void;
}

export function GenerateVisitOtp({ bookingId, onGenerated }: GenerateVisitOtpProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateOtpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/visits/${bookingId}/generate-start-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        const detail: ApiErrorDetail = data.detail ?? {};
        setError(detail.message ?? "Failed to generate visit code.");
        return;
      }
      setResult(data as GenerateOtpResponse);
      onGenerated?.(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white shadow-md max-w-sm w-full">
      <h2 className="text-lg font-semibold text-gray-900">Start your visit</h2>
      <p className="text-sm text-gray-500">
        Tap the button below to generate a one-time code. Read it aloud to your
        nurse so they can begin the visit.
      </p>

      {result ? (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex flex-col gap-1">
          <p className="text-sm font-medium text-green-800">{result.message}</p>
          <p className="text-xs text-green-600">
            Code expires in {Math.floor(result.expires_in_seconds / 60)} min{" "}
            {result.expires_in_seconds % 60}s
          </p>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-sm
                     hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating…" : "Generate visit code"}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {result && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-xs text-blue-600 underline self-start disabled:opacity-50"
        >
          Resend code
        </button>
      )}
    </div>
  );
}

// ─── Worker / Nurse side: verify OTP ─────────────────────────────────────────

interface VerifyVisitOtpProps {
  bookingId: string;
  latitude: number;
  longitude: number;
  onSuccess?: (visit: VerifyOtpResponse) => void;
}

export function VerifyVisitOtp({
  bookingId,
  latitude,
  longitude,
  onSuccess,
}: VerifyVisitOtpProps) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string; remaining?: number } | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleVerify() {
    if (otp.trim().length !== 4) {
      setError({ message: "Enter the 4-digit code from the consumer." });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${bookingId}/verify-start-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim(), latitude, longitude }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail: ApiErrorDetail = data.detail ?? {};
        setError({
          message: detail.message ?? "Verification failed.",
          code: detail.code,
          remaining: detail.attempts_remaining,
        });
        return;
      }
      setSuccess(true);
      onSuccess?.(data as VerifyOtpResponse);
    } catch {
      setError({ message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white shadow-md max-w-sm w-full">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-900">Visit started</p>
        <p className="text-sm text-gray-500 text-center">
          Check-in confirmed. You can now record vitals and begin care tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white shadow-md max-w-sm w-full">
      <h2 className="text-lg font-semibold text-gray-900">Enter visit code</h2>
      <p className="text-sm text-gray-500">
        Ask the consumer for their 4-digit code, then enter it below to start
        the visit.
      </p>

      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={otp}
        onChange={(e) => {
          setError(null);
          setOtp(e.target.value.replace(/\D/g, "").slice(0, 4));
        }}
        placeholder="_ _ _ _"
        className="w-full text-center text-3xl font-mono tracking-[0.5em] border border-gray-300
                   rounded-xl py-4 focus:outline-none focus:ring-2 focus:ring-blue-500
                   placeholder:text-gray-300"
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-sm text-red-700">{error.message}</p>
          {error.code === "OTP_MAX_ATTEMPTS_EXCEEDED" && (
            <p className="text-xs text-red-500 mt-1">
              Ask the consumer to open their app and generate a new code.
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={loading || otp.length !== 4}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-sm
                   hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "Verifying…" : "Start visit"}
      </button>
    </div>
  );
}

// ─── Default export: combined demo wrapper ────────────────────────────────────

export default function VisitStartOtp() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-8 p-6">
      <GenerateVisitOtp bookingId="demo-booking-id" />
      <VerifyVisitOtp
        bookingId="demo-booking-id"
        latitude={28.6139}
        longitude={77.209}
      />
    </div>
  );
}