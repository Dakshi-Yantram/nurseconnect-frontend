import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Timeline, type TimelineItem } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { RULE_SETS } from "@/lib/mock-data";
import { useVersionedDoc } from "@/lib/orchestration";
import { useAuth } from "@/lib/auth-context";
import { Save, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_app/clinical-rule-sets/$ruleId")({ component: RuleSetEditor });

const VITALS = [
  { vital: "Systolic BP", normal: "90–140", warning: "140–160", critical: ">180" },
  { vital: "Diastolic BP", normal: "60–90", warning: "90–100", critical: ">110" },
  { vital: "Heart Rate", normal: "60–100", warning: "100–120", critical: ">130" },
  { vital: "SpO₂", normal: "≥95%", warning: "92–94%", critical: "<90%" },
  { vital: "Temperature (°F)", normal: "97–99", warning: "100–102", critical: ">103" },
  { vital: "Blood Glucose", normal: "70–180", warning: "180–250", critical: ">300" },
];

type RuleBody = { vitals: typeof VITALS };

function RuleSetEditor() {
  const { ruleId } = useParams({ from: "/_app/clinical-rule-sets/$ruleId" });
  const nav = useNavigate();
  const { user } = useAuth();
  const r = RULE_SETS.find(x => x.id === ruleId) ?? RULE_SETS[0];
  const { current, draft, published, versions, saveDraft, publish } =
    useVersionedDoc<RuleBody>(r.id, { vitals: VITALS });

  const actor = user?.email ?? "compliance@nurseconnect.in";
  const [rows, setRows] = useState<typeof VITALS>(current?.body.vitals ?? VITALS);
  const stage = draft ? "draft" : "published";

  const historyItems: TimelineItem[] = versions.slice().reverse().map(v => ({
    ts: new Date(v.updatedAt).toLocaleString("en-IN"),
    title: `v${v.version} ${v.stage}`,
    meta: v.updatedBy,
    tone: v.stage === "published" ? "success" : v.stage === "draft" ? "warning" : "muted",
  }));

  return (
    <DetailShell
      backTo="/clinical-rule-sets" backLabel="Back to Rule Sets"
      eyebrow={`Rule Set · ${r.id}`} title={r.name}
      badges={<>
        <StatusChip tone="info" label={r.category} />
        <StatusChip tone={stage === "draft" ? "warning" : "muted"} label={current ? `v${current.version} · ${current.stage}` : `v${r.version}`} />
      </>}
      subtitle={`Scope: ${r.scope} · Updated ${r.updated}`}
      actions={<>
        <ActionBtn onClick={() => { saveDraft({ vitals: rows }, actor); toast.message("Draft saved"); }}>
          <Save className="h-4 w-4" /> Save Draft
        </ActionBtn>
        <ActionBtn tone="primary" onClick={() => {
          saveDraft({ vitals: rows }, actor);
          const pub = publish(actor);
          if (pub) { toast.success(`Published v${pub.version}`); nav({ to: "/clinical-rule-sets" }); }
          else toast.error("Nothing to publish");
        }}><Send className="h-4 w-4" /> Publish</ActionBtn>
      </>}
    >
      <Card title="Vital Sign Thresholds">
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-muted-foreground text-left">
            <th className="py-2">Vital</th><th>Normal</th><th>Warning</th><th>Critical</th><th>Action</th>
          </tr></thead>
          <tbody>
            {rows.map((v, idx) => (
              <tr key={v.vital} className="border-t border-border">
                <td className="py-2.5 font-medium">{v.vital}</td>
                {(["normal","warning","critical"] as const).map(col => (
                  <td key={col}>
                    <input value={v[col]} onChange={e => {
                      const next = rows.slice();
                      next[idx] = { ...next[idx], [col]: e.target.value };
                      setRows(next);
                    }} className="w-28 px-2 py-1 rounded border border-border text-[12px]" />
                  </td>
                ))}
                <td><select className="px-2 py-1 rounded border border-border text-[12px]"><option>Notify nurse</option><option>Escalate to doctor</option><option>Notify family</option><option>Auto-call ambulance</option></select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Escalation Routing Logic">
          <ol className="space-y-2 text-[12.5px]">
            {[
              { t: "Tier 1 (Warning)", who: "Nurse → Clinical Desk", time: "5 min" },
              { t: "Tier 2 (High)", who: "Clinical Desk → Doctor on-call", time: "10 min" },
              { t: "Tier 3 (Critical)", who: "Doctor + Family + Ambulance Standby", time: "Immediate" },
            ].map(s => (
              <li key={s.t} className="p-3 rounded border border-border">
                <div className="font-medium">{s.t}</div>
                <div className="text-[11.5px] text-muted-foreground">{s.who} · within {s.time}</div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Insurance & Refusal Logic">
          <ul className="space-y-2 text-[12.5px]">
            <li className="p-3 rounded border border-border"><div className="font-medium">Auto-flag if checklist &lt; 14 / 18</div><div className="text-[11.5px] text-muted-foreground">Triggers manual coverage review</div></li>
            <li className="p-3 rounded border border-border"><div className="font-medium">Refusal of care × 3</div><div className="text-[11.5px] text-muted-foreground">Mandatory family + doctor sign-off</div></li>
            <li className="p-3 rounded border border-border"><div className="font-medium">Pre-auth missing</div><div className="text-[11.5px] text-muted-foreground">Block claim submission, notify ops</div></li>
          </ul>
        </Card>
      </div>

      <Card title="Red Flag Symptoms">
        <ul className="space-y-2">
          {["Sudden chest pain","Difficulty breathing","Loss of consciousness","Persistent confusion","Refusal of medication × 3"].map((s, i) => (
            <li key={s} className="flex items-center justify-between p-3 rounded border border-border text-[13px]">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" />{s}</div>
              <StatusChip tone={i < 3 ? "danger" : "warning"} label={i < 3 ? "critical" : "high"} dot />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Published baseline">
        {published
          ? <div className="text-[12px] text-muted-foreground">Locked v{published.version} by {published.updatedBy}</div>
          : <div className="text-[12px] text-muted-foreground">No published version yet — publish a draft to lock the baseline.</div>}
      </Card>

      <Card title="Version history">
        <Timeline items={historyItems} />
      </Card>
    </DetailShell>
  );
}
