import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { RETENTION_SCHEDULES, CONSENTS } from "@/lib/mock-data";
import { Play, Archive } from "lucide-react";
import { RunRetentionModal } from "@/components/retention/RunRetentionModal";
import { ArchiveRecordsModal } from "@/components/retention/ArchiveRecordsModal";

export const Route = createFileRoute("/_app/retention-dashboard")({ component: RetentionPage });

type RetentionRecord = (typeof RETENTION_SCHEDULES)[number];

function RetentionPage() {
  const [selectedRecord, setSelectedRecord] = useState<RetentionRecord | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const openRun = (r: RetentionRecord) => {
    setSelectedRecord(r);
    setRunOpen(true);
  };

  const openArchive = (r: RetentionRecord) => {
    setSelectedRecord(r);
    setArchiveOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        <Card title="Retention Schedules" padded={false}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-left">
                <th className="px-5 py-2.5">Entity</th>
                <th className="px-5 py-2.5">Policy</th>
                <th className="px-5 py-2.5">Last Run</th>
                <th className="px-5 py-2.5">Records Processed</th>
                <th className="px-5 py-2.5">Next Run</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_SCHEDULES.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{r.entity}</td>
                  <td className="px-5 py-3">
                    <StatusChip tone="info" label={r.policy} />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.lastRun}</td>
                  <td className="px-5 py-3">{r.processed.toLocaleString()}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.next}</td>
                  <td className="px-5 py-3">
                    <StatusChip
                      tone={r.active ? "success" : "muted"}
                      label={r.active ? "Active" : "Paused"}
                      dot
                    />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openRun(r)}
                        className="px-2.5 py-1.5 text-[12px] rounded border border-border inline-flex items-center gap-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <Play className="h-3 w-3" />
                        Run
                      </button>
                      <button
                        onClick={() => openArchive(r)}
                        className="px-2.5 py-1.5 text-[12px] rounded border border-border inline-flex items-center gap-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <Archive className="h-3 w-3" />
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Consent Management" padded={false}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-left">
                <th className="px-5 py-2.5">ID</th>
                <th className="px-5 py-2.5">Patient</th>
                <th className="px-5 py-2.5">Consent Type</th>
                <th className="px-5 py-2.5">Version</th>
                <th className="px-5 py-2.5">Signed</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {CONSENTS.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px]">{c.id}</td>
                  <td className="px-5 py-3 font-medium">{c.patient}</td>
                  <td className="px-5 py-3">{c.type}</td>
                  <td className="px-5 py-3">{c.version}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.signedAt}</td>
                  <td className="px-5 py-3">
                    <StatusChip
                      tone={
                        c.status === "active"
                          ? "success"
                          : c.status === "revoked"
                          ? "warning"
                          : "danger"
                      }
                      label={c.status}
                      dot
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Modals */}
      <RunRetentionModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        record={selectedRecord}
      />
      <ArchiveRecordsModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        record={selectedRecord}
      />
    </>
  );
}