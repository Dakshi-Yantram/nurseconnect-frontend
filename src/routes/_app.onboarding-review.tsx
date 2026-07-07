import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { Timeline } from "@/components/shared/Timeline";
import { ONBOARDING_STAGES, makeActivity, seedApplications, stageProgress, stageStatus, type WorkflowApplication } from "@/lib/workflow-state";
import { ChevronRight, Download, Eye, FileText, Clock, UserCheck, RotateCcw, MessageSquarePlus, FilePlus2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/onboarding-review")({ component: OnboardingPage });

type ModalType = "docs" | "profile" | "report" | "move" | "reject" | "reopen" | "comment" | "request-docs" | "escalate" | null;
const DOCS = [
  { name: "Resume_AnjaliVerma.pdf", size: "0.4 MB", status: "verified", reviewer: "ops@nurseconnect.in", ts: "07 May 09:30" },
  { name: "NursingLicense_KAR.pdf", size: "0.7 MB", status: "verified", reviewer: "compliance@nurseconnect.in", ts: "07 May 10:10" },
  { name: "BSc_Nursing_Degree.pdf", size: "1.1 MB", status: "verified", reviewer: "ops@nurseconnect.in", ts: "07 May 10:35" },
  { name: "AadhaarCard.pdf", size: "0.3 MB", status: "in_progress", reviewer: "bg-ops@nurseconnect.in", ts: "Pending" },
  { name: "ReferenceLetter_RainbowHospital.pdf", size: "0.5 MB", status: "pending", reviewer: "Unassigned", ts: "Pending" },
];

function OnboardingPage() {
  const nav = useNavigate();
  const [apps, setApps] = useState<WorkflowApplication[]>(() => seedApplications());
  const [selectedId, setSelectedId] = useState(apps[0].id);
  const selected = apps.find(a => a.id === selectedId) ?? apps[0];
  const [modal, setModal] = useState<ModalType>(null);
  const [comment, setComment] = useState("");
  const [requestInstructions, setRequestInstructions] = useState("");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [transitionNote, setTransitionNote] = useState(`Hi ${selected.name},\n\nWe are pleased to inform you that your application has progressed to the next stage.`);
  const [reportReason, setReportReason] = useState("");

  const stageIdx = Math.max(0, ONBOARDING_STAGES.indexOf(selected.stage as any));
  const nextStage = ONBOARDING_STAGES[Math.min(stageIdx + 1, ONBOARDING_STAGES.length - 3)];
  const updateSelected = (patch: Partial<WorkflowApplication>, activity: ReturnType<typeof makeActivity>) => setApps(prev => prev.map(a => a.id === selected.id ? { ...a, ...patch, history: [activity, ...a.history] } : a));
  const close = () => setModal(null);

  const handleComment = () => { updateSelected({}, makeActivity("note_added", "Internal reviewer comment added", comment, selected.reviewer, "primary")); setComment(""); close(); toast.success("Comment saved to activity log"); };
  const handleRequestDocs = () => { const stage = "Documents Pending"; updateSelected({ stage, progress: stageProgress(stage), status: stageStatus(stage), awaitingDocuments: true }, makeActivity("document_requested", "Document request sent", requestInstructions, selected.reviewer, "warning")); setRequestInstructions(""); close(); toast.success("Document request sent after review"); };
  const handleEscalate = () => { updateSelected({ stage: "Escalated", progress: 92, escalated: true }, makeActivity("escalation_triggered", "Application escalated", escalationNotes, selected.reviewer, "danger")); setEscalationNotes(""); close(); toast.warning("Application escalated with audit entry"); };
  const handleMove = () => { const stage = nextStage; updateSelected({ stage, progress: stageProgress(stage), status: stageStatus(stage), awaitingDocuments: false }, makeActivity("stage_changed", `Stage changed to ${stage}`, transitionNote, selected.reviewer, "success")); close(); toast.success(`Advanced to ${stage}`); };
  const handleReject = () => { updateSelected({ stage: "Rejected", progress: 100, status: "Rejected" }, makeActivity("rejection_completed", "Application rejected", rejectNotes, selected.reviewer, "danger")); setRejectNotes(""); close(); toast.error("Application rejected with reviewer notes"); };
  const handleReopen = () => { const stage = ONBOARDING_STAGES[Math.max(0, stageIdx - 1)]; updateSelected({ stage, progress: stageProgress(stage), status: stageStatus(stage) }, makeActivity("stage_reopened", `Re-opened ${stage}`, reopenReason, selected.reviewer, "warning")); setReopenReason(""); close(); toast.success("Stage re-opened and SLA reset"); };
  const handleReport = () => { updateSelected({}, makeActivity("report_exported", "Onboarding report generated", reportReason || "Reviewer exported audit-ready report", selected.reviewer, "muted")); setReportReason(""); close(); toast.success("Report generated with audit entry"); };

  return (
    <div className="grid grid-cols-12 gap-6">
      <Card title="Applications in Pipeline" className="col-span-12 lg:col-span-5" padded={false}>
        <ul className="divide-y divide-border max-h-[640px] overflow-y-auto nc-scroll">
          {apps.map(a => (
            <li key={a.id} onClick={() => setSelectedId(a.id)} className={`p-4 cursor-pointer ${selected.id === a.id ? "bg-blue-50/60 border-l-2 border-l-primary" : "hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between"><div className="font-medium text-[13px]">{a.name}</div><span className="text-[11px] text-amber-600 inline-flex items-center gap-1"><Clock className="h-3 w-3" /> SLA 2d 4h</span></div>
              <div className="text-[11px] text-muted-foreground">{a.id} · Submitted {a.submitted}</div>
              <div className="mt-2 flex items-center gap-1">{ONBOARDING_STAGES.slice(0, 10).map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= Math.min(stageIdx, 9) ? "bg-primary" : "bg-secondary"}`} />)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground flex justify-between"><span>Stage: {a.stage}</span><StatusChip tone={a.escalated ? "danger" : statusToneFor(a.status)} label={a.escalated ? "Escalated" : a.status} /></div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="col-span-12 lg:col-span-7 space-y-6">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div><div className="text-[16px] font-semibold">{selected.name}</div><div className="text-[12px] text-muted-foreground">{selected.id} · {selected.specialty} · {selected.experience} yrs</div><div className="mt-2 flex items-center gap-3 text-[12px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Reviewer: <b className="text-foreground">{selected.reviewer}</b></span><span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> SLA Remaining: <b className="text-amber-700">2d 4h</b></span></div></div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button onClick={() => setModal("comment")} className="px-3 py-2 text-[12.5px] rounded-md border border-border inline-flex items-center gap-1.5"><MessageSquarePlus className="h-4 w-4" /> Comment</button>
              <button onClick={() => setModal("request-docs")} className="px-3 py-2 text-[12.5px] rounded-md border border-border inline-flex items-center gap-1.5"><FilePlus2 className="h-4 w-4" /> Request Docs</button>
              <button onClick={() => setModal("escalate")} className="px-3 py-2 text-[12.5px] rounded-md border border-amber-200 text-amber-700 inline-flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4" /> Escalate</button>
              <button onClick={() => setModal("reopen")} className="px-3 py-2 text-[12.5px] rounded-md border border-border inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" /> Re-open Stage</button>
              <button onClick={() => setModal("reject")} className="px-3 py-2 text-[12.5px] rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50">Reject Application</button>
              {selected.stage !== "Activated" && selected.stage !== "Rejected" && <button onClick={() => setModal("move")} className="px-3 py-2 text-[12.5px] rounded-md bg-primary text-white inline-flex items-center gap-1.5">Move to Next Stage <ChevronRight className="h-4 w-4" /></button>}
            </div>
          </div>
        </Card>

        <Card title="Stage Progression">
          {(() => {
            const stageChange = selected.history.find(h => h.type === "stage_changed");
            const priorStage = (typeof stageChange?.title === "string" ? stageChange.title.replace(/^Stage changed to\s*/i, "") : null) ?? ONBOARDING_STAGES[Math.max(0, stageIdx - 1)];
            const decisions = selected.history.filter(h => /stage_changed|stage_reopened|rejection_completed|escalation_triggered/i.test(h.type ?? ""));
            return (
              <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">From</span>
                <span className="font-medium text-foreground/80">{priorStage}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Now</span>
                <span className="font-semibold text-foreground">{selected.stage}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Next</span>
                <span className="font-medium text-foreground/80">{selected.stage === "Activated" || selected.stage === "Rejected" ? "Closed" : nextStage}</span>
                <span className="ml-auto text-[10.5px] text-muted-foreground">
                  {decisions.length} prior decision{decisions.length === 1 ? "" : "s"} · SLA 2d 4h
                </span>
              </div>
            );
          })()}
          <ol className="grid grid-cols-4 lg:grid-cols-6 gap-2">
            {ONBOARDING_STAGES.map((s, i) => { const done = i < stageIdx; const current = i === stageIdx; return <li key={s} className="text-center"><div className={`mx-auto h-9 w-9 rounded-full grid place-items-center text-[12px] font-semibold ${done || current ? "bg-primary text-white" : "bg-secondary text-muted-foreground"} ${current ? "ring-2 ring-primary/30" : ""}`}>{i + 1}</div><div className="text-[10.5px] text-foreground mt-1 leading-tight">{s}</div><div className="text-[10px] text-muted-foreground">{done ? "✓ Done" : current ? "Active" : "Pending"}</div></li>; })}
          </ol>
        </Card>

        <Card title="Stage Checklist">
          <ul className="space-y-2 text-[12.5px]">{["Identity proof verified","Educational credentials confirmed","Past employer reference received","Police clearance attached","Clinical skills assessment scheduled"].map((c, i) => <li key={c} className="flex items-center justify-between p-2.5 rounded border border-border"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={i < Math.max(2, Math.min(stageIdx, 5))} readOnly /> {c}</label><StatusChip tone={i < Math.max(2, Math.min(stageIdx, 5)) ? "success" : "warning"} label={i < Math.max(2, Math.min(stageIdx, 5)) ? "Done" : "Pending"} /></li>)}</ul>
        </Card>

        <Card title="Quick Actions">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3"><button onClick={() => setModal("docs")} className="px-4 py-3 rounded-md border border-border hover:bg-muted/40 text-[13px] text-left"><FileText className="h-4 w-4 mb-1.5 text-primary" /><div className="font-medium">Document Center</div><div className="text-[11px] text-muted-foreground">5 documents</div></button><button onClick={() => nav({ to: "/onboarding-review/$applicationId", params: { applicationId: selected.id } })} className="px-4 py-3 rounded-md border border-border hover:bg-muted/40 text-[13px] text-left"><Eye className="h-4 w-4 mb-1.5 text-primary" /><div className="font-medium">View Full Profile</div><div className="text-[11px] text-muted-foreground">Operational workspace</div></button><button onClick={() => setModal("report")} className="px-4 py-3 rounded-md border border-border hover:bg-muted/40 text-[13px] text-left"><Download className="h-4 w-4 mb-1.5 text-primary" /><div className="font-medium">Generate Report</div><div className="text-[11px] text-muted-foreground">Audit-ready PDF</div></button></div>
        </Card>

        <Card title="Activity Log"><Timeline items={selected.history} /></Card>
      </div>

      <WorkflowModal open={modal === "docs"} onClose={close} title="Document Center" description={`${selected.name} – Application ${selected.id}`} submitLabel="Close Review" onSubmit={close} size="lg">
        <ul className="divide-y divide-border -my-2">{DOCS.map(d => <li key={d.name} className="py-3 flex items-center justify-between"><div className="flex items-center gap-3"><FileText className="h-4 w-4 text-muted-foreground" /><div><div className="text-[13px] font-medium">{d.name}</div><div className="text-[11px] text-muted-foreground">Size: {d.size} · Reviewer {d.reviewer} · {d.ts}</div></div></div><div className="flex items-center gap-3"><StatusChip tone={statusToneFor(d.status)} label={d.status.replace("_", " ")} /><button onClick={() => updateSelected({}, makeActivity("document_previewed", `Previewed ${d.name}`, "Document evidence opened in review center", selected.reviewer, "muted"))} className="text-[12px] text-primary inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> View</button><button onClick={() => updateSelected({}, makeActivity("document_download_requested", `Prepared secure download for ${d.name}`, "Download recorded for audit", selected.reviewer, "muted"))} className="text-[12px] text-primary inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Download</button></div></li>)}</ul>
      </WorkflowModal>

      <WorkflowModal open={modal === "move"} onClose={close} title="Move to Next Stage" description={`${selected.name} – Application ${selected.id}`} submitLabel="Confirm Transition" onSubmit={handleMove} disabled={transitionNote.trim().length < 8}>
        <p className="text-[13px]">Move from <b>{selected.stage}</b> to <b>{nextStage}</b>.</p><div className="mt-3 p-3 rounded-md bg-blue-50 border border-blue-200 text-[12px] text-blue-800">Next stage tasks will be assigned and the applicant timeline will update.</div><textarea value={transitionNote} onChange={e => setTransitionNote(e.target.value)} className={`${textareaCls} mt-3`} />
      </WorkflowModal>
      <WorkflowModal open={modal === "comment"} onClose={close} title="Internal Comment" submitLabel="Post Comment" onSubmit={handleComment} disabled={comment.trim().length < 5}><FormField label="Comment Category"><select className={inputCls}><option>Reviewer note</option><option>Clinical follow-up</option><option>Applicant communication</option></select></FormField><FormField label="Comment"><textarea value={comment} onChange={e => setComment(e.target.value)} className={`${textareaCls} mt-3`} placeholder="Internal note…" /></FormField></WorkflowModal>
      <WorkflowModal open={modal === "request-docs"} onClose={close} title="Request Documents" submitLabel="Send Request" submitTone="warning" onSubmit={handleRequestDocs} disabled={requestInstructions.trim().length < 8}><div className="space-y-3"><FormField label="Missing Documents"><div className="space-y-1.5 text-[13px]">{DOCS.filter(d => d.status !== "verified").map(d => <label key={d.name} className="flex items-center gap-2"><input type="checkbox" defaultChecked /> {d.name}</label>)}</div></FormField><FormField label="Urgency"><select className={inputCls}><option>Standard · 72h</option><option>Urgent · 24h</option></select></FormField><FormField label="Due Date"><input type="date" className={inputCls} /></FormField><FormField label="Instructions"><textarea value={requestInstructions} onChange={e => setRequestInstructions(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "escalate"} onClose={close} title="Escalate Review" submitLabel="Submit Escalation" submitTone="warning" onSubmit={handleEscalate} disabled={escalationNotes.trim().length < 8}><div className="space-y-3"><FormField label="Reason"><select className={inputCls}><option>Background discrepancy</option><option>Clinical qualification concern</option><option>Insurance eligibility mismatch</option></select></FormField><FormField label="Assign To"><select className={inputCls}><option>Clinical Lead</option><option>Compliance Head</option><option>Regional Ops Manager</option></select></FormField><FormField label="Notes"><textarea value={escalationNotes} onChange={e => setEscalationNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "reject"} onClose={close} title="Reject Application" submitLabel="Confirm Rejection" submitTone="danger" onSubmit={handleReject} disabled={rejectNotes.trim().length < 10}><div className="space-y-3"><FormField label="Category"><select className={inputCls}><option>Credential mismatch</option><option>Policy failure</option><option>Clinical standards not met</option></select></FormField><FormField label="Reapply Eligibility"><select className={inputCls}><option>Eligible after 6 months</option><option>Eligible after corrections</option><option>Not eligible</option></select></FormField><FormField label="Reviewer Notes"><textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "reopen"} onClose={close} title="Re-open Stage" submitLabel="Re-open Stage" submitTone="warning" onSubmit={handleReopen} disabled={reopenReason.trim().length < 8}><p className="text-[13px]">Re-open prior stage for additional review. SLA timer will reset.</p><textarea value={reopenReason} onChange={e => setReopenReason(e.target.value)} className={`${textareaCls} mt-3`} placeholder="Reason for re-opening…" /></WorkflowModal>
      <WorkflowModal open={modal === "report"} onClose={close} title="Generate Onboarding Report" submitLabel="Generate Report" onSubmit={handleReport} disabled={reportReason.trim().length < 4}><div className="space-y-3"><FormField label="Report Type"><select className={inputCls}><option>Full onboarding audit</option><option>Document verification summary</option><option>Clinical review summary</option></select></FormField><FormField label="Export Reason"><textarea value={reportReason} onChange={e => setReportReason(e.target.value)} className={textareaCls} placeholder="Why is this report being generated?" /></FormField></div></WorkflowModal>
    </div>
  );
}
