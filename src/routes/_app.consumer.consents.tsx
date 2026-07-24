import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConsentStatusCard } from "@/components/entity/EntityCards";
import { SchemaForm } from "@/lib/forms/SchemaForm";
import { CONSENT_SCHEMA } from "@/lib/forms/templates";
import { useConsumerPatients, usePatientConsentsById } from "@/lib/domain";
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
  const store = useOrchestration();
  const { user } = useAuth();

  // The logged-in consumer's own linked patients (e.g. family members under their care).
  const patients = useConsumerPatients(user?.id ?? null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  // Default to the first patient once the list loads.
  useEffect(() => {
    if (!selectedPatientId && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  const consents = usePatientConsentsById(selectedPatientId || null);
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const onSubmit = async (values: Record<string, unknown>) => {
    if (!selectedPatientId) {
      toast.error("Select a patient before submitting consent.");
      return;
    }
    try {
      await apiFetch("/api/consents", {
        method: "POST",
        body: JSON.stringify({
          patient_id: selectedPatientId,
          consent_type: "service",
          consented_by_name: user?.name ?? "Consumer",
          relationship_to_patient: "self",
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
        `Consent submitted for ${selectedPatient?.name ?? selectedPatientId} (treatment=${!!values.treatment_consent}, data=${!!values.data_consent})`
      );

      toast.success("Consent submitted and recorded");
    } catch (err) {
      console.error("Consent submission failed:", err);
      toast.error("Failed to submit consent. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {patients.length > 0 && (
        <Card title="Patient" padded>
          <label className="block text-sm font-medium mb-1" htmlFor="consent-patient-select">
            Who is this consent for?
          </label>
          <select
            id="consent-patient-select"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selectedPatientId}
            onChange={e => setSelectedPatientId(e.target.value)}
          >
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Card>
      )}

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