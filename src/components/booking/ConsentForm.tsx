import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { consentParagraphs, type ConsentOnFile } from "@/lib/consent";

/**
 * Care consent shown inside the booking form: a readable paragraph block and a
 * single "I consent" tick box at the bottom. No signature pad — the form is
 * "signed" with the name of the PATIENT the booking is for.
 *
 * When a current-version consent is already on file for this patient it shows
 * a compact confirmation instead (expandable to re-read), and asks for nothing.
 */
export function ConsentForm({
  patientName, onFile, accepted, onAcceptedChange,
}: {
  patientName: string;
  onFile: ConsentOnFile | null;
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
}) {
  const [showText, setShowText] = useState(false);
  const paragraphs = consentParagraphs(patientName);
  const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  if (onFile) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-700 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-emerald-800">
              Care consent already given for {patientName || "this patient"}
            </p>
            <p className="text-[12px] text-emerald-800/80">
              Signed by {patientName || onFile.by} on {when(onFile.givenAt)}. You don't need to sign again.
            </p>
            <button type="button" onClick={() => setShowText((v) => !v)} className="mt-1 text-[12px] font-semibold text-primary hover:underline">
              {showText ? "Hide consent text" : "Read consent text"}
            </button>
            {showText && (
              <div className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-foreground/80">
                {paragraphs.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-[14px] font-semibold text-foreground">Consent for home nursing care</h3>
      </div>

      <div className="max-h-72 overflow-y-auto px-5 py-4 space-y-3 text-[13px] leading-relaxed text-foreground/85">
        {paragraphs.map((t, i) => <p key={i}>{t}</p>)}
      </div>

      <div className="border-t border-border px-5 py-4 space-y-2.5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => onAcceptedChange(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] accent-[var(--primary,#0a7)]"
          />
          <span className="text-[13px] font-medium text-foreground">
            I have read and I consent to the above{patientName ? ` for ${patientName}` : ""}.
          </span>
        </label>
        {accepted && (
          <p className="text-[12px] text-muted-foreground pl-[28px]">
            Signed by <span className="font-semibold text-foreground">{patientName || "the patient"}</span> ·{" "}
            {new Date().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>
    </section>
  );
}
