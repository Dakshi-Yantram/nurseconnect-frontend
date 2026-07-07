import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ArrowLeft, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPassword,
});

// Two-step reset: request a code (SMSed to the registered phone), then set a
// new password with that code. Backend: POST /api/auth/forgot-password and
// POST /api/auth/reset-password.
function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parseErr(e: any) {
    let m = String(e?.message ?? e);
    try { const j = JSON.parse(m); m = j.detail ?? m; } catch { /* keep */ }
    return m;
  }

  async function requestCode() {
    setError(null); setMsg(null); setBusy(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMsg(res?.message ?? "If that account exists, a reset code has been sent.");
      setStep(2);
    } catch (e) { setError(parseErr(e)); } finally { setBusy(false); }
  }

  async function resetPassword() {
    setError(null); setBusy(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), new_password: pw }),
      });
      nav({ to: "/auth/login", search: { redirect: undefined } });
    } catch (e) { setError(parseErr(e)); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-sm">
        // Link near line 54
        <Link to="/auth/login" search={{ redirect: undefined }} className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-primary" />
          <h1 className="text-[16px] font-bold text-foreground">Reset password</h1>
        </div>

        {step === 1 ? (
          <>
            <p className="text-[12.5px] text-muted-foreground mb-4">
              Enter your email. We'll text a reset code to your registered phone number.
            </p>
            <label className="text-[12px] font-semibold text-foreground">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px]" />
            {msg && <p className="mt-2 text-[12px] text-emerald-700">{msg}</p>}
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <button onClick={requestCode} disabled={busy || !email.includes("@")}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Send reset code
            </button>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-muted-foreground mb-4">
              {msg ?? "Enter the code we sent and your new password."}
            </p>
            <label className="text-[12px] font-semibold text-foreground">Reset code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" placeholder="6-digit code"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[15px] tracking-[0.25em] text-center font-bold" />
            <label className="mt-3 block text-[12px] font-semibold text-foreground">New password</label>
            <input value={pw} onChange={(e) => setPw(e.target.value)} type="password"
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px]" />
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <button onClick={resetPassword} disabled={busy || code.length !== 6 || pw.length < 8}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Set new password
            </button>
            <button onClick={() => setStep(1)} className="mt-2 w-full text-[12px] text-muted-foreground hover:text-foreground">
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
