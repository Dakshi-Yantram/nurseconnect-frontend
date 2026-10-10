import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";

/**
 * Live-camera-only photo capture for medicine / supplies verification.
 *
 *  - Opens the rear camera with getUserMedia and shows a CIRCLE guide: the
 *    patient places the medicine strip / vial inside it so the printed
 *    batch + expiry dates fill the frame and can be read by the reviewer / OCR.
 *  - The picture is a single frame grabbed from the live video stream, so
 *    there is NO gallery / album / "Live Photo" path anywhere in this flow.
 *  - If the browser can't give us a live stream (no permission, no camera,
 *    plain-HTTP page): on a PHONE we fall back to the native camera via
 *    <input type="file" accept="image/*" capture="environment"> (which opens the
 *    camera directly and, in addition, is rejected here if the file is older than
 *    a few minutes — i.e. picked from the gallery by a browser that ignored
 *    `capture`). On a DESKTOP we render `desktopFallback` (the QR hand-off).
 */
export interface CapturedPhoto {
  blob: Blob;
  width: number;
  height: number;
  source: "web_camera" | "phone_camera";
}

const MAX_AGE_MS = 5 * 60 * 1000;
const isMobileUA = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function LiveCameraCapture({
  onCapture,
  onCancel,
  title = "Photo of your medicines",
  hint = "Place the medicine inside the circle. The batch number and expiry date must be sharp and readable.",
  desktopFallback,
}: {
  onCapture: (p: CapturedPhoto) => void;
  onCancel?: () => void;
  title?: string;
  hint?: string;
  /** Shown instead of the native-camera fallback when no live camera is available on a desktop. */
  desktopFallback?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [phase, setPhase] = useState<"starting" | "live" | "unavailable">("starting");
  const [reason, setReason] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; photo: CapturedPhoto } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setPhase("starting");
    setReason(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setReason("Your browser can't open the camera here.");
      setPhase("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => undefined);
      }
      setPhase("live");
    } catch (e) {
      const name = (e as DOMException)?.name;
      setReason(
        name === "NotAllowedError"
          ? "Camera permission was blocked. Allow camera access in your browser and try again."
          : name === "NotFoundError"
            ? "No camera was found on this device."
            : "We couldn't start the camera.",
      );
      setPhase("unavailable");
    }
  }, []);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const snap = useCallback(() => {
    const v = videoRef.current;
    const frame = frameRef.current;
    if (!v || !frame || !v.videoWidth) return;

    // The circle is drawn on screen over an object-cover video; map its bounding
    // square back to source-video pixels so the saved photo is exactly what the
    // customer framed (cropped to the circle's square, at full camera resolution).
    const box = frame.getBoundingClientRect();
    const vb = v.getBoundingClientRect();
    const scale = Math.max(vb.width / v.videoWidth, vb.height / v.videoHeight);
    const shownW = v.videoWidth * scale;
    const shownH = v.videoHeight * scale;
    const offX = (shownW - vb.width) / 2;
    const offY = (shownH - vb.height) / 2;
    const sx = Math.max(0, (box.left - vb.left + offX) / scale);
    const sy = Math.max(0, (box.top - vb.top + offY) / scale);
    const sSize = Math.min(box.width / scale, v.videoWidth - sx, v.videoHeight - sy);

    const out = Math.min(1600, Math.round(sSize));
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, sx, sy, sSize, sSize, 0, 0, out, out);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        setPreview({
          url: URL.createObjectURL(blob),
          photo: { blob, width: out, height: out, source: "web_camera" },
        });
      },
      "image/jpeg",
      0.92,
    );
  }, [stop]);

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    start();
  };

  // Native camera fallback (phones only).
  const onNativeFile = (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (Date.now() - f.lastModified > MAX_AGE_MS) {
      setFileError("That photo isn't new. Please take a fresh photo with the camera now.");
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () =>
      setPreview({ url, photo: { blob: f, width: img.naturalWidth, height: img.naturalHeight, source: "phone_camera" } });
    img.onerror = () => setFileError("We couldn't read that photo. Please try again.");
    img.src = url;
  };

  if (preview) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-foreground">Check the photo</p>
        <img src={preview.url} alt="Captured medicines" className="w-full max-h-[60vh] rounded-xl border border-border object-contain bg-black" />
        <p className="text-[12px] text-muted-foreground">Can you read the batch number and expiry date? If not, retake it closer and in good light.</p>
        <div className="flex gap-2">
          <button type="button" onClick={retake} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-[13px] font-semibold hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> Retake
          </button>
          <button type="button" onClick={() => onCapture(preview.photo)} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90">
            Use this photo
          </button>
        </div>
      </div>
    );
  }

  if (phase === "unavailable") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {reason && <p className="text-[12.5px] text-amber-700 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">{reason}</p>}
        {isMobileUA() ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => { onNativeFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
            />
            <button type="button" onClick={() => inputRef.current?.click()} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground">
              <Camera className="h-4 w-4" /> Open camera
            </button>
            {fileError && <p className="text-[12px] text-red-600">{fileError}</p>}
            <button type="button" onClick={start} className="text-[12px] font-medium text-primary underline">Try live camera again</button>
          </>
        ) : (
          <>
            {desktopFallback ?? <p className="text-[12.5px] text-muted-foreground">Please open this page on your phone to take the photo.</p>}
            <button type="button" onClick={start} className="text-[12px] font-medium text-primary underline">Try this computer's camera again</button>
          </>
        )}
        {onCancel && <button type="button" onClick={onCancel} className="block text-[12px] text-muted-foreground underline">Cancel</button>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {onCancel && (
          <button type="button" onClick={() => { stop(); onCancel(); }} aria-label="Close camera" className="h-8 w-8 grid place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative w-full aspect-[3/4] sm:aspect-video overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
        {/* Circle guide: the huge box-shadow darkens everything outside the circle. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            ref={frameRef}
            className="aspect-square rounded-full border-[3px] border-white/90"
            style={{ width: "min(72%, 70vh)", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
          />
        </div>
        {phase === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-white/90 text-[13px]">
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Starting camera…</span>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 left-3 right-3 text-center text-[12px] text-white drop-shadow">{hint}</p>
      </div>

      <button
        type="button"
        onClick={snap}
        disabled={phase !== "live"}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
      >
        <Camera className="h-4 w-4" /> Take photo
      </button>
    </div>
  );
}
