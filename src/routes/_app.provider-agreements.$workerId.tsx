import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { DetailShell } from "@/components/shared/DetailShell";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/provider-agreements/$workerId")({ component: ProviderAgreementDetail });

interface ContractPreview {
  stage: number;
  status: string;
  rendered_text: string | null;
  unlocked: boolean;
  reason: string | null;
}

function ProviderAgreementDetail() {
  const { workerId } = useParams({ from: "/_app/provider-agreements/$workerId" });
  const [contracts, setContracts] = useState<ContractPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/contracts/admin/${workerId}`)
      .then((data: ContractPreview[]) => setContracts(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load agreement"))
      .finally(() => setLoading(false));
  }, [workerId]);

  const stage1 = contracts.find((c) => c.stage === 1);
  const stage2 = contracts.find((c) => c.stage === 2);

  return (
    <DetailShell
      backTo="/provider-agreements"
      backLabel="Back to Provider Agreements"
      eyebrow={`Provider · ${workerId}`}
      title="Contract Status"
      status={stage1?.status}
    >
      {loading ? (
        <div className="text-[13px] text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-[13px] text-rose-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title="Stage 1 — In-App Clickwrap"
            action={<StatusChip tone={statusToneFor(stage1?.status ?? "pending")} label={(stage1?.status ?? "pending").replace("_", " ")} dot />}
          >
            {stage1?.rendered_text ? (
              <pre className="whitespace-pre-wrap text-[12px] leading-5 text-foreground font-sans">{stage1.rendered_text}</pre>
            ) : (
              <div className="text-[12.5px] text-muted-foreground">Not yet accepted — nothing recorded.</div>
            )}
          </Card>

          <Card
            title="Stage 2 — Master Agreement (e-Stamp)"
            action={
              <StatusChip
                tone={stage2?.status === "not_applicable" ? "muted" : statusToneFor(stage2?.status ?? "pending")}
                label={(stage2?.status ?? "not_applicable").replace("_", " ")}
                dot
              />
            }
          >
            {stage2?.status === "not_applicable" ? (
              <div className="text-[12.5px] text-muted-foreground">{stage2.reason ?? "Locked until first booking is completed."}</div>
            ) : stage2?.rendered_text ? (
              <pre className="whitespace-pre-wrap text-[12px] leading-5 text-foreground font-sans">{stage2.rendered_text}</pre>
            ) : (
              <div className="text-[12.5px] text-muted-foreground">Unlocked, not yet executed.</div>
            )}
          </Card>
        </div>
      )}
    </DetailShell>
  );
}
