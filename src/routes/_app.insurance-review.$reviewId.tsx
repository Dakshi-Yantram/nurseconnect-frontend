import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Timeline } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { INSURANCE_REVIEWS } from "@/lib/mock-data";
import { Send, ShieldAlert, CheckCircle2, AlertOctagon, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/insurance-review/$reviewId")({ component: InsuranceDetail });

function InsuranceDetail() {
  const { reviewId } = useParams({ from: "/_app/insurance-review/$reviewId" });
  const nav = useNavigate();
  const r = INSURANCE_REVIEWS.find(x => x.id === reviewId) ?? INSURANCE_REVIEWS[0];

  return (
    <DetailShell
      backTo="/insurance-review" backLabel="Back to Insurance Review"
      eyebrow={`Coverage Assessment · ${r.id}`} title={`${r.patient} — ${r.insurer}`}
      badges={<>
        <StatusChip tone={r.coverage === "covered" ? "success" : r.coverage === "partial" ? "warning" : "danger"} label={r.coverage.replace("_"," ")} dot />
        {r.flagged && <StatusChip tone="danger" label="Flagged" dot />}
      </>}
      subtitle={`Booking #${r.booking}`}
      actions={<>
        <ActionBtn onClick={() => toast.success("Insurer notified")}><Send className="h-4 w-4" /> Notify Insurer</ActionBtn>
        <ActionBtn tone="warning" onClick={() => toast.message("Manual override applied")}><ShieldAlert className="h-4 w-4" /> Override Coverage</ActionBtn>
      </>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Coverage Summary" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-3 text-[12.5px]">
            <Info l="Insurer" v={r.insurer} />
            <Info l="Coverage" v={r.coverage.replace("_"," ")} />
            <Info l="Checklist" v={`${r.checklist}/${r.total}`} />
            <Info l="GPS Validated" v={r.gps ? "Yes" : "No"} />
            <Info l="Escalation Path Clear" v={r.escalation ? "Yes" : "No"} />
            <Info l="Patient" v={r.patient} />
          </div>
        </Card>

        <Card title="Verification Signals">
          <ul className="space-y-2 text-[12.5px]">
            <li className="p-2.5 rounded border border-border flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> GPS Validated</span>
              {r.gps ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertOctagon className="h-4 w-4 text-rose-500" />}
            </li>
            <li className="p-2.5 rounded border border-border flex items-center justify-between">
              <span>Escalation Path Verified</span>
              {r.escalation ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertOctagon className="h-4 w-4 text-amber-600" />}
            </li>
            <li className="p-2.5 rounded border border-border flex items-center justify-between">
              <span>Auto-flagged</span>
              {r.flagged ? <StatusChip tone="danger" label="Yes" /> : <StatusChip tone="success" label="Clean" />}
            </li>
          </ul>
        </Card>
      </div>

      <Card title="Documentation Checklist">
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[12.5px]">
          {Array.from({ length: r.total }).map((_, i) => {
            const done = i < r.checklist;
            return (
              <li key={i} className="flex items-center gap-2 p-2 rounded border border-border">
                {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertOctagon className="h-3.5 w-3.5 text-amber-600" />}
                <span className={done ? "" : "text-muted-foreground"}>Item {i + 1}: {done ? "Complete" : "Pending"}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Exclusion Reasons">
          <ul className="text-[12.5px] space-y-2">
            <li className="p-2.5 rounded border border-border">Service not in network</li>
            <li className="p-2.5 rounded border border-border">Pre-authorisation pending</li>
            <li className="p-2.5 rounded border border-border">Documentation incomplete</li>
          </ul>
        </Card>
        <Card title="Manual Override">
          <textarea className="w-full px-3 py-2 rounded-md border border-border min-h-[120px] text-[12.5px]" placeholder="Justification for manual override…" />
          <div className="mt-2 text-[11.5px] text-muted-foreground">All overrides are audit-logged and require compliance review.</div>
        </Card>
      </div>

      <Card title="Review Timeline">
        <Timeline items={[
          { ts: "Now", title: "Awaiting reviewer action", tone: "warning" },
          { ts: "2h ago", title: "Auto-checklist evaluation complete", tone: "muted" },
          { ts: "3h ago", title: "Booking submitted for coverage check", tone: "primary" },
        ]} />
      </Card>
    </DetailShell>
  );
}
function Info({ l, v }: { l: string; v: any }) { return <div><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5 capitalize">{v}</div></div>; }
