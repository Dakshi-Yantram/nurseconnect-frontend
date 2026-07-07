import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";

const SCORES = [
  { label: "Data Privacy (DPDP)", score: 97, tone: "success" as const },
  { label: "Clinical Documentation", score: 91, tone: "success" as const },
  { label: "Nurse Credential Checks", score: 88, tone: "warning" as const },
  { label: "Consent Management", score: 95, tone: "success" as const },
  { label: "Incident Reporting SLA", score: 79, tone: "warning" as const },
  { label: "Financial Reconciliation", score: 93, tone: "success" as const },
];

function ScoreBar({ score, tone }: { score: number; tone: "success" | "warning" }) {
  const barColor = tone === "success" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[12px] font-semibold tabular-nums w-8 text-right">{score}%</span>
    </div>
  );
}

export function ComplianceScoreCard() {
  const overall = Math.round(SCORES.reduce((s, x) => s + x.score, 0) / SCORES.length);
  const overallTone = overall >= 90 ? "success" : "warning" as const;
  return (
    <Card title="Compliance Scores" action={<StatusChip tone={overallTone} label={`Overall ${overall}%`} dot />}>
      <div className="space-y-4">
        {SCORES.map(s => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12.5px] text-foreground">{s.label}</span>
              <StatusChip tone={s.tone} label={s.score >= 90 ? "Good" : "Needs Attention"} />
            </div>
            <ScoreBar score={s.score} tone={s.tone} />
          </div>
        ))}
      </div>
    </Card>
  );
}
