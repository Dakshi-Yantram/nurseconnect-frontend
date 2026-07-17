import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { Download, ArrowLeft, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/audit-logs")({ component: AuditPage });

interface AuditLogRow {
  id: string;
  ts: string;
  actor: string;
  action: string;
  entity: string;
  changes: Record<string, unknown> | null;
}

function exportCSV(logs: AuditLogRow[]) {
  const headers = "Timestamp,Actor,Action,Entity,Changes";
  const body = logs.map(a =>
    `"${a.ts}","${a.actor}","${a.action}","${a.entity}","${a.changes ? JSON.stringify(a.changes) : ""}"`
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
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/admin/audit-logs")
      .then(setLogs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load audit logs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
          <button onClick={() => exportCSV(logs)} className="text-[12px] text-primary inline-flex items-center gap-1 hover:opacity-80">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        }
        padded={false}
      >
        {loading && <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Loading…</div>}
        {error && (
          <div className="px-5 py-8 text-center text-[13px] text-red-600">
            {error}
            <button onClick={load} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5">Timestamp</th><th className="px-5 py-2.5">Actor</th>
              <th className="px-5 py-2.5">Action</th><th className="px-5 py-2.5">Entity</th><th className="px-5 py-2.5">Changes</th>
            </tr></thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No audit events yet.</td></tr>
              )}
              {logs.map(a => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{a.ts}</td>
                  <td className="px-5 py-3">{a.actor}</td>
                  <td className="px-5 py-3"><StatusChip tone="info" label={a.action} /></td>
                  <td className="px-5 py-3 font-mono text-[12px]">{a.entity}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.changes ? JSON.stringify(a.changes) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}