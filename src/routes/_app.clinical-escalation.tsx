import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { EmergencyAlert } from "@/components/shared/EmergencyAlert";
import { Timeline } from "@/components/shared/Timeline";
import { Phone, Bell, CheckCircle2, AlertOctagon, AlertTriangle, Ambulance } from "lucide-react";
import { toast } from "sonner";
import { useClinicalCases, recordDoctorCall, recordFamilyNotification, recordAmbulanceDispatch, resolveCase, recordEscalation, type ClinicalCase, type Severity } from "@/lib/clinical-state";

export const Route = createFileRoute("/_app/clinical-escalation")({ component: ClinicalEscalationPage });
type ModalType = "doctor" | "family" | "ambulance" | "resolve" | "escalate" | null;

function ClinicalEscalationPage() {
  const childMatches = useChildMatches();
  const cases = useClinicalCases();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cases.find(c => c.id === selectedId) ?? null;
  const [modal, setModal] = useState<ModalType>(null);
  const [notes, setNotes] = useState("");
  const [finalVitals, setFinalVitals] = useState("");
  const [escReason, setEscReason] = useState("");
  const [escSeverity, setEscSeverity] = useState<Severity>("high");
  const [escReviewer, setEscReviewer] = useState("");
  const sevTone = (s: string) => s === "critical" ? "danger" : s === "high" ? "warning" : "info";
  const open = (c: ClinicalCase, m: ModalType) => {
    setSelectedId(c.id); setModal(m); setNotes(""); setFinalVitals("");
    setEscReason(""); setEscReviewer(""); setEscSeverity(c.severity);
  };
  const close = () => setModal(null);

  const confirmDoctor = () => { if (!selected) return; recordDoctorCall(selected.id, { channel: "Phone", recipient: selected.doctorContact.name, notes: `Emergency call placed to ${selected.doctorContact.name} (${selected.doctorContact.phone}) — severity ${selected.severity.toUpperCase()}.` }); close(); toast.success(`Calling ${selected.doctorContact.name}…`); };
  const confirmFamily = () => { if (!selected) return; recordFamilyNotification(selected.id, { channel: "Emergency Alert", recipient: selected.familyContact.name, notes: `Emergency alert sent to ${selected.familyContact.name} (${selected.familyContact.relationship}) regarding ${selected.issue}.` }); close(); toast.success(`Family notified — ${selected.familyContact.name}`); };
  const confirmAmbulance = () => { if (!selected) return; recordAmbulanceDispatch(selected.id); close(); toast.success(`Ambulance dispatched via ${selected.ambulanceContact.provider}`); };
  const submitResolve = () => { if (!selected) return; resolveCase(selected.id, finalVitals, notes); close(); toast.success("Clinical case resolved"); };
  const submitEscalate = () => { if (!selected) return; recordEscalation(selected.id, { reason: escReason, severity: escSeverity, reviewer: escReviewer, notes }); close(); toast.warning("Escalation recorded and case updated"); };

  if (childMatches.length > 0) return <Outlet />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[{ label: "Critical Alerts", value: cases.filter(c => c.severity === "critical" && c.status === "active").length, tone: "danger" },{ label: "Watch Cases", value: cases.filter(c => c.status === "active").length, tone: "warning" },{ label: "Resolved Today", value: cases.filter(c => c.status === "resolved").length + 11, tone: "success" },{ label: "Avg. Response", value: "2.4 min", tone: "info" }].map(k => <div key={k.label} className="nc-card p-5"><div className="text-[12px] text-muted-foreground">{k.label}</div><div className="mt-1 text-[24px] font-semibold">{k.value}</div><StatusChip tone={k.tone as any} label="last 24h" className="mt-2" /></div>)}</div>
      <Card title="Active Clinical Cases"><ul className="divide-y divide-border -my-2">{cases.map(c => <li key={c.id} className="py-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div className="flex items-start gap-3 flex-1 min-w-0"><div className={`h-10 w-10 rounded-md grid place-items-center ${c.severity === "critical" ? "bg-rose-50 text-rose-600" : c.severity === "high" ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600"}`}><AlertOctagon className="h-5 w-5" /></div><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-mono text-[12px] text-muted-foreground">#{c.id}</span><StatusChip tone={sevTone(c.severity)} label={c.severity.toUpperCase()} dot />{c.status === "resolved" && <StatusChip tone="success" label="Resolved" />}{c.escalations.length > 0 && <StatusChip tone="warning" label={`Escalated ×${c.escalations.length}`} />}</div><div className="text-[14px] font-semibold mt-0.5">{c.issue}</div><div className="text-[12px] text-muted-foreground">{c.patient} · Nurse {c.nurse} · raised {c.raised} · Reviewer {c.reviewer}</div>{c.escalations[0] && <div className="text-[11.5px] text-amber-700 mt-1">Latest escalation: {c.escalations[0].reason} — {c.escalations[0].notes.slice(0, 80)}</div>}<div className="mt-2 flex flex-wrap gap-2 text-[11px]"><span className="px-2 py-0.5 rounded bg-secondary">BP {c.vitals.bp}</span><span className="px-2 py-0.5 rounded bg-secondary">HR {c.vitals.hr}</span><span className="px-2 py-0.5 rounded bg-secondary">Temp {c.vitals.temp}°F</span><span className="px-2 py-0.5 rounded bg-secondary">SpO₂ {c.vitals.spo2}%</span></div></div></div><div className="flex flex-wrap items-center gap-2"><Link to="/clinical-escalation/$caseId" params={{ caseId: c.id }} preload="intent" className="px-3 py-1.5 text-[12px] rounded-md border border-border hover:bg-secondary">View Full Case</Link><button onClick={() => open(c, "doctor")} className="px-3 py-1.5 text-[12px] rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Call Doctor</button><button onClick={() => open(c, "ambulance")} className="px-3 py-1.5 text-[12px] rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5"><Ambulance className="h-3.5 w-3.5" /> Call Ambulance</button><button onClick={() => open(c, "family")} className="px-3 py-1.5 text-[12px] rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Notify Family</button><button onClick={() => open(c, "escalate")} className="px-3 py-1.5 text-[12px] rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50 inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Escalate</button>{c.status !== "resolved" && <button onClick={() => open(c, "resolve")} className="px-3 py-1.5 text-[12px] rounded-md bg-emerald-600 text-white inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved</button>}</div></li>)}</ul></Card>
      {selected && <Card title={`Escalation Timeline · ${selected.id}`}><Timeline items={selected.timeline} /></Card>}

      <EmergencyAlert open={modal === "doctor" && !!selected} onClose={close} eyebrow="Emergency action" title="Call assigned doctor immediately?" icon={<Phone className="h-5 w-5" />} tone="danger" confirmLabel="Call Doctor Immediately" onConfirm={confirmDoctor}>
        {selected && <div className="space-y-1.5"><div className="flex justify-between"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{selected.doctorContact.name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Role</span><span>{selected.doctorContact.role}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-mono">{selected.doctorContact.phone}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Severity</span><StatusChip tone={sevTone(selected.severity)} label={selected.severity.toUpperCase()} dot /></div><div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span>{selected.patient}</span></div></div>}
      </EmergencyAlert>

      <EmergencyAlert open={modal === "ambulance" && !!selected} onClose={close} eyebrow="Emergency action" title="Dispatch ambulance immediately?" icon={<Ambulance className="h-5 w-5" />} tone="danger" confirmLabel="Call Ambulance Immediately" onConfirm={confirmAmbulance}>
        {selected && <div className="space-y-1.5"><div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="font-medium">{selected.ambulanceContact.provider}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-mono">{selected.ambulanceContact.phone}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span>{selected.patient}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Severity</span><StatusChip tone={sevTone(selected.severity)} label={selected.severity.toUpperCase()} dot /></div></div>}
      </EmergencyAlert>

      <EmergencyAlert open={modal === "family" && !!selected} onClose={close} eyebrow="Emergency alert" title="Notify primary family contact?" icon={<Bell className="h-5 w-5" />} tone="warning" confirmLabel="Notify Family" onConfirm={confirmFamily}>
        {selected && <div className="space-y-1.5"><div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-medium">{selected.familyContact.name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Relationship</span><span>{selected.familyContact.relationship}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-mono">{selected.familyContact.phone}</span></div><div className="pt-1 text-muted-foreground">Summary: {selected.issue} · severity {selected.severity.toUpperCase()}.</div></div>}
      </EmergencyAlert>

      <WorkflowModal open={modal === "escalate"} onClose={close} title="Escalate Clinical Case" submitLabel="Submit Escalation" submitTone="warning" onSubmit={submitEscalate} disabled={!escReason || !escReviewer || notes.trim().length < 8}>
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
    </div>
  );
}