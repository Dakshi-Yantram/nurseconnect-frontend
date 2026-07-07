import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { Timeline } from "@/components/shared/Timeline";
import { NURSES } from "@/lib/mock-data";
import { ArrowLeft, MapPin, Star, ShieldCheck, Wallet, FileText, Activity } from "lucide-react";
import { toast } from "sonner";
import { useAssignVisit } from "@/hooks/useAssignVisit";
export const Route = createFileRoute("/_app/nurses/$nurseId")({ component: NurseProfile });

function NurseProfile() {
  const { nurseId } = useParams({ from: "/_app/nurses/$nurseId" });
  const n = NURSES.find(x => x.id === nurseId) ?? NURSES[0];
  const { start, modals } = useAssignVisit({
  nurseName: n.name,
  nurseId: n.id,
});
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/users/nurses" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Nurses
        </Link>
        <div className="flex gap-2">
          <button onClick={() => toast.warning("Suspension flow opened")} className="px-3 py-1.5 text-[12.5px] rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50">Suspend</button>
          <button onClick={start} className="px-3 py-1.5 text-[12.5px] rounded-md bg-primary text-white">Assign Visit</button>
        </div>
      </div>

      <Card>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-purple grid place-items-center text-white text-[18px] font-semibold">
            {n.name.split(" ").map(w => w[0]).slice(0,2).join("")}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[18px] font-semibold">{n.name}</div>
              <StatusChip tone={statusToneFor(n.status)} label={n.status} dot />
              {n.verified && <StatusChip tone="success" label="Verified" />}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5">{n.id} · {n.specialty} · {n.experience} yrs experience</div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{n.city}</span>
              <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{n.rating} avg</span>
              <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />{n.visits} visits</span>
              <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />{n.earnings} lifetime</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Certifications" className="lg:col-span-1">
          <ul className="space-y-2 text-[12.5px]">
            {[
              { c: "BSc Nursing", i: "Manipal University · 2014" },
              { c: "BLS / ACLS", i: "AHA · valid till 2027" },
              { c: "Wound Care Specialist", i: "WCEI · 2020" },
            ].map(x => (
              <li key={x.c} className="p-2.5 rounded border border-border">
                <div className="font-medium">{x.c}</div>
                <div className="text-[11px] text-muted-foreground">{x.i}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Rating Trend" className="lg:col-span-2">
          <div className="flex items-end gap-2 h-[160px]">
            {[4.5,4.6,4.7,4.7,4.8,4.8,4.9].map((v,i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${(v-4) * 120}px` }} />
                <span className="text-[10px] text-muted-foreground">W{i+1}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Visits">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-muted-foreground"><th className="py-2">Date</th><th>Patient</th><th>Service</th><th>Rating</th></tr></thead>
            <tbody>
              {[
                { d: "2026-05-07", p: "Meera Joshi", s: "Geriatric Care", r: 5 },
                { d: "2026-05-05", p: "Anjali Verma", s: "BP Monitoring", r: 5 },
                { d: "2026-05-03", p: "Harish Mehta", s: "Wound Dressing", r: 4 },
                { d: "2026-05-01", p: "Lakshmi Pillai", s: "Palliative", r: 5 },
              ].map(v => (
                <tr key={v.d} className="border-t border-border">
                  <td className="py-2">{v.d}</td><td>{v.p}</td><td>{v.s}</td>
                  <td><span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{v.r}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Verification Documents">
          <ul className="space-y-2 text-[12.5px]">
            {[
              { d: "Nursing License (KAR)", s: "verified" },
              { d: "Aadhaar", s: "verified" },
              { d: "Police Clearance", s: "verified" },
              { d: "Insurance Consent", s: "active" },
            ].map(x => (
              <li key={x.d} className="flex items-center justify-between p-2.5 rounded border border-border">
                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{x.d}</span>
                <StatusChip tone="success" label={x.s} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Payout History">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-muted-foreground"><th className="py-2">Batch</th><th>Visits</th><th>Net</th><th>Status</th></tr></thead>
            <tbody>
              {[
                { b: "PO-9821", v: 42, n: "₹52,800", s: "approved" },
                { b: "PO-9820", v: 38, n: "₹47,400", s: "approved" },
                { b: "PO-9819", v: 35, n: "₹44,100", s: "approved" },
              ].map(p => (
                <tr key={p.b} className="border-t border-border">
                  <td className="py-2 font-mono text-[11.5px]">{p.b}</td><td>{p.v}</td>
                  <td className="font-medium">{p.n}</td><td><StatusChip tone="success" label={p.s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Availability & Preferred Areas">
          <div className="grid grid-cols-2 gap-3 text-[12.5px]">
            <div><div className="text-[11px] text-muted-foreground">Shifts</div><div className="font-medium">Day · Evening</div></div>
            <div><div className="text-[11px] text-muted-foreground">Hours / wk</div><div className="font-medium">42</div></div>
            <div><div className="text-[11px] text-muted-foreground">Insurance</div><div className="font-medium inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Covered</div></div>
            <div><div className="text-[11px] text-muted-foreground">Tier eligibility</div><div className="font-medium">tier1 – tier3</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Indiranagar", "HSR Layout", "Koramangala", "Whitefield"].map(a => <StatusChip key={a} tone="info" label={a} />)}
          </div>
        </Card>
      </div>

      <Card title="Audit & Activity Timeline">
        <Timeline items={[
          { ts: "2026-05-07 10:42", title: "Approved by admin@nurseconnect.in", tone: "success" },
          { ts: "2026-05-05 14:11", title: "Reference check complete", meta: "Verifier: BG-Ops", tone: "primary" },
          { ts: "2026-05-02 09:00", title: "License verified – KAR Nursing Council", tone: "primary" },
          { ts: "2026-04-28 12:30", title: "Application submitted", tone: "muted" },
        ]} />
      </Card>
       {modals}
    </div>
  );
}
