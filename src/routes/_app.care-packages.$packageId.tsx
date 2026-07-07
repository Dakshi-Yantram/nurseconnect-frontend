import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Timeline, type TimelineItem } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { CARE_PACKAGES } from "@/lib/mock-data";
import { CARE_PACKAGE_SCHEMA } from "@/lib/forms/templates";
import { SchemaForm } from "@/lib/forms/SchemaForm";
import { useVersionedDoc } from "@/lib/orchestration";
import { useAuth } from "@/lib/auth-context";
import { Send, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/care-packages/$packageId")({ component: PackageEditor });

type PkgBody = Record<string, unknown>;

function PackageEditor() {
  const { packageId } = useParams({ from: "/_app/care-packages/$packageId" });
  const nav = useNavigate();
  const { user } = useAuth();
  const p = CARE_PACKAGES.find(x => x.id === packageId) ?? CARE_PACKAGES[0];

  // Seed published baseline from mock data; subsequent edits create drafts.
  const initial: PkgBody = {
    name: p.name, service_tier: p.tier === "tier1" ? "basic" : p.tier === "tier2" ? "care_plus" : "family_pro",
    summary: p.target, visits_per_week: Math.max(1, Math.round(p.visits / 4)),
    hours_per_visit: 2, includes_clinical: true, live_in: false,
  };
  const { current, draft, published, versions, saveDraft, publish } =
    useVersionedDoc<PkgBody>(p.id, initial);

  const actor = user?.email ?? "admin@nurseconnect.in";
  const stage = draft ? "draft" : "published";

  const items: TimelineItem[] = versions.slice().reverse().map(v => ({
    ts: new Date(v.updatedAt).toLocaleString("en-IN"),
    title: `v${v.version} ${v.stage}`,
    meta: v.updatedBy,
    tone: v.stage === "published" ? "success" : v.stage === "draft" ? "warning" : "muted",
  }));

  return (
    <DetailShell
      backTo="/care-packages" backLabel="Back to Care Packages"
      eyebrow={`Care Package · ${p.code}`} title={String(current?.body?.name ?? p.name)}
      badges={<>
        <StatusChip tone={p.active ? "success" : "muted"} label={p.active ? "Active" : "Inactive"} dot />
        <StatusChip tone={stage === "draft" ? "warning" : "info"} label={current ? `v${current.version} · ${current.stage}` : "no version"} />
      </>}
      subtitle={p.target}
      actions={<>
        <ActionBtn onClick={() => toast.success("Cloned as new draft")}><Copy className="h-4 w-4" /> Clone</ActionBtn>
        <ActionBtn tone="primary" onClick={() => {
          const pub = publish(actor);
          if (pub) { toast.success(`Published v${pub.version}`); nav({ to: "/care-packages" }); }
          else toast.error("Save a draft before publishing");
        }}><Send className="h-4 w-4" /> Publish</ActionBtn>
      </>}
    >
      <Card title="Package configuration">
        <SchemaForm schema={CARE_PACKAGE_SCHEMA}
          initialValues={current?.body ?? initial}
          submitLabel="Save draft"
          onSubmit={(v) => { saveDraft(v as PkgBody, actor); toast.success("Draft saved"); }} />
      </Card>

      <Card title="Published baseline">
        {published
          ? <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap font-mono">{JSON.stringify(published.body, null, 2)}</pre>
          : <div className="text-[12.5px] text-muted-foreground">No published version yet — publish a draft to lock the baseline.</div>}
      </Card>

      <Card title="Version history">
        <Timeline items={items} />
      </Card>
    </DetailShell>
  );
}
