import { createFileRoute, useRouter } from "@tanstack/react-router";  // ← useRouter add karo
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { AUDIT_LOGS } from "@/lib/mock-data";
import { Download, ArrowLeft } from "lucide-react";  // ← ArrowLeft add karo

export const Route = createFileRoute("/_app/audit-logs")({ component: AuditPage });

function exportCSV() {
  const headers = "Timestamp,Actor,Action,Entity,Changes";
  const body = AUDIT_LOGS.map(a =>
    `"${a.ts}","${a.actor}","${a.action}","${a.entity}","${a.changes}"`
  ).join("\n");
  const blob = new Blob([`${headers}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audit-logs.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function AuditPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <Card
        title="Immutable Audit Trail"
        action={
          <button onClick={exportCSV} className="text-[12px] text-primary inline-flex items-center gap-1 hover:opacity-80">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        }
        padded={false}
      >
        <table className="w-full text-[13px]">
          <thead><tr className="bg-muted/40 text-muted-foreground text-left">
            <th className="px-5 py-2.5">Timestamp</th><th className="px-5 py-2.5">Actor</th>
            <th className="px-5 py-2.5">Action</th><th className="px-5 py-2.5">Entity</th><th className="px-5 py-2.5">Changes</th>
          </tr></thead>
          <tbody>
            {AUDIT_LOGS.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{a.ts}</td>
                <td className="px-5 py-3">{a.actor}</td>
                <td className="px-5 py-3"><StatusChip tone="info" label={a.action} /></td>
                <td className="px-5 py-3 font-mono text-[12px]">{a.entity}</td>
                <td className="px-5 py-3 text-muted-foreground">{a.changes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}