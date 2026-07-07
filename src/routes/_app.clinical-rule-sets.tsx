import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { RULE_SETS } from "@/lib/mock-data";
import { Edit2, History, BookOpen, AlertTriangle, ShieldCheck, Activity, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clinical-rule-sets")({ component: RuleSetsPage });

const VITAL_THRESHOLDS = [
  { vital: "Systolic BP", normal: "90–140", warning: "140–160", critical: ">180" },
  { vital: "Diastolic BP", normal: "60–90", warning: "90–100", critical: ">110" },
  { vital: "Heart Rate", normal: "60–100", warning: "100–120", critical: ">130" },
  { vital: "SpO₂", normal: "≥95%", warning: "92–94%", critical: "<90%" },
  { vital: "Temperature (°F)", normal: "97–99", warning: "100–102", critical: ">103" },
  { vital: "Blood Glucose", normal: "70–180", warning: "180–250", critical: ">300" },
];

function RuleSetsPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <button onClick={() => router.history.back()} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card title="Rule Sets" padded={false}>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-muted/40 text-muted-foreground text-left">
            <th className="px-5 py-2.5">ID</th><th className="px-5 py-2.5">Name</th><th className="px-5 py-2.5">Category</th>
            <th className="px-5 py-2.5">Scope</th><th className="px-5 py-2.5">Version</th><th className="px-5 py-2.5">Updated</th><th className="px-5 py-2.5"></th>
          </tr></thead>
          <tbody>
            {RULE_SETS.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-[12px]">{r.id}</td>
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-5 py-3"><StatusChip tone="info" label={r.category} /></td>
                <td className="px-5 py-3 text-muted-foreground">{r.scope}</td>
                <td className="px-5 py-3">v{r.version}</td>
                <td className="px-5 py-3 text-muted-foreground">{r.updated}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => toast.message("Rule editor opened")} className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"><Edit2 className="h-4 w-4 text-muted-foreground" /></button>
                    <button onClick={() => toast.message("Version history loaded")} className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"><History className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Vital Sign Thresholds" action={<span className="text-muted-foreground">v8</span>}>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-muted-foreground text-left">
              <th className="py-2 font-medium">Vital</th><th className="py-2 font-medium">Normal</th>
              <th className="py-2 font-medium">Warning</th><th className="py-2 font-medium">Critical</th>
            </tr></thead>
            <tbody>
              {VITAL_THRESHOLDS.map(v => (
                <tr key={v.vital} className="border-t border-border">
                  <td className="py-2.5 font-medium">{v.vital}</td>
                  <td className="py-2.5"><StatusChip tone="success" label={v.normal} /></td>
                  <td className="py-2.5"><StatusChip tone="warning" label={v.warning} /></td>
                  <td className="py-2.5"><StatusChip tone="danger" label={v.critical} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Red Flag Symptoms">
          <ul className="space-y-2">
            {[
              { i: AlertTriangle, t: "Sudden chest pain", sev: "critical" },
              { i: AlertTriangle, t: "Difficulty breathing", sev: "critical" },
              { i: Activity, t: "Loss of consciousness", sev: "critical" },
              { i: BookOpen, t: "Persistent confusion", sev: "high" },
              { i: ShieldCheck, t: "Refusal of medication × 3", sev: "high" },
            ].map(s => (
              <li key={s.t} className="flex items-center justify-between p-3 rounded border border-border">
                <div className="flex items-center gap-2.5">
                  <s.i className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px]">{s.t}</span>
                </div>
                <StatusChip tone={s.sev === "critical" ? "danger" : "warning"} label={s.sev} dot />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Refusal of Care Protocol">
        <ol className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {["Document refusal in real-time", "Notify clinical desk within 15m", "Family notification template", "Consent re-verification flow"].map((s, i) => (
            <li key={i} className="p-3 rounded border border-border">
              <div className="text-[11px] text-muted-foreground">Step {i + 1}</div>
              <div className="text-[13px] font-medium mt-1">{s}</div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}