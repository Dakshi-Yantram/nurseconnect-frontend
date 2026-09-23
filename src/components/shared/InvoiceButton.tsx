import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

/**
 * Fetches a booking's tax invoice and opens the PDF.
 *
 * The PDF URL is not known until the invoice is fetched, so this is a button
 * rather than a plain link. GET /api/payments/bookings/{id}/invoice returns
 * the customer view only — it never carries the internal 80/20 split — and
 * generates the invoice on demand if a transient failure meant it was never
 * created at payment time, so a paid booking always yields a receipt.
 */
export function InvoiceButton({
  bookingId,
  label = "Invoice",
  className,
}: {
  bookingId: string;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const invoice = await apiFetch(`/api/payments/bookings/${bookingId}/invoice`);
      if (invoice?.pdf_url) {
        window.open(invoice.pdf_url, "_blank", "noopener,noreferrer");
      } else {
        // The invoice row exists but document storage did not return a URL.
        // Say so plainly rather than opening a blank tab.
        toast.error("Receipt is still being prepared. Please try again shortly.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load the invoice";
      toast.error(
        msg.includes("payment is completed")
          ? "The receipt becomes available once payment is completed."
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
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
