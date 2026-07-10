import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Upload, Clock, XCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WorkerServiceAreaForm } from "@/components/WorkerServiceAreaForm";
import { WorkerCredentialsForm } from "@/components/WorkerCredentialsForm";
export const Route = createFileRoute("/_app/partner")({
  component: PartnerGate,
});

// Doc list comes from the API snapshot (GET /api/workers/me/onboarding → documents[]).
// Each entry has { type, label, required }. We show all of them, marking
// which are required so the nurse/caregiver knows what blocks submission.
// The fallback list below is only used before the first API response.
const FALLBACK_DOCS = [
  { type: "aadhaar", label: "Aadhaar Card", required: true },
  { type: "police_verification", label: "Police Verification", required: true },
];

type DocEntry = { type: string; label: string; required: boolean };
type OnboardingSnapshot = {
  onboarding_status: string;
  worker_type?: string;
  documents?: DocEntry[];
  missing_profile_fields: string[];
  missing_documents: string[];
  rejected_documents: string[];
  can_submit_for_review: boolean;
  onboarding_rejection_reason?: string | null;
};

// The nurse portal is LOCKED until a reviewer approves the account.
// Until then the only thing rendered is the onboarding/doc-upload flow.
function PartnerGate() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await apiFetch("/api/workers/me");
      setStatus(me.onboarding_status ?? null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  // Approved → full nurse portal is unlocked.
  if (status === "approved") return <Outlet />;

  // Anything else → show the onboarding flow only.
  return <Onboarding statusHint={status} onApproved={load} />;
}

function Onboarding({ statusHint, onApproved }: { statusHint: string | null; onApproved: () => void }) {
  const [snap, setSnap] = useState<OnboardingSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await apiFetch("/api/workers/me/onboarding");
      setSnap(s);
      if (s.onboarding_status === "approved") onApproved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [onApproved]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function uploadDoc(type: string, file: File) {
    setError(null);

    // ✅ File size check before upload
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      const message = `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is ${MAX_SIZE_MB}MB.`;
      setError(message);
      alert(message);
      return;
    }

    setBusy(type);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
      });
      const data_base64 = dataUrl.split(",")[1] ?? "";
      await apiFetch("/api/workers/me/documents/upload", {
        method: "POST",
        body: JSON.stringify({ document_type: type, data_base64 }),
      });
      await refresh();
    } catch (e: any) {
      // ✅ Clear alert instead of silent "Failed to fetch"
      const message = e?.message?.includes("fetch")
        ? "Upload failed. Please check your internet connection or try a smaller file."
        : String(e?.message ?? e);
      setError(message);
      alert(message);
    } finally {
      setBusy(null);
    }
  }

  async function submitForReview() {
    setError(null);
    setBusy("submit");
    try {
      await apiFetch("/api/workers/me/onboarding/submit", { method: "POST" });
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  const st = snap?.onboarding_status ?? statusHint ?? "documents_pending";

  // Waiting on the reviewer.
  if (st === "pending_review") {
    return (
      <Shell>
        <StatusCard
          icon={<Clock className="text-amber-600" />}
          title="Application under review"
          tone="amber"
          body="Your documents have been sent to a reviewer. Your account will be activated once they approve it. You'll be notified as soon as that happens."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-xl border border-primary/15 bg-primary/5 px-5 py-4 mb-5 flex items-center gap-3">
        <ShieldCheck className="text-primary" size={20} />
        <div>
          <p className="text-[15px] font-bold text-foreground">Finish verification to activate your account</p>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Upload the required documents. A reviewer will verify them and approve your account.
          </p>
        </div>
      </div>

      {st === "rejected" && snap?.onboarding_rejection_reason && (
        <StatusCard
          icon={<XCircle className="text-red-600" />}
          tone="red"
          title="Changes requested"
          body={snap.onboarding_rejection_reason}
        />
      )}

      {snap?.missing_profile_fields?.includes("base_city") && (
        <WorkerServiceAreaForm initialCity={undefined} onSaved={refresh} />
      )}
      {(snap?.missing_profile_fields?.includes("date_of_birth") ||
        snap?.missing_profile_fields?.includes("registration_no") ||
        snap?.missing_profile_fields?.includes("registration_authority") ||
        snap?.missing_profile_fields?.includes("registration_valid_until") ||
        // Backend appends this DISTINCT key when registration_valid_until is
        // set but has already lapsed (as opposed to being empty). Without
        // this check, an expired registration date never renders the form
        // that lets the worker fix it — they're stuck seeing only the
        // generic "Complete your profile first" banner below with no way
        // to act on it.
        snap?.missing_profile_fields?.includes("registration_valid_until_not_expired")) && (
          <WorkerCredentialsForm onSaved={refresh} />
        )}
      {snap?.missing_profile_fields && snap.missing_profile_fields.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-[13px] text-amber-800">
          Complete your profile first (missing: {snap.missing_profile_fields.join(", ")}).
        </div>
      )}

      <div className="space-y-3">
        {(snap?.documents ?? FALLBACK_DOCS).map((doc) => {
          const missing = snap?.missing_documents?.includes(doc.type);
          const rejected = snap?.rejected_documents?.includes(doc.type);
          const uploaded = !missing && !rejected;
          return (
            <div key={doc.type} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5"><p className="text-[13.5px] font-semibold text-foreground">{doc.label}</p>{"required" in doc && !doc.required && <span className="text-[10px] text-muted-foreground">(optional)</span>}</div>
                <p className="text-[11.5px] text-muted-foreground">
                  {uploaded ? "Uploaded" : rejected ? "Rejected — please re-upload" : "Not uploaded"}
                </p>
              </div>
              {uploaded ? (
                <CheckCircle2 className="text-emerald-600" size={18} />
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90">
                  {busy === doc.type ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Upload
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={busy !== null}
                    onChange={(e) => e.target.files?.[0] && uploadDoc(doc.type, e.target.files[0])}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-[12.5px] text-red-600">{error}</p>}

      <button
        onClick={submitForReview}
        disabled={!snap?.can_submit_for_review || busy !== null}
        className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-[13.5px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy === "submit" ? "Submitting…" : "Submit for review"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-xl px-4 py-10">{children}</div>
    </div>
  );
}

function StatusCard({
  icon, title, body, tone,
}: { icon: React.ReactNode; title: string; body: string; tone: "amber" | "red" | "green" }) {
  const wrap =
    tone === "amber" ? "border-amber-200 bg-amber-50"
      : tone === "red" ? "border-red-200 bg-red-50"
        : "border-emerald-200 bg-emerald-50";
  return (
    <div className={`rounded-xl border ${wrap} px-5 py-6 mb-4 flex flex-col items-center text-center gap-2`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70">{icon}</span>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      <p className="text-[13px] text-muted-foreground max-w-sm">{body}</p>
    </div>
  );
}