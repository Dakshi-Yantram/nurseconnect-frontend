import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  useConsumerPatients, useBookings,
  useCreatePatient, useRefetchBookings,
} from "@/lib/domain";
import { BookingRow } from "@/components/consumer/BookingRow";
import { bucketOf, relativeWhen, whenParts } from "@/lib/booking-view";
import { useAuth } from "@/lib/auth-context";
import { HeartHandshake, CalendarCheck, Activity, CheckCircle2, ChevronRight, Plus, X } from "lucide-react";

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-semibold">Your patients</div>
          <div className="text-[12.5px] text-muted-foreground">
            The people you book care for — their upcoming visits and recent history.
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 shrink-0"
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
  const all = useBookings();
  const mine = all.filter((b) => b.patientId === patient.id);
  const upcoming = mine
    .filter((b) => bucketOf(b) === "upcoming")
    .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
  const inCare = mine.filter((b) => bucketOf(b) === "in_care").length;
  const completed = mine.filter((b) => b.rawStatus === "completed").length;
  const recent = [...mine]
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))
    .slice(0, 3);
  const next = upcoming[0];
  const nextWhen = next ? whenParts(next.startedAt) : null;

  // Only show details that are real (the old card printed the raw id and "—").
  const meta = [
    patient.age ? `${patient.age} yrs` : null,
    patient.gender === "F" ? "Female" : patient.gender === "M" ? "Male" : null,
    patient.plan && patient.plan !== "—" ? patient.plan.charAt(0).toUpperCase() + patient.plan.slice(1) : null,
  ].filter(Boolean).join(" · ");

  return (
    <Card padded={false}>
      <Link to="/consumer/patients/$patientId" params={{ patientId: patient.id }}
        className="flex items-center gap-3 px-5 py-4 border-b border-border hover:bg-muted/30 transition-colors">
        <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center text-[16px] font-semibold shrink-0">
          {patient.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold truncate">{patient.name}</div>
          <div className="text-[12px] text-muted-foreground truncate">{meta || "Patient"}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>

      <div className="grid grid-cols-3 gap-2 px-5 py-3">
        <Stat icon={Activity} label="In care" value={inCare} tone="primary" />
        <Stat icon={CalendarCheck} label="Upcoming" value={upcoming.length} tone="info" />
        <Stat icon={CheckCircle2} label="Completed" value={completed} tone="success" />
      </div>

      <div className="px-5 pb-3 text-[12px] text-muted-foreground">
        {next && nextWhen ? (
          <>Next visit: <span className="text-foreground font-medium">{nextWhen.date} · {nextWhen.time}</span>
            {relativeWhen(next.startedAt) ? <span className="text-primary font-medium"> ({relativeWhen(next.startedAt)})</span> : null}</>
        ) : "No upcoming visit"}
      </div>

      {recent.length > 0 && (
        <div className="border-t border-border">
          <div className="px-5 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Recent bookings</div>
          {recent.map((b) => (
            <BookingRow key={b.id} b={b} showPatient={false} tone={bucketOf(b) === "upcoming" ? "primary" : "muted"} />
          ))}
        </div>
      )}
    </Card>
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