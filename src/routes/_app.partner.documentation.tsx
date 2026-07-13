import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, FileText, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/documentation")({
  component: WorkerDocumentation,
  head: () => ({ meta: [{ title: "Documents — NurseConnect" }] }),
});

const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  nursing_license: "Nursing Registration / License",
  degree_certificate: "Education Certificate",
  police_verification: "Police Verification",
};
const REQUIRED = Object.keys(DOC_LABELS);

type Doc = {
  id: string;
  document_type: string;
  verification_status: string; // pending | verified | rejected
  valid_until: string | null;
  created_at: string;
};

function statusPill(status: string) {
  if (status === "verified") return { cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={12} />, label: "Verified" };
  if (status === "rejected") return { cls: "bg-red-100 text-red-700", icon: <XCircle size={12} />, label: "Rejected" };
  return { cls: "bg-amber-100 text-amber-700", icon: <Clock size={12} />, label: "Pending review" };
}

function WorkerDocumentation() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiFetch("/api/workers/me/documents");
      setDocs(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload(type: string, file: File) {
    setError(null);
    setBusy(type);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
      });
      await apiFetch("/api/workers/me/documents/upload", {
        method: "POST",
        body: JSON.stringify({ document_type: type, data_base64: dataUrl.split(",")[1] ?? "" }),
      });
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const byType = new Map(docs.map((d) => [d.document_type, d]));

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <div>
          <h1 className="text-[18px] font-bold text-foreground">My Documents</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            These are the documents a reviewer checks to verify your account. Re-upload any that were rejected.
          </p>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</div>}

        <div className="space-y-3">
          {REQUIRED.map((type) => {
            const doc = byType.get(type);
            const pill = doc ? statusPill(doc.verification_status) : null;
            const canReplace = !doc || doc.verification_status === "rejected";
            return (
              <div key={type} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-foreground">{DOC_LABELS[type]}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {doc ? `Uploaded ${new Date(doc.created_at).toLocaleDateString("en-IN")}` : "Not uploaded"}
                  </p>
                </div>
                {pill && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold", pill.cls)}>
                    {pill.icon} {pill.label}
                  </span>
                )}
                {canReplace && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90">
                    {busy === type ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {doc ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={busy !== null}
                      onChange={(e) => e.target.files?.[0] && upload(type, e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
