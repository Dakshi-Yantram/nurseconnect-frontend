import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

/**
 * Fetches a visit's care-summary PDF and opens it.
 *
 * Same on-demand pattern as InvoiceButton: the PDF URL isn't known until
 * the endpoint is called, so this is a button rather than a plain link.
 * `endpoint` decides which view is fetched —
 *   GET /api/visits/{id}/report/pdf            (nurse's own copy)
 *   GET /api/visits/{id}/report/consumer/pdf    (family copy)
 * The two endpoints already enforce which fields make it into the PDF, so
 * this component doesn't need to know or care which one it's pointed at.
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

  const open = async () => {
    setLoading(true);
    try {
      const path =
        endpoint === "worker"
          ? `/api/visits/${bookingId}/report/pdf`
          : `/api/visits/${bookingId}/report/consumer/pdf`;
      const res = await apiFetch(path);
      if (res?.pdf_url) {
        window.open(res.pdf_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Report is still being prepared. Please try again shortly.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load the report";
      toast.error(
        msg.includes("checked out") || msg.includes("complete")
          ? "The report becomes downloadable once the visit is complete."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={open}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline disabled:opacity-50"
      }
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
