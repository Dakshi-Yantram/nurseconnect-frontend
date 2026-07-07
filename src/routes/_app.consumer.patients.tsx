import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  useConsumerPatients, usePatientVisitsById, usePatientConsentsById,
  useCreatePatient, useRefetchBookings,
} from "@/lib/domain";
import { useAuth } from "@/lib/auth-context";
import { bindStatus } from "@/lib/workflow-bind";
import { HeartHandshake, CalendarCheck, FileSignature, Activity, Plus, X } from "lucide-react";

/**
 * Phase 6B+C — Consumer patient continuity surface.
 *
 * Specialized for care continuity: per-patient operational summary with
 * counts of bookings/consents and last activity. Reads from the domain
 * context — no new state, no new schemas.
 *
 * Add-patient modal added: backend already exposed POST /api/patients
 * (see app/api/v1/consumer.py — create_patient) but the frontend never
 * called it. This wires that up via useCreatePatient().
 */
export const Route = createFileRoute("/_app/consumer/patients")({
  component: PatientsLayout,
  head: () => ({ meta: [{ title: "Patients — NurseConnect" }] }),
});

function PatientsLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (pathname === "/consumer/patients") return <ConsumerPatients />;
  return <Outlet />;
}

function ConsumerPatients() {
  const { user } = useAuth();
  const patients = useConsumerPatients(user?.id ?? null);
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">
          Care continuity across the people you manage. Each row aggregates ongoing
          services, consents and the most recent visit.
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          <Plus className="h-4 w-4" /> Add patient
        </button>
      </div>

      {patients.length === 0 ? (
        <Card title="My patients">
          <EmptyState icon={HeartHandshake} title="No patients added"
            description="Add a patient to start tracking care continuity." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.map(p => <PatientContinuityCard key={p.id} patient={p} />)}
        </div>
      )}

      {showAddModal && <AddPatientModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

function AddPatientModal({ onClose }: { onClose: () => void }) {
  const createPatient = useCreatePatient();
  const refetchBookings = useRefetchBookings();

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [relationship, setRelationship] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Patient name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPatient({
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        relationship_to_consumer: relationship || null,
        blood_group: bloodGroup || null,
        is_minor: isMinor,
        notes: notes || null,
      });
      // Bookings list reads patient names via patientMap built at load time;
      // refresh it so a freshly-added patient appears in booking creation too.
      await refetchBookings();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Could not add patient. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-card shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold">Add a patient</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted/50" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-[12.5px] text-muted-foreground">
            Add a person under your care. You'll be able to request bookings for them once added.
          </p>

          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
              {error}
            </div>
          )}

          <Field label="Full name" required>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Anita Sharma"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth">
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="Gender">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Relationship to you">
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. Father, Self, Spouse"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="Blood group">
              <input
                type="text"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                placeholder="e.g. O+"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={isMinor}
              onChange={(e) => setIsMinor(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            This patient is a minor
          </label>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything care providers should know upfront"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-[13px] font-medium hover:bg-muted/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Add patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-muted-foreground mb-1">
        {label}{required && <span className="text-rose-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

function PatientContinuityCard({ patient }: { patient: ReturnType<typeof useConsumerPatients>[number] }) {
  const visits = usePatientVisitsById(patient.id);
  const consents = usePatientConsentsById(patient.id);
  const active = visits.filter(v => v.rawStatus !== "completed" && v.rawStatus !== "cancelled");
  const recent = visits.slice(0, 4);

  return (
    <Link to="/consumer/patients/$patientId" params={{ patientId: patient.id }} className="block">
      <Card title={
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold">{patient.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {patient.id} · {patient.age}{patient.gender} · {patient.plan} · {patient.city}
            </div>
          </div>
        </div>
      }>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Stat icon={Activity} label="In care" value={active.length} tone="primary" />
          <Stat icon={CalendarCheck} label="Visits" value={visits.length} tone="info" />
          <Stat icon={FileSignature} label="Consents" value={consents.length} tone="success" />
        </div>
        <div className="mt-3 text-[12px] text-muted-foreground">
          Last visit: <span className="text-foreground">{patient.lastVisit ?? "—"}</span>
        </div>

        {recent.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Care journey</div>
            <ol className="relative pl-4 space-y-2">
              <span className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
              {recent.map(v => (
                <li key={v.id} className="relative">
                  <span className="absolute -left-[11px] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                  <div className="flex items-center gap-2">
                    <div className="text-[12px] truncate flex-1">
                      <span className="font-medium">{v.service}</span>
                      <span className="text-muted-foreground"> · {v.area}</span>
                    </div>
                    <StatusBadge workflow="booking" state={bindStatus("booking", v.rawStatus)} />
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">{v.startedAt}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </Link>
  );
}

function Stat({ icon: Icon, label, value, tone }: {
  icon: typeof Activity; label: string; value: number;
  tone: "primary" | "info" | "success";
}) {
  const toneCls = tone === "primary" ? "bg-primary/5 text-primary"
    : tone === "info" ? "bg-sky-50 text-sky-700"
    : "bg-emerald-50 text-emerald-700";
  return (
    <div className={`rounded-md px-2 py-2 ${toneCls}`}>
      <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide opacity-80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-[16px] font-semibold mt-0.5">{value}</div>
    </div>
  );
}