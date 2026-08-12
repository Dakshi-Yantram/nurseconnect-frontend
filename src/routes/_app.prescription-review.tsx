import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { WorkflowModal, FormField, textareaCls } from "@/components/shared/WorkflowModals";
import { CheckCircle2, XCircle, Loader2, Package, ClipboardList, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/prescription-review")({
  component: PrescriptionReviewPage,
  head: () => ({ meta: [{ title: "Prescription Review — NurseConnect" }] }),
});

/**
 * Step 2 of both guarded workflows — the pharmacist reviews the doctor's
 * prescription before dispatch is allowed to start.
 *
 * Workflow 1 (Composite Care Package) rows only carry the Rx. Workflow 2
 * (Service-Only) rows additionally carry the patient's supply confirmation
 * and their supply photo, which must be checked against the prescription —
 * that's the whole point of the guardrail, since the platform isn't
 * supplying the materials.
 */
type QueueItem = {
  booking_id: string;
  booking_ref: string;
  patient_name: string;
  consumer_name: string | null;
  scheduled_date: string;
  scheduled_start_time: string;
  total_amount: string;
  material_included: boolean;
  prescription_url: string | null;
  patient_supply_confirmation: Record<string, boolean> | null;
  patient_supply_photo_url: string | null;
  created_at: string;
};

const SUPPLY_LABELS: Record<string, string> = {
  medicine: "Prescribed medicine",
  cannula_or_catheter: "Cannula / catheter",
  drip_set: "Drip set",
  prescription: "Prescription",
};

function PrescriptionReviewPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows: QueueItem[] = await apiFetch("/api/composite-care/prescription-queue");
      setItems(rows);
      setSelectedId((prev) => (prev && rows.some((r) => r.booking_id === prev) ? prev : rows[0]?.booking_id ?? null));
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = items.find((i) => i.booking_id === selectedId) ?? null;

  async function approve() {
    if (!selected) return;
    setBusy(true);
    try {
      await apiFetch(`/api/composite-care/bookings/${selected.booking_id}/approve-prescription`, {
        method: "POST",
      });
      toast.success("Prescription approved — dispatch has started.");
      await load();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!selected || !rejectReason.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/composite-care/bookings/${selected.booking_id}/reject-prescription`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      toast.success("Prescription rejected — the patient has been notified.");
      setRejectOpen(false);
      setRejectReason("");
      await load();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <p className="mt-2 text-[14px] font-semibold text-foreground">Queue is clear</p>
        <p className="text-[12.5px] text-muted-foreground">
          No prescriptions are waiting for review right now.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Queue */}
      <Card className="p-0 overflow-hidden self-start">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[13px] font-semibold text-foreground">Awaiting review</p>
          <p className="text-[11.5px] text-muted-foreground">{items.length} booking(s), oldest first</p>
        </div>
        <ul className="max-h-[70vh] overflow-y-auto divide-y divide-border">
          {items.map((item) => (
            <li key={item.booking_id}>
              <button
                onClick={() => setSelectedId(item.booking_id)}
                className={
                  "w-full text-left px-4 py-3 hover:bg-secondary " +
                  (item.booking_id === selectedId ? "bg-secondary" : "")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-foreground truncate">
                    {item.patient_name}
                  </span>
                  <WorkflowTag materialIncluded={item.material_included} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {item.booking_ref} · {item.scheduled_date}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Detail */}
      {selected && (
        <Card className="p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-bold text-foreground">{selected.patient_name}</h2>
              <p className="text-[12.5px] text-muted-foreground">
                {selected.booking_ref} · booked by {selected.consumer_name ?? "—"} ·{" "}
                {selected.scheduled_date} at {selected.scheduled_start_time}
              </p>
            </div>
            <WorkflowTag materialIncluded={selected.material_included} />
          </div>

          <section>
            <p className="text-[13px] font-semibold text-foreground mb-2">Doctor&apos;s prescription</p>
            <ImageProof url={selected.prescription_url} alt="Prescription" />
          </section>

          {!selected.material_included && (
            <section>
              <p className="text-[13px] font-semibold text-foreground mb-1">
                Patient&apos;s supplies
              </p>
              <p className="text-[11.5px] text-muted-foreground mb-2">
                This is a service-only booking — check these against the prescription before approving.
              </p>
              {selected.patient_supply_confirmation ? (
                <ul className="mb-3 space-y-1">
                  {Object.entries(selected.patient_supply_confirmation).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2 text-[12.5px]">
                      {value ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="text-foreground">{SUPPLY_LABELS[key] ?? key}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-muted-foreground mb-3">No confirmation on file.</p>
              )}
              <ImageProof url={selected.patient_supply_photo_url} alt="Patient supplies" />
            </section>
          )}

          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            <button
              onClick={approve}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve &amp; dispatch
            </button>
            <button
              onClick={() => setRejectOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-red-600 hover:bg-secondary disabled:opacity-40"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>
        </Card>
      )}

      <WorkflowModal
        open={rejectOpen}
        title="Reject prescription"
        description="This cancels the booking and notifies the patient."
        onClose={() => setRejectOpen(false)}
        onSubmit={reject}
        submitLabel="Reject"
        submitTone="danger"
        disabled={busy || !rejectReason.trim()}
      >
        <FormField label="Reason (shared with the patient)">
          <textarea
            className={textareaCls}
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Prescription is illegible, or the supplies shown don't match it."
          />
        </FormField>
      </WorkflowModal>
    </div>
  );
}

function WorkflowTag({ materialIncluded }: { materialIncluded: boolean }) {
  return materialIncluded ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
      <Package className="h-3 w-3" />
      Kit included
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-600">
      <ClipboardList className="h-3 w-3" />
      Service only
    </span>
  );
}

function ImageProof({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <p className="text-[12.5px] text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
        No {alt.toLowerCase()} on file.
      </p>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group block">
      <img
        src={url}
        alt={alt}
        className="max-h-72 w-full rounded-lg border border-border object-contain bg-muted/30"
      />
      <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground group-hover:text-foreground">
        <ExternalLink className="h-3 w-3" />
        Open full size
      </span>
    </a>
  );
}
