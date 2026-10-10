import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, QrCode, Send, Smartphone, Upload, AlertTriangle, Camera } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, apiFetch, apiUpload } from "@/lib/api";
import { LiveCameraCapture, type CapturedPhoto } from "@/components/booking/LiveCameraCapture";

/**
 * Prescription + live photo of the medicines/supplies, collected BEFORE payment
 * (and re-usable from the booking page and from the phone hand-off link).
 *
 * Server contract: app/api/v1/booking_verification.py
 */
export type VerificationState = {
  required: boolean;
  requires_prescription?: boolean;
  requires_supplies_photo?: boolean;
  supplies_mode?: "own" | "nurse_brings" | null;
  status: string;
  rejection_reason?: string | null;
  missing: string[];
  can_pay: boolean;
  prescription?: { uploaded: boolean; filename?: string | null };
  supplies_photo?: { uploaded: boolean; source?: string | null };
};

export type VerificationMode =
  | { kind: "booking"; bookingId: string }
  | { kind: "token"; token: string };

const MAX_MB = 10;

function endpoints(mode: VerificationMode) {
  if (mode.kind === "booking") {
    const b = `/api/bookings/${mode.bookingId}/verification`;
    return { status: b, rx: `${b}/prescription`, photo: `${b}/supplies-photo` };
  }
  const b = `/api/verify/${mode.token}`;
  return { status: b, rx: `${b}/prescription`, photo: `${b}/supplies-photo` };
}

