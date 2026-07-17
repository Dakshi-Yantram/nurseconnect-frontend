import { useState } from "react";
import { Loader2, IdCard } from "lucide-react";
import { apiFetch } from "@/lib/api";

export function WorkerCredentialsForm({
  initialDob, initialRegNo, initialRegAuthority, initialRegValidUntil, onSaved,
}: {
  initialDob?: string | null;
  initialRegNo?: string | null;
  initialRegAuthority?: string | null;
  initialRegValidUntil?: string | null;
  onSaved?: () => void;
}) {
  const [dob, setDob] = useState(initialDob ?? "");
  const [regNo, setRegNo] = useState(initialRegNo ?? "");
  const [regAuthority, setRegAuthority] = useState(initialRegAuthority ?? "");
  const [regValidUntil, setRegValidUntil] = useState(initialRegValidUntil ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSave =
    dob.trim() !== "" &&
    regNo.trim() !== "" &&
    regAuthority.trim() !== "" &&
    regValidUntil.trim() !== "";

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await apiFetch("/api/workers/me", {
        method: "PUT",
        body: JSON.stringify({
          date_of_birth: dob || null,
          registration_no: regNo.trim() || null,
          registration_authority: regAuthority.trim() || null,
          registration_valid_until: regValidUntil || null,
        }),
      });
      setSaved(true);
      onSaved?.();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <IdCard size={15} className="text-primary" />
        <p className="text-[13.5px] font-bold text-foreground">Your details</p>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        We need a few more details before a reviewer can verify your account.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="md:col-span-3">
          <label className="text-[11px] font-semibold text-muted-foreground">Date of birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Registration valid until</label>
          <input
            type="date"
            value={regValidUntil}
            onChange={(e) => setRegValidUntil(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Registration / license no.</label>
          <input
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            placeholder="e.g. KNC-2024-00123"
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Registration authority</label>
          <input
            value={regAuthority}
            onChange={(e) => setRegAuthority(e.target.value)}
            placeholder="e.g. Kerala Nursing Council"
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
          />
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      {saved && <p className="mt-2 text-[12px] text-emerald-700">Details saved.</p>}
      <button
        onClick={save}
        disabled={busy || !canSave}
        className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save details"}
      </button>
    </div>
  );
}