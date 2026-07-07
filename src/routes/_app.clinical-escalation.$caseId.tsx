import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { EmergencyAlert } from "@/components/shared/EmergencyAlert";
import { Timeline } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { Phone, Bell, CheckCircle2, AlertTriangle, Ambulance } from "lucide-react";
import { toast } from "sonner";
import { useClinicalCase, recordDoctorCall, recordFamilyNotification, recordAmbulanceDispatch, resolveCase, recordEscalation, type Severity } from "@/lib/clinical-state";

export const Route = createFileRoute("/_app/clinical-escalation/$caseId")({ component: EscalationDetail });

type ModalType = "doctor" | "family" | "ambulance" | "escalate" | "resolve" | null;

function EscalationDetail() {
  const { caseId } = useParams({ from: "/_app/clinical-escalation/$caseId" });
  const nav = useNavigate();
  const c = useClinicalCase(caseId);

  const [modal, setModal] = useState<ModalType>(null);
  const [notes, setNotes] = useState("");
  const [finalVitals, setFinalVitals] = useState("");
  const [escReason, setEscReason] = useState("");
  const [escSeverity, setEscSeverity] = useState<Severity>("high");
  const [escReviewer, setEscReviewer] = useState("");

  if (!c) return <div className="p-6 text-[13px] text-muted-foreground">Case not found.</div>;

  const close = () => setModal(null);
  const sevTone = (s: string) => s === "critical" ? "danger" : s === "high" ? "warning" : "info";

  const confirmDoctor = () => { recordDoctorCall(c.id, { channel: "Phone", recipient: c.doctorContact.name, notes: `Emergency call placed to ${c.doctorContact.name} (${c.doctorContact.phone}) — severity ${c.severity.toUpperCase()}.` }); close(); toast.success(`Calling ${c.doctorContact.name}…`); };
  const confirmFamily = () => { recordFamilyNotification(c.id, { channel: "Emergency Alert", recipient: c.familyContact.name, notes: `Emergency alert sent to ${c.familyContact.name} (${c.familyContact.relationship}).` }); close(); toast.success(`Family notified — ${c.familyContact.name}`); };
  const confirmAmbulance = () => { recordAmbulanceDispatch(c.id); close(); toast.success(`Ambulance dispatched via ${c.ambulanceContact.provider}`); };
  const submitEscalate = () => { recordEscalation(c.id, { reason: escReason, severity: escSeverity, reviewer: escReviewer, notes }); setNotes(""); setEscReason(""); setEscReviewer(""); close(); toast.warning("Escalation submitted"); };
  const submitResolve = () => { resolveCase(c.id, finalVitals, notes); setNotes(""); setFinalVitals(""); close(); toast.success("Case resolved"); };

  return (
    <DetailShell
      backTo="/clinical-escalation" backLabel="Back to Clinical Escalation"
      eyebrow={`Clinical Case · #${c.id}`} title={c.issue}
      status={c.status === "resolved" ? "Resolved" : "Active"}
      badges={<><StatusChip tone={sevTone(c.severity)} label={c.severity.toUpperCase()} dot />{c.escalations.length > 0 && <StatusChip tone="warning" label={`Escalated ×${c.escalations.length}`} />}</>}
      subtitle={<>Patient {c.patient} · Nurse {c.nurse} · raised {c.raised} · Reviewer {c.reviewer}</>}
      actions={<>
        <ActionBtn onClick={() => setModal("doctor")}><Phone className="h-4 w-4" /> Call Doctor</ActionBtn>
        <ActionBtn onClick={() => setModal("ambulance")}><Ambulance className="h-4 w-4" /> Call Ambulance</ActionBtn>
        <ActionBtn onClick={() => setModal("family")}><Bell className="h-4 w-4" /> Notify Family</ActionBtn>
        <ActionBtn tone="warning" onClick={() => { setEscSeverity(c.severity); setModal("escalate"); }}><AlertTriangle className="h-4 w-4" /> Escalate Further</ActionBtn>
        {c.status !== "resolved" && <ActionBtn tone="success" onClick={() => setModal("resolve")}><CheckCircle2 className="h-4 w-4" /> Mark Resolved</ActionBtn>}
      </>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Patient Summary">
          <div className="text-[13px] space-y-1.5">
            <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{c.patient}</span></div>
            <div><span className="text-muted-foreground">Assigned Nurse:</span> {c.nurse}</div>
            <div><span className="text-muted-foreground">Reviewer:</span> {c.reviewer}</div>
            <div><span className="text-muted-foreground">Raised:</span> {c.raised}</div>
          </div>
        </Card>
        <Card title="Escalation Summary">
          <div className="text-[13px] space-y-1.5">
            <div className="flex items-center gap-2"><span className="text-muted-foreground">Severity:</span><StatusChip tone={sevTone(c.severity)} label={c.severity.toUpperCase()} dot /></div>
            <div><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{c.reason}</span></div>
            <div><span className="text-muted-foreground">Latest notes:</span> <div className="mt-1 p-2 bg-muted/40 rounded text-[12.5px]">{c.notes}</div></div>
            <div><span className="text-muted-foreground">Total escalations:</span> {c.escalations.length}</div>
          </div>
        </Card>
        <Card title="Current Vitals">
          <div className="grid grid-cols-2 gap-2">
            <Vital label="BP" value={c.vitals.bp} />
            <Vital label="HR" value={`${c.vitals.hr} bpm`} />
            <Vital label="Temp" value={`${c.vitals.temp}°F`} />
            <Vital label="SpO₂" value={`${c.vitals.spo2}%`} />
          </div>
        </Card>
      </div>

      <Card title="Escalation History">
        {c.escalations.length === 0 ? <div className="text-[12.5px] text-muted-foreground">No escalations recorded yet.</div> : (
          <ul className="divide-y divide-border -my-2">
            {c.escalations.map((e, i) => (
              <li key={i} className="py-3 text-[12.5px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusChip tone={sevTone(e.severity)} label={e.severity.toUpperCase()} dot />
                  <span className="font-medium">{e.reason}</span>
                  <span className="text-muted-foreground">· {e.ts}</span>
                </div>
                <div className="text-muted-foreground mt-1">By {e.actor} → reviewer {e.reviewer}</div>
                <div className="mt-1 p-2 bg-muted/40 rounded">{e.notes}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Vitals Timeline (last 4 hours)">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1.5">Time</th><th>BP</th><th>HR</th><th>SpO₂</th><th>Temp</th></tr></thead>
            <tbody>
              {c.vitalsHistory.map((r, i) => (
                <tr key={i} className="border-t border-border"><td className="py-1.5">{r.time}</td><td>{r.bp}</td><td>{r.hr}</td><td>{r.spo2}%</td><td>{r.temp}°F</td></tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Medications">
          <ul className="text-[12.5px] divide-y divide-border -my-1">
            {c.medications.map((m, i) => (
              <li key={i} className="py-2 flex justify-between"><span className="font-medium">{m.name}</span><span className="text-muted-foreground">{m.dose} · {m.freq}</span></li>
            ))}
          </ul>
        </Card>

        <Card title="Doctor Communication Log">
          {c.doctorLog.length === 0 ? <div className="text-[12.5px] text-muted-foreground">No doctor communications yet.</div> : (
            <ul className="divide-y divide-border -my-2">
              {c.doctorLog.map((l, i) => (
                <li key={i} className="py-2 text-[12.5px]"><div className="font-medium">{l.recipient}</div><div className="text-muted-foreground">{l.channel} · {l.ts}</div><div className="mt-1">{l.notes}</div></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Family Notification History">
          {c.familyLog.length === 0 ? <div className="text-[12.5px] text-muted-foreground">No family notifications yet.</div> : (
            <ul className="divide-y divide-border -my-2">
              {c.familyLog.map((l, i) => (
                <li key={i} className="py-2 text-[12.5px]"><div className="font-medium">{l.recipient}</div><div className="text-muted-foreground">{l.channel} · {l.ts}</div><div className="mt-1">{l.notes}</div></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Linked Incidents">
          {c.linkedIncidents.length === 0 ? <div className="text-[12.5px] text-muted-foreground">No linked incidents.</div> : (
            <ul className="text-[12.5px] divide-y divide-border -my-1">
              {c.linkedIncidents.map((i) => (
                <li key={i.id} className="py-2"><button onClick={() => nav({ to: "/incidents/$incidentId", params: { incidentId: i.id } })} className="text-left hover:underline"><span className="font-mono text-[11.5px] text-muted-foreground">{i.id}</span> <span className="font-medium">{i.title}</span></button></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Emergency Contacts">
          <div className="text-[12.5px] space-y-2">
            <div><div className="text-muted-foreground">Assigned Doctor</div><div className="font-medium">{c.doctorContact.name} <span className="text-muted-foreground font-normal">· {c.doctorContact.role}</span></div><div className="font-mono text-[12px]">{c.doctorContact.phone}</div></div>
            <div><div className="text-muted-foreground">Ambulance</div><div className="font-medium">{c.ambulanceContact.provider}</div><div className="font-mono text-[12px]">{c.ambulanceContact.phone}</div></div>
            <div><div className="text-muted-foreground">Family Primary</div><div className="font-medium">{c.familyContact.name} <span className="text-muted-foreground font-normal">· {c.familyContact.relationship}</span></div><div className="font-mono text-[12px]">{c.familyContact.phone}</div></div>
          </div>
        </Card>

        <Card title="Resolution Notes">
          {c.resolution ? (
            <div className="text-[12.5px] space-y-1.5">
              <div className="text-muted-foreground">Resolved {c.resolution.ts} by {c.resolution.actor}</div>
              <div><span className="text-muted-foreground">Final vitals:</span> {c.resolution.finalVitals}</div>
              <div className="p-2 bg-muted/40 rounded">{c.resolution.notes}</div>
            </div>
          ) : <div className="text-[12.5px] text-muted-foreground">Case is still active. Use Mark Resolved to close.</div>}
        </Card>
      </div>

      <Card title="Escalation Activity Timeline">
        <Timeline items={c.timeline} />
      </Card>

      <EmergencyAlert open={modal === "doctor"} onClose={close} eyebrow="Emergency action" title="Call assigned doctor immediately?" icon={<Phone className="h-5 w-5" />} tone="danger" confirmLabel="Call Doctor Immediately" onConfirm={confirmDoctor}>
        <div className="space-y-1.5"><div className="flex justify-between"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{c.doctorContact.name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Role</span><span>{c.doctorContact.role}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-mono">{c.doctorContact.phone}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Severity</span><StatusChip tone={sevTone(c.severity)} label={c.severity.toUpperCase()} dot /></div></div>
      </EmergencyAlert>

      <EmergencyAlert open={modal === "ambulance"} onClose={close} eyebrow="Emergency action" title="Dispatch ambulance immediately?" icon={<Ambulance className="h-5 w-5" />} tone="danger" confirmLabel="Call Ambulance Immediately" onConfirm={confirmAmbulance}>
        <div className="space-y-1.5"><div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="font-medium">{c.ambulanceContact.provider}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-mono">{c.ambulanceContact.phone}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span>{c.patient}</span></div></div>
      </EmergencyAlert>

      <EmergencyAlert open={modal === "family"} onClose={close} eyebrow="Emergency alert" title="Notify primary family contact?" icon={<Bell className="h-5 w-5" />} tone="warning" confirmLabel="Notify Family" onConfirm={confirmFamily}>
        <div className="space-y-1.5"><div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-medium">{c.familyContact.name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Relationship</span><span>{c.familyContact.relationship}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-mono">{c.familyContact.phone}</span></div><div className="pt-1 text-muted-foreground">Summary: {c.issue} · severity {c.severity.toUpperCase()}.</div></div>
      </EmergencyAlert>

      <WorkflowModal open={modal === "escalate"} onClose={close} title="Escalate Further" submitLabel="Submit Escalation" submitTone="warning" onSubmit={submitEscalate} disabled={!escReason || !escReviewer || notes.trim().length < 8}>
        <div className="space-y-3 text-[13px]">
          <FormField label="Escalation Reason"><select value={escReason} onChange={e => setEscReason(e.target.value)} className={inputCls}><option value="">Select reason…</option><option>Vital deterioration</option><option>Medication concern</option><option>Family complaint</option><option>Equipment failure</option><option>Clinical judgement override</option></select></FormField>
          <FormField label="Severity"><select value={escSeverity} onChange={e => setEscSeverity(e.target.value as Severity)} className={inputCls}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></FormField>
          <FormField label="Assign Reviewer"><select value={escReviewer} onChange={e => setEscReviewer(e.target.value)} className={inputCls}><option value="">Select reviewer…</option><option>clinical-lead@nurseconnect.in</option><option>medical-director@nurseconnect.in</option><option>ops-head@nurseconnect.in</option></select></FormField>
          <FormField label="Escalation Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField>
        </div>
      </WorkflowModal>

      <WorkflowModal open={modal === "resolve"} onClose={close} title="Mark Case as Resolved" submitLabel="Confirm Resolution" submitTone="success" onSubmit={submitResolve} disabled={notes.trim().length < 10 || finalVitals.trim().length < 4}>
        <div className="space-y-3 text-[13px]">
          <FormField label="Final Vitals"><input value={finalVitals} onChange={e => setFinalVitals(e.target.value)} className={inputCls} placeholder="BP: 128/82, Pulse: 76, Temp: 98.4°F" /></FormField>
          <FormField label="Resolution Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField>
        </div>
      </WorkflowModal>
    </DetailShell>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return <div className="p-3 rounded-md bg-secondary"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-[15px] font-semibold mt-1">{value}</div></div>;
}