export function VerificationPanel({
  mode,
  onChange,
  heading = "Before you pay",
  intro,
}: {
  mode: VerificationMode;
  /** Called every time the server state changes (e.g. to enable the Pay button). */
  onChange?: (s: VerificationState) => void;
  heading?: string;
  intro?: string;
}) {
  const ep = endpoints(mode);
  const [state, setState] = useState<VerificationState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"rx" | "photo" | null>(null);
  const [camera, setCamera] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [handoff, setHandoff] = useState<{ url: string; qr: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const apply = useCallback((s: any) => {
    // Public (token) endpoints wrap the state in { verification: {...} }.
    const v: VerificationState = s?.verification ?? s;
    setState(v);
    onChangeRef.current?.(v);
    return v;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      apply(await apiFetch(ep.status));
    } catch (e) {
      setLoadError(apiErrorMessage(e, "We couldn't load this step."));
    }
  }, [ep.status, apply]);

  useEffect(() => { load(); }, [load]);

  // While the phone hand-off QR is open, poll until the photo lands.
  useEffect(() => {
    if (!handoff || mode.kind !== "booking") return;
    const t = setInterval(async () => {
      try {
        const v = apply(await apiFetch(ep.status));
        if (v.supplies_photo?.uploaded) { setHandoff(null); toast.success("Photo received from your phone."); }
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(t);
  }, [handoff, mode.kind, ep.status, apply]);

  async function uploadRx(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`That file is larger than ${MAX_MB} MB.`); return; }
    setBusy("rx");
    try {
      const fd = new FormData();
      fd.append("file", file);
      apply(await apiUpload(ep.rx, fd));
      toast.success("Prescription uploaded.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't upload the prescription."));
    } finally {
      setBusy(null);
    }
  }

  async function uploadPhoto(p: CapturedPhoto) {
    setBusy("photo");
    try {
      const fd = new FormData();
      fd.append("file", new File([p.blob], "supplies.jpg", { type: p.blob.type || "image/jpeg" }));
      fd.append("source", mode.kind === "token" ? "whatsapp_link" : p.source);
      fd.append("confirm", "true");
      fd.append("width", String(p.width));
      fd.append("height", String(p.height));
      apply(await apiUpload(ep.photo, fd));
      setCamera(false);
      toast.success("Photo uploaded.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't upload the photo."));
    } finally {
      setBusy(null);
    }
  }

  async function openHandoff() {
    if (mode.kind !== "booking") return;
    try {
      const r = await apiFetch(`/api/bookings/${mode.bookingId}/verification/link`, { method: "POST" });
      setHandoff({ url: r.url, qr: r.qr ?? null });
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't create the phone link."));
    }
  }

  async function sendLink() {
    if (mode.kind !== "booking") return;
    setSending(true);
    try {
      const r = await apiFetch(`/api/bookings/${mode.bookingId}/verification/link/send`, { method: "POST" });
      if (r?.sent) toast.success("Link sent to your WhatsApp.");
      else toast.error(r?.detail ?? "Couldn't send the link. Scan the QR code instead.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't send the link."));
    } finally {
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
        {loadError}{" "}
        <button type="button" onClick={load} className="font-medium underline">Try again</button>
      </div>
    );
  }
  if (!state) {
    return <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!state.required) return null;

  const rxDone = !!state.prescription?.uploaded;
  const photoDone = !!state.supplies_photo?.uploaded;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[14px] font-semibold text-foreground">{heading}</p>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          {intro ?? "This service is doctor-prescribed. Please share your prescription"
            + (state.requires_supplies_photo ? " and a live photo of your medicines" : "") + "."}
        </p>
      </div>

      {state.status === "rejected" && state.rejection_reason && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Our reviewer couldn't accept the last upload: {state.rejection_reason}. Please upload it again.</span>
        </div>
      )}

      {/* 1 — Prescription: gallery / files / PDF all allowed */}
      {state.requires_prescription && (
        <section className="rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full ${rxDone ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {rxDone ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">Prescription</p>
              <p className="text-[12px] text-muted-foreground">
                {rxDone ? `Uploaded${state.prescription?.filename ? ` · ${state.prescription.filename}` : ""}`
                  : "Upload a photo or PDF of the doctor's prescription. You can choose from your gallery or files."}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => { uploadRx(e.target.files?.[0]); e.currentTarget.value = ""; }}
              />
              <button
                type="button"
                disabled={busy === "rx"}
                onClick={() => fileRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted disabled:opacity-50"
              >
                {busy === "rx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {rxDone ? "Replace prescription" : "Upload prescription"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 2 — Live photo of the medicines (camera only) */}
      {state.requires_supplies_photo && (
        <section className="rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full ${photoDone ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {photoDone ? <CheckCircle2 className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-[13px] font-semibold">Live photo of your medicines</p>
                <p className="text-[12px] text-muted-foreground">
                  {photoDone
                    ? "Photo received. Our reviewer will check the name, dose and expiry date against your prescription."
                    : "Take a photo now with the camera — photos from the gallery can't be used. Place the medicine inside the circle so the expiry date is readable."}
                </p>
              </div>

              {!camera && !handoff && (
                <>
                  <label className="flex items-start gap-2 text-[12.5px] text-foreground">
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary,#0a7)]" />
                    <span>The prescribed medicine, cannula/catheter and drip set are ready for the nurse.</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!confirm || busy === "photo"}
                      onClick={() => setCamera(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
                    >
                      {busy === "photo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      {photoDone ? "Retake photo" : "Open camera"}
                    </button>
                    {mode.kind === "booking" && (
                      <button
                        type="button"
                        disabled={!confirm}
                        onClick={openHandoff}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted disabled:opacity-40"
                      >
                        <Smartphone className="h-3.5 w-3.5" /> Use my phone
                      </button>
                    )}
                  </div>
                </>
              )}

              {camera && (
                <LiveCameraCapture
                  onCapture={uploadPhoto}
                  onCancel={() => setCamera(false)}
                  desktopFallback={
                    mode.kind === "booking" ? (
                      <button type="button" onClick={() => { setCamera(false); openHandoff(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground">
                        <QrCode className="h-3.5 w-3.5" /> Continue on my phone
                      </button>
                    ) : undefined
                  }
                />
              )}

              {handoff && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <p className="text-[12.5px] font-semibold text-foreground">Scan with your phone camera</p>
                  {handoff.qr && <img src={handoff.qr} alt="QR code to continue on your phone" className="h-40 w-40 rounded-md bg-white p-1" />}
                  <p className="text-[11.5px] text-muted-foreground">Or send the link to your registered WhatsApp number. This page updates automatically when the photo arrives.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={sendLink} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold hover:bg-muted disabled:opacity-50">
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send link on WhatsApp
                    </button>
                    <button type="button" onClick={() => setHandoff(null)} className="text-[12.5px] text-muted-foreground underline">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
