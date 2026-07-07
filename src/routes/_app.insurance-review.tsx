import { createFileRoute, useRouter, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Modal } from "@/components/shared/Modal";
import { INSURANCE_REVIEWS } from "@/lib/mock-data";
import { MapPin, AlertOctagon, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/insurance-review")({ component: InsurancePage });

function InsurancePage() {
  const router = useRouter();
  const nav = useNavigate();
  const [view, setView] = useState<typeof INSURANCE_REVIEWS[number] | null>(null);

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card title="Insurance Coverage Assessments" padded={false}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5">ID</th>
              <th className="px-5 py-2.5">Booking</th>
              <th className="px-5 py-2.5">Patient</th>
              <th className="px-5 py-2.5">Insurer</th>
              <th className="px-5 py-2.5">Coverage</th>
              <th className="px-5 py-2.5">Checklist</th>
              <th className="px-5 py-2.5">GPS</th>
              <th className="px-5 py-2.5">Escalation</th>
              <th className="px-5 py-2.5">Flagged</th>
              <th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {INSURANCE_REVIEWS.map(r => (
              <tr
                key={r.id}
                className="border-t border-border hover:bg-muted/30 cursor-pointer"
                onClick={() => setView(r)}
              >
                <td className="px-5 py-3 font-mono text-[12px]">{r.id}</td>
                <td className="px-5 py-3 font-mono text-[12px]">#{r.booking}</td>
                <td className="px-5 py-3 font-medium">{r.patient}</td>
                <td className="px-5 py-3">{r.insurer}</td>
                <td className="px-5 py-3">
                  <StatusChip
                    tone={r.coverage === "covered" ? "success" : r.coverage === "partial" ? "warning" : "danger"}
                    label={r.coverage.replace("_", " ")}
                    dot
                  />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(r.checklist / r.total) * 100}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{r.checklist}/{r.total}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {r.gps
                    ? <MapPin className="h-4 w-4 text-emerald-600" />
                    : <MapPin className="h-4 w-4 text-rose-500" />}
                </td>
                <td className="px-5 py-3">
                  {r.escalation
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    : <AlertOctagon className="h-4 w-4 text-amber-600" />}
                </td>

                {/* Flagged chip — navigates to detail page */}
                <td
                  className="px-5 py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav({ to: "/insurance-review/$reviewId", params: { reviewId: r.id } });
                  }}
                >
                  {r.flagged
                    ? <StatusChip tone="danger" label="Flagged" dot />
                    : <StatusChip tone="success" label="Clean" />}
                </td>

                {/* Review button — opens modal */}
                <td className="px-5 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setView(r); }}
                    className="text-[12px] text-primary hover:underline"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={`Coverage Assessment ${view?.id}`}
        description={`Booking #${view?.booking} · ${view?.patient}`}
        size="lg"
        footer={<>
          <button
            onClick={() => setView(null)}
            className="px-4 py-2 text-[13px] rounded-md border border-border"
          >
            Close
          </button>
          <button
            onClick={() => { setView(null); toast.success("Insurer notified"); }}
            className="px-4 py-2 text-[13px] rounded-md border border-border"
          >
            Notify Insurer
          </button>
          <button
            onClick={() => { setView(null); toast.message("Manual override applied"); }}
            className="px-4 py-2 text-[13px] rounded-md bg-amber-600 text-white"
          >
            Override Coverage
          </button>
        </>}
      >
        {view && (
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-3 gap-3">
              <Info l="Insurer" v={view.insurer} />
              <Info l="Coverage" v={view.coverage.replace("_", " ")} />
              <Info l="Checklist" v={`${view.checklist}/${view.total}`} />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold mb-2">Checklist</h4>
              <ul className="grid grid-cols-2 gap-1.5 text-[12.5px]">
                {Array.from({ length: view.total }).map((_, i) => (
                  <li key={i} className="flex items-center gap-2 p-2 rounded border border-border">
                    {i < view.checklist
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      : <AlertOctagon className="h-3.5 w-3.5 text-amber-600" />}
                    Item {i + 1}: {i < view.checklist ? "Complete" : "Pending"}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold mb-2">Exclusion Reasons</h4>
              <ul className="text-[12.5px] space-y-1">
                <li>• Service not in network</li>
                <li>• Pre-authorisation pending</li>
                <li>• Documentation incomplete</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold mb-2">Override Reason</h4>
              <textarea
                className="w-full px-3 py-2 rounded-md border border-border min-h-[80px]"
                placeholder="Justification for manual override…"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ l, v }: { l: string; v: any }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{l}</div>
      <div className="font-medium mt-0.5 capitalize">{v}</div>
    </div>
  );
}