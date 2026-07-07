import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { Modal } from "@/components/shared/Modal";
import { Timeline } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { APPLICATIONS } from "@/lib/mock-data";
import { ChevronRight, RotateCcw, MessageSquarePlus, FileText, Download, Eye } from "lucide-react";
import { toast } from "sonner";

const STAGES = ["Application Received","Document Review","Reference Check","Background Verification","Clinical Verification","Insurance Eligibility","Approval Decision","Activation"];

export const Route = createFileRoute("/_app/onboarding-review/$applicationId")({ component: OnboardingDetail });

function OnboardingDetail() {
  const { applicationId } = useParams({ from: "/_app/onboarding-review/$applicationId" });
  const nav = useNavigate();
  const a = APPLICATIONS.find(x => x.id === applicationId) ?? APPLICATIONS[0];
  const stageIdx = Math.min(STAGES.length - 1, Math.floor((a.progress / 100) * STAGES.length));

  const [moveStage, setMoveStage] = useState(false);
  const [reject, setReject] = useState(false);
  const [reopen, setReopen] = useState(false);
  const [comment, setComment] = useState(false);

  return (
    <DetailShell
      backTo="/onboarding-review" backLabel="Back to Onboarding"
      eyebrow={`Application · ${a.id}`} title={a.name}
      status={a.status}
      subtitle={<>{a.specialty} · {a.experience} yrs · {a.city} · Submitted {a.submitted}</>}
      actions={<>
        <ActionBtn onClick={() => setComment(true)}><MessageSquarePlus className="h-4 w-4" /> Comment</ActionBtn>
        <ActionBtn onClick={() => setReopen(true)}><RotateCcw className="h-4 w-4" /> Re-open Stage</ActionBtn>
        <ActionBtn tone="danger" onClick={() => setReject(true)}>Reject</ActionBtn>
        <ActionBtn tone="primary" onClick={() => setMoveStage(true)}>Move to Next Stage <ChevronRight className="h-4 w-4" /></ActionBtn>
      </>}
    >
      <Card title="Stage Progression">
        <ol className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {STAGES.map((s, i) => {
            const done = i < stageIdx, current = i === stageIdx;
            return (
              <li key={s} className="text-center">
                <div className={`mx-auto h-9 w-9 rounded-full grid place-items-center text-[12px] font-semibold ${done || current ? "bg-primary text-white" : "bg-secondary text-muted-foreground"} ${current ? "ring-2 ring-primary/30" : ""}`}>{i + 1}</div>
                <div className="text-[10.5px] mt-1 leading-tight">{s}</div>
                <div className="text-[10px] text-muted-foreground">{done ? "✓ Done" : current ? "Active" : "Pending"}</div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Stage Checklist">
          <ul className="space-y-2 text-[12.5px]">
            {["Identity proof verified","Educational credentials confirmed","Past employer reference received","Police clearance attached","Clinical skills assessment scheduled"].map((c, i) => (
              <li key={c} className="flex items-center justify-between p-2.5 rounded border border-border">
                <label className="inline-flex items-center gap-2"><input type="checkbox" defaultChecked={i < 3} /> {c}</label>
                <StatusChip tone={i < 3 ? "success" : "warning"} label={i < 3 ? "Done" : "Pending"} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Document Center">
          <ul className="space-y-2 text-[12.5px]">
            {[
              { name: "Resume.pdf", status: "verified" },
              { name: "Nursing_License.pdf", status: "verified" },
              { name: "Degree.pdf", status: "verified" },
              { name: "Aadhaar.pdf", status: "in_progress" },
              { name: "Reference_Letter.pdf", status: "pending" },
            ].map(d => (
              <li key={d.name} className="flex items-center justify-between p-2.5 rounded border border-border">
                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.name}</span>
                <div className="flex items-center gap-3">
                  <StatusChip tone={statusToneFor(d.status)} label={d.status.replace("_"," ")} />
                  <button onClick={() => toast.message("Document opened")} className="text-primary inline-flex items-center gap-1 text-[11.5px]"><Eye className="h-3 w-3" /> View</button>
                  <button onClick={() => toast.success("Downloaded")} className="text-primary inline-flex items-center gap-1 text-[11.5px]"><Download className="h-3 w-3" /></button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Activity Log">
        <Timeline items={[
          { ts: "2026-05-07 11:20", title: "Reference verified — Rainbow Hospital", meta: "Reviewer: bg-ops", tone: "success" },
          { ts: "2026-05-06 16:00", title: "License confirmed by KAR Council", tone: "primary" },
          { ts: "2026-05-05 09:40", title: "Documents uploaded", meta: "Applicant", tone: "muted" },
          { ts: a.submitted, title: "Application received", tone: "muted" },
        ]} />
      </Card>

      <Modal open={moveStage} onClose={() => setMoveStage(false)} title="Move to Next Stage"
        footer={<><button onClick={() => setMoveStage(false)} className="px-4 py-2 text-[13px] rounded-md border border-border">Cancel</button><button onClick={() => { setMoveStage(false); toast.success(`Advanced to ${STAGES[Math.min(stageIdx + 1, STAGES.length - 1)]}`); }} className="px-4 py-2 text-[13px] rounded-md bg-primary text-white">Confirm Transition →</button></>}>
        <p className="text-[13px]">Move from <b>{STAGES[stageIdx]}</b> to <b>{STAGES[Math.min(stageIdx + 1, STAGES.length - 1)]}</b>.</p>
      </Modal>

      <Modal open={reject} onClose={() => setReject(false)} title="Reject Application"
        footer={<><button onClick={() => setReject(false)} className="px-4 py-2 text-[13px] rounded-md border border-border">Cancel</button><button onClick={() => { setReject(false); toast.error("Application rejected"); nav({ to: "/onboarding-review" }); }} className="px-4 py-2 text-[13px] rounded-md bg-rose-600 text-white">Confirm Rejection</button></>}>
        <textarea className="w-full px-3 py-2 text-[13px] rounded-md border border-border min-h-[100px]" placeholder="Reason…" />
      </Modal>

      <Modal open={reopen} onClose={() => setReopen(false)} title="Re-open Stage"
        footer={<><button onClick={() => setReopen(false)} className="px-4 py-2 text-[13px] rounded-md border border-border">Cancel</button><button onClick={() => { setReopen(false); toast.message("Stage re-opened"); }} className="px-4 py-2 text-[13px] rounded-md bg-amber-600 text-white">Re-open</button></>}>
        <textarea className="w-full px-3 py-2 text-[13px] rounded-md border border-border min-h-[100px]" placeholder="Reason for re-opening…" />
      </Modal>

      <Modal open={comment} onClose={() => setComment(false)} title="Internal Comment"
        footer={<><button onClick={() => setComment(false)} className="px-4 py-2 text-[13px] rounded-md border border-border">Cancel</button><button onClick={() => { setComment(false); toast.success("Comment posted"); }} className="px-4 py-2 text-[13px] rounded-md bg-primary text-white">Post</button></>}>
        <textarea className="w-full px-3 py-2 text-[13px] rounded-md border border-border min-h-[120px]" placeholder="Internal note…" />
      </Modal>
    </DetailShell>
  );
}
