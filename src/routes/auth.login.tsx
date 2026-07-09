import { createFileRoute, Link, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Clock, HeartHandshake, ArrowRight, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/yantram-logo.jpg";
import { useAuth } from "@/lib/auth-context";
import { portalHome, portalForRole, routePortal, SELF_REGISTER_ROLES, type Role, type SelfRegisterRole } from "@/lib/rbac";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login â€” NurseConnect" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
});

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function safeRedirect(role: Role, raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    let decoded = raw;
    for (let i = 0; i < 5 && /%[0-9A-Fa-f]{2}/.test(decoded); i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
    const path = decoded.split("?")[0];
    if (path.startsWith("/auth")) return null;
    const target = routePortal(path);
    if (target && target !== portalForRole(role)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Map backend role â†’ frontend role
const BACKEND_TO_ROLE: Record<string, Role> = {
  consumer: "consumer", worker: "partner",
  admin: "admin", reviewer: "reviewer",
};

// Map frontend self-register role â†’ backend role string
const SELF_ROLE_TO_BACKEND: Record<SelfRegisterRole, string> = {
  consumer: "consumer",
  partner: "worker",
};

async function apiRequest(path: string, body: unknown) {
  const res = await fetch(`${API}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

async function apiLogin(email: string, password: string) {
  return apiRequest("/auth/login", { email, password });
}

async function apiRegister(input: {
  full_name: string;
  email: string;
  phone_e164: string;
  password: string;
  role: string;
}) {
  return apiRequest("/auth/register", input);
}

async function apiVerifyEmail(email: string, code: string) {
  return apiRequest("/auth/verify-email", { email, code });
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

function normalizePhone(raw: string): string {
  const p = raw.replace(/\s+/g, "").replace(/-/g, "");
  if (p.startsWith("+")) return p;
  return `+91${p.replace(/^0/, "")}`;
}

const PASSWORD_HINT = "8+ characters, with an uppercase letter, lowercase letter, and a number.";

function isPasswordValid(pw: string): boolean {
  return (
    pw.length >= 8 &&
    pw.length <= 72 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /\d/.test(pw)
  );
}

type Mode = "signin" | "register" | "verify";

function LoginPage() {
  const nav = useNavigate();
  const { signIn, isAuthenticated, user, hydrated } = useAuth();
  const { redirect } = useSearch({ from: "/auth/login" });

  const [mode, setMode] = useState<Mode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  // Sign in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<SelfRegisterRole>("consumer");
  const [workerType, setWorkerType] = useState<"nurse" | "caregiver">("nurse");

  // Verify
  const [verifyEmail, setVerifyEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (hydrated && isAuthenticated && user) {
    const target = safeRedirect(user.role, redirect) ?? portalHome(user.role);
    return <Navigate to={target as string} />;
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      saveTokens(data.tokens.access_token, data.tokens.refresh_token);
      const mappedRole = BACKEND_TO_ROLE[data.user.role] ?? "consumer";
      signIn({
        id: data.user.id,
        name: data.user.full_name ?? "User",
        email: data.user.email,
        role: mappedRole,
      });
      const target = safeRedirect(mappedRole, redirect) ?? portalHome(mappedRole);
      nav({ to: target as string });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) return setError("Full name is required");
    if (!phone.trim()) return setError("Mobile number is required");
    if (!isPasswordValid(regPassword)) return setError(PASSWORD_HINT);

    setLoading(true);
    try {
      const data = await apiRegister({
        full_name: fullName.trim(),
        email: regEmail.trim(),
        phone_e164: normalizePhone(phone),
        password: regPassword,
        role: SELF_ROLE_TO_BACKEND[regRole],
        ...(regRole === "partner" ? { worker_type: workerType } : {}),
      });
      setVerifyEmail(data.email ?? regEmail.trim());
      setDevCode(data.dev_verification_code ?? null);
      setInfo("We've emailed you a verification code.");
      setMode("verify");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiVerifyEmail(verifyEmail, code);
      setEmail(verifyEmail);
      setPassword("");
      setInfo("Email verified â€” sign in to continue.");
      setMode("signin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex w-1/2 nc-sidebar-bg text-sidebar-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-32 -left-16 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Yantram" className="h-12 w-12 rounded-lg bg-white/95 p-1" />
            <div>
              <div className="text-xl font-semibold">NurseConnect</div>
              <div className="text-xs text-sidebar-muted">by Yantram Healthcare</div>
            </div>
          </div>
          <h1 className="mt-16 text-4xl font-semibold leading-tight">
            Professional Healthcare<br />At Your Doorstep
          </h1>
          <p className="mt-4 text-sidebar-muted max-w-md">
            Connect with verified nurses for home healthcare services. Quality care, anytime, anywhere.
          </p>
          <ul className="mt-10 space-y-4 max-w-md">
            {[
              { icon: ShieldCheck, t: "Verified & Certified Nurses", d: "Background-checked, license-verified caregivers." },
              { icon: Clock, t: "24/7 Availability", d: "Care coordination round the clock across India." },
              { icon: HeartHandshake, t: "Subsidy Support for BPL Families", d: "Government-aligned schemes built in." },
            ].map((f) => (
              <li key={f.t} className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-white/10 grid place-items-center"><f.icon className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-medium">{f.t}</div>
                  <div className="text-xs text-sidebar-muted">{f.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-sidebar-muted">Â© 2026 Yantram Healthcare. All rights reserved.</div>
      </div>

      {/* Form panel */}
      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={logo} alt="Yantram" className="h-10 w-10 rounded-lg" />
            <div className="text-lg font-semibold">NurseConnect</div>
          </div>
          <div className="nc-card p-8">
            {mode !== "verify" && (
              <div className="flex items-center gap-1 p-1 rounded-md bg-secondary/60 mb-4 text-[12px] font-medium">
                {(["signin", "register"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`flex-1 px-3 py-1.5 rounded-md transition ${mode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                  >
                    {m === "signin" ? "Sign in" : "Register"}
                  </button>
                ))}
              </div>
            )}

            {mode === "signin" && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight">Welcome Back</h2>
                <p className="text-sm text-muted-foreground mt-1">Login to continue to your portal</p>

                <form className="mt-6 space-y-4" onSubmit={submitSignIn}>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">Password</label>
                    <div className="relative mt-1.5">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full px-3 py-2.5 pr-10 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {info && (
                    <div className="text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                      {info}
                    </div>
                  )}
                  {error && (
                    <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}

                  {mode === "signin" && (
                    <div className="text-right -mt-2 mb-1">
                      <Link to="/auth/forgot-password" className="text-[12px] text-primary hover:underline">Forgot password?</Link>
                    </div>
                  )}
                  <button
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:opacity-95 disabled:opacity-60 transition"
                  >
                    {loading ? "Logging inâ€¦" : "Login"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="mt-6 text-[13px] text-muted-foreground text-center">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => switchMode("register")} className="text-primary font-medium">
                    Register
                  </button>
                </div>
              </>
            )}

            {mode === "register" && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight">Join the marketplace</h2>
                <p className="text-sm text-muted-foreground mt-1">Self-register as a family or care professional</p>

                <form className="mt-6 space-y-4" onSubmit={submitRegister}>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">Full name</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Asha Mehra"
                      className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">Email</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">Mobile Number</label>
                    <input
                      value={phone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setPhone(digitsOnly);
                      }}
                      placeholder="9999900001"
                      inputMode="numeric"
                      maxLength={10}
                      className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">Password</label>
                    <div className="relative mt-1.5">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full px-3 py-2.5 pr-10 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
                      />
                      <button type="button" onClick={() => setShowRegPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{PASSWORD_HINT}</p>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">I am a</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 p-1 rounded-md bg-secondary/60 text-[12px] font-medium">
                      {SELF_REGISTER_ROLES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRegRole(r.id)}
                          className={`px-2 py-1.5 rounded-md transition ${regRole === r.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {SELF_REGISTER_ROLES.find((r) => r.id === regRole)?.tagline}
                    </p>
                  </div>
                  {regRole === "partner" && (
                    <div>
                      <label className="text-[12px] font-medium text-foreground">I am a</label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5 p-1 rounded-md bg-secondary/60 text-[12px] font-medium">
                        {(["nurse", "caregiver"] as const).map((t) => (
                          <button key={t} type="button" onClick={() => setWorkerType(t)}
                            className={`px-2 py-1.5 rounded-md capitalize transition ${workerType === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {workerType === "nurse" ? "Professionally trained, licensed nurse" : "Care helper / companion (non-clinical)"}
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}

                  <button
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:opacity-95 disabled:opacity-60 transition"
                  >
                    {loading ? "Creating accountâ€¦" : "Create account"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="mt-6 text-[13px] text-muted-foreground text-center">
                  Already registered?{" "}
                  <button type="button" onClick={() => switchMode("signin")} className="text-primary font-medium">
                    Sign in
                  </button>
                </div>
              </>
            )}

            {mode === "verify" && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight">Verify your email</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a code to <span className="font-medium text-foreground">{verifyEmail}</span>
                </p>

                <form className="mt-6 space-y-4" onSubmit={submitVerify}>
                  <div>
                    <label className="text-[12px] font-medium text-foreground">Verification code</label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="mt-1.5 w-full px-3 py-2.5 text-[14px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    {devCode && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Dev mode code: <span className="font-mono">{devCode}</span>
                      </p>
                    )}
                  </div>

                  {info && (
                    <div className="text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                      {info}
                    </div>
                  )}
                  {error && (
                    <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}

                  <button
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:opacity-95 disabled:opacity-60 transition"
                  >
                    {loading ? "Verifyingâ€¦" : "Verify email"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="mt-6 text-[13px] text-muted-foreground text-center">
                  Wrong email?{" "}
                  <button type="button" onClick={() => switchMode("register")} className="text-primary font-medium">
                    Go back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
