import { useSyncExternalStore } from "react";
import { CLINICAL_CASES } from "@/lib/mock-data";
import { makeActivity, nowStamp, type ActivityEntry, type ActivityTone } from "@/lib/workflow-state";

export type Severity = "low" | "medium" | "high" | "critical";
export type CaseStatus = "active" | "resolved";

export type Escalation = {
  ts: string;
  reason: string;
  severity: Severity;
  reviewer: string;
  notes: string;
  actor: string;
};

export type CommLog = { ts: string; channel: string; recipient: string; notes: string; actor: string };

export type ClinicalCase = (typeof CLINICAL_CASES)[number] & {
  severity: Severity;
  status: CaseStatus;
  reviewer: string;
  reason: string;
  notes: string;
  escalations: Escalation[];
  doctorLog: CommLog[];
  familyLog: CommLog[];
  medications: { name: string; dose: string; freq: string }[];
  linkedIncidents: { id: string; title: string }[];
  vitalsHistory: { time: string; bp: string; hr: number; spo2: number; temp: number }[];
  resolution?: { ts: string; finalVitals: string; notes: string; actor: string };
  timeline: ActivityEntry[];
  doctorContact: { name: string; role: string; phone: string };
  ambulanceContact: { provider: string; phone: string };
  familyContact: { name: string; relationship: string; phone: string };
};

const SAMPLE_MEDS = [
  { name: "Metoprolol", dose: "25 mg", freq: "BID" },
  { name: "Atorvastatin", dose: "10 mg", freq: "OD" },
  { name: "Aspirin", dose: "75 mg", freq: "OD" },
];

let cases: ClinicalCase[] = CLINICAL_CASES.map((c, i) => ({
  ...c,
  severity: c.severity as Severity,
  status: "active",
  reviewer: i % 2 ? "clinical-lead@nurseconnect.in" : "ops@nurseconnect.in",
  reason: c.severity === "critical" ? "Vital threshold breached" : "Abnormal vitals trend",
  notes: `Initial alert auto-raised for ${c.issue.toLowerCase()}. Pending clinical review.`,
  escalations: [],
  doctorLog: [],
  familyLog: [],
  medications: SAMPLE_MEDS,
  linkedIncidents: i === 0 ? [{ id: "INC-2847", title: "Late arrival – patient distress" }] : [],
  vitalsHistory: [
    { time: "1:30 PM", bp: c.vitals.bp, hr: c.vitals.hr, spo2: c.vitals.spo2, temp: c.vitals.temp },
    { time: "1:00 PM", bp: "162/96", hr: 118, spo2: 92, temp: 99.0 },
    { time: "12:30 PM", bp: "150/92", hr: 110, spo2: 94, temp: 98.8 },
    { time: "12:00 PM", bp: "138/86", hr: 96, spo2: 96, temp: 98.6 },
  ],
  timeline: [
    { ts: c.raised, title: "Vital threshold breached", actor: "system", type: "alert", tone: "danger", meta: c.issue },
    { ts: "2m later", title: "Case escalated to clinical desk", actor: "Clinical Desk", type: "escalation", tone: "warning" },
  ],
  doctorContact: { name: "Dr. Ashok Verma", role: "Family Physician", phone: "+91 98200 12345" },
  ambulanceContact: { provider: "MediCab Emergency", phone: "108" },
  familyContact: { name: "Rohit Joshi", relationship: "Son (Primary)", phone: "+91 98765 43210" },
}));

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => cases;
const emit = () => listeners.forEach(l => l());

export function useClinicalCases() { return useSyncExternalStore(subscribe, snapshot, snapshot); }
export function useClinicalCase(id: string | undefined) {
  const all = useClinicalCases();
  return all.find(c => c.id === id) ?? null;
}

function patchCase(id: string, patch: Partial<ClinicalCase>, activity?: ActivityEntry) {
  cases = cases.map(c => c.id === id
    ? { ...c, ...patch, timeline: activity ? [activity, ...c.timeline] : c.timeline }
    : c);
  emit();
}

export function recordEscalation(id: string, e: Omit<Escalation, "ts" | "actor"> & { actor?: string }) {
  const c = cases.find(x => x.id === id); if (!c) return;
  const esc: Escalation = { ts: nowStamp(), actor: e.actor ?? "clinical-desk@nurseconnect.in", reason: e.reason, severity: e.severity, reviewer: e.reviewer, notes: e.notes };
  const tone: ActivityTone = e.severity === "critical" ? "danger" : e.severity === "high" ? "warning" : "primary";
  const activity = makeActivity("escalation", `Escalated · ${e.reason}`, e.notes, esc.actor, tone);
  patchCase(id, { escalations: [esc, ...c.escalations], severity: e.severity, reviewer: e.reviewer, reason: e.reason, notes: e.notes }, activity);
}

export function recordDoctorCall(id: string, log: Omit<CommLog, "ts" | "actor"> & { actor?: string }) {
  const c = cases.find(x => x.id === id); if (!c) return;
  const entry: CommLog = { ts: nowStamp(), actor: log.actor ?? "clinical-desk@nurseconnect.in", channel: log.channel, recipient: log.recipient, notes: log.notes };
  patchCase(id, { doctorLog: [entry, ...c.doctorLog] }, makeActivity("doctor_contacted", `Doctor contacted · ${log.recipient}`, log.notes, entry.actor, "primary"));
}

export function recordFamilyNotification(id: string, log: Omit<CommLog, "ts" | "actor"> & { actor?: string }) {
  const c = cases.find(x => x.id === id); if (!c) return;
  const entry: CommLog = { ts: nowStamp(), actor: log.actor ?? "clinical-desk@nurseconnect.in", channel: log.channel, recipient: log.recipient, notes: log.notes };
  patchCase(id, { familyLog: [entry, ...c.familyLog] }, makeActivity("family_notified", `Family notified · ${log.recipient}`, log.notes, entry.actor, "primary"));
}

export function recordAmbulanceDispatch(id: string, actor = "clinical-desk@nurseconnect.in") {
  const c = cases.find(x => x.id === id); if (!c) return;
  const notes = `Ambulance dispatch initiated via ${c.ambulanceContact.provider} (${c.ambulanceContact.phone}).`;
  patchCase(id, {}, makeActivity("ambulance_dispatched", "Ambulance dispatched", notes, actor, "danger"));
}

export function resolveCase(id: string, finalVitals: string, notes: string, actor = "clinical-desk@nurseconnect.in") {
  patchCase(id, { status: "resolved", resolution: { ts: nowStamp(), finalVitals, notes, actor } }, makeActivity("resolution_completed", "Clinical case resolved", notes, actor, "success"));
}