import { useRef, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, BASE_URL, apiErrorMessage, apiFetch, fetchWithTimeout, toApiError } from "@/lib/api";

/**
 * Downloads a visit's care-summary PDF.
 *
 *   1. GET /api/visits/{id}/report/pdf            (nurse's own copy)
 *      GET /api/visits/{id}/report/consumer/pdf   (family copy)
 *      -> { download_path, pdf_url, expires_in_seconds }   (bearer auth)
 *   2. GET {download_path}  — ~60s, single-use, user-bound link. The server
 *      re-checks access, writes the audit row and returns a PDF watermarked
 *      with this user's name/role/time and the audit reference.
 *
 * Previously this opened a PUBLIC Cloudinary URL in a new tab. The file is
 * now fetched as a blob and saved, so nothing sensitive ever sits at a
 * shareable URL and every failure lands in a toast instead of a dead tab.
 */
export function VisitReportButton({
  bookingId,
  endpoint,
  label = "Download report",
  className,
}: {
  bookingId: string;
  endpoint: "worker" | "consumer";
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  // Guards double-clicks between the click and React disabling the button.
  const inFlight = useRef(false);

  const download = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const path =
        endpoint === "worker"
          ? `/api/visits/${bookingId}/report/pdf`
          : `/api/visits/${bookingId}/report/consumer/pdf`;
      const link = await apiFetch(path, { timeoutMs: 20_000 });
      const dl: string | undefined = link?.download_path;
      if (!dl) throw new ApiError({ status: 502, raw: "missing download_path", code: "BAD_RESPONSE" });

      // Rendering happens here; allow longer than a normal request.
      const res = await fetchWithTimeout(`${BASE_URL}${dl}`, {
        timeoutMs: 45_000,
        headers: { Accept: "application/pdf" },
        cache: "no-store",
        credentials: "omit",
      });
      if (!res.ok) throw await toApiError(res);
      const blob = await res.blob();
      if (!blob.size || !(res.headers.get("content-type") ?? "").includes("pdf")) {
        throw new ApiError({ status: 502, raw: "not a pdf", code: "BAD_RESPONSE" });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `care-summary-${bookingId.slice(0, 8)}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser time to start the save before revoking.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success("Report downloaded. It is watermarked with your name — please don't share it.");
    } catch (e) {
      toast.error(downloadErrorMessage(e));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      aria-busy={loading}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline disabled:opacity-50"
      }
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
      {loading ? "Preparing…" : label}
    </button>
  );
}

export function downloadErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "VISIT_NOT_CHECKED_OUT":
      case "NO_VISIT_YET":
      case "VISIT_IN_PROGRESS":
        return "The report becomes downloadable once the visit is complete.";
      case "PDF_GENERATION_FAILED":
        return "We couldn't generate the report PDF. Please try again in a moment.";
      case "DOWNLOAD_LINK_EXPIRED":
      case "DOWNLOAD_LINK_USED":
      case "DOWNLOAD_LINK_INVALID":
        return "The download link expired before it could be used. Please tap Download again.";
      case "BAD_RESPONSE":
        return "The report couldn't be downloaded. Please try again.";
    }
    if (e.status === 403) return "You don't have access to this visit's report.";
    if (e.status === 404) return "This visit report could not be found.";
  }
  return apiErrorMessage(e, "Could not download the report. Please try again.");
}
