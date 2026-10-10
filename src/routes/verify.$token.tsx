import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { VerificationPanel, type VerificationState } from "@/components/booking/VerificationPanel";

// Public, mobile-first page opened from the WhatsApp reminder / QR code.
// No login: the signed link itself is the credential (expires after the visit
// slot). Everything it can do is limited to this one booking's verification.
export const Route = createFileRoute("/verify/$token")({
  component: VerifyPage,
  head: () => ({ meta: [{ title: "Verify your medicines — NurseConnect" }] }),
});

function VerifyPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<VerificationState | null>(null);
  const done = !!state && state.required && state.can_pay !== false && (state.missing?.length ?? 0) === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-[17px] font-semibold text-foreground">NurseConnect</h1>
        </div>

        {done && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 mt-0.5 text-emerald-700 shrink-0" />
            <p className="text-[13px] text-emerald-800">Thank you! We have everything we need. You can close this page.</p>
          </div>
        )}

        <VerificationPanel
          mode={{ kind: "token", token }}
          onChange={setState}
          heading="Verify your medicines"
          intro="Take a clear photo of your medicines so our team can check the name, dose and expiry date before the visit."
        />
      </div>
    </div>
  );
}
