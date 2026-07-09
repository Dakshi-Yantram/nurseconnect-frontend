import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/partner/profile")({
  component: PartnerProfile,
  head: () => ({ meta: [{ title: "Complete Profile — NurseConnect" }] }),
});

function PartnerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [registrationAuthority, setRegistrationAuthority] = useState("");
  const [registrationValidUntil, setRegistrationValidUntil] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiFetch("/api/workers/me");
      setDateOfBirth(me.date_of_birth ?? "");
      setRegistrationNo(me.registration_no ?? "");
      setRegistrationAuthority(me.registration_authority ?? "");
      setRegistrationValidUntil(me.registration_valid_until ?? "");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await apiFetch("/api/workers/me", {
        method: "PUT",
        body: JSON.stringify({
          date_of_birth: dateOfBirth || undefined,
          registration_no: registrationNo || undefined,
          registration_authority: registrationAuthority || undefined,
          registration_valid_until: registrationValidUntil || undefined,
        }),
      });
      setSuccess(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-md px-4 py-8 space-y-4">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workspace
        </Link>

        <div>
          <h1 className="text-[18px] font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            These details are required before you can submit for review.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <FieldInput
            label="Date of Birth"
            type="date"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            required
          />
          <FieldInput
            label="Nursing Registration Number"
            type="text"
            value={registrationNo}
            onChange={setRegistrationNo}
            placeholder="e.g. RN123456"
            required
          />
          <FieldInput
            label="Registration Authority"
            type="text"
            value={registrationAuthority}
            onChange={setRegistrationAuthority}
            placeholder="e.g. Indian Nursing Council"
            required
          />
          <FieldInput
            label="Registration Valid Until"
            type="date"
            value={registrationValidUntil}
            onChange={setRegistrationValidUntil}
            required
          />

          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          {success && <p className="text-[12.5px] text-emerald-600">Profile updated successfully!</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}