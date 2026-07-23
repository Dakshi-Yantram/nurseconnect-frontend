import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConsentStatusCard } from "@/components/entity/EntityCards";
import { SchemaForm } from "@/lib/forms/SchemaForm";
import { CONSENT_SCHEMA } from "@/lib/forms/templates";
import { useConsents } from "@/lib/domain";
import { useOrchestration } from "@/lib/orchestration";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { FileSignature } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/consumer/consents")({
  component: ConsumerConsents,
  head: () => ({ meta: [{ title: "Consents — NurseConnect" }] }),
});

function ConsumerConsents() {
  const consents = useConsents();
  const store = useOrchestration();
  const { user } = useAuth();

  const onSubmit = async (values: Record<string, unknown>) => {
    try {
      await apiFetch("/api/consents", {
        method: "POST",
        body: JSON.stringify({
          patient_id: user?.id,
          consent_type: "service",
          consented_by_name: user?.name ?? "Consumer",
          capture_method: "digital_checkbox",
          treatment_consent: !!values.treatment_consent,
          data_consent: !!values.data_consent,
        }),
      });

      store.annotate(
        "booking",
        "consent_record",
        user?.email ?? "consumer@nurseconnect.in",
        user?.role ?? null,
        `Consent submitted (treatment=${!!values.treatment_consent}, data=${!!values.data_consent})`
      );

      toast.success("Consent submitted and recorded");
    } catch (err) {
      console.error("Consent submission failed:", err);
      toast.error("Failed to submit consent. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Active consents" padded={false}>
        {consents.length === 0
          ? <div className="p-5"><EmptyState icon={FileSignature} title="No consents on file" /></div>
          : consents.map(c => <ConsentStatusCard key={c.id} c={c} />)}
      </Card>

      <SchemaForm
        schema={CONSENT_SCHEMA}
        submitLabel="Submit consent"
        onSubmit={onSubmit}
      />
    </div>
  );
}