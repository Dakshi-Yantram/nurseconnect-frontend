import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { apiFetch } from "@/lib/api";
import { ArrowLeft, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_app/complaints")({ component: ComplaintsPage });

// Mirrors app/api/v1/admin.py: GET /complaints. Each row now carries the
// linked booking (patient, nurse, service) so the queue itself shows who a
// complaint is about, not just who filed it.
interface ComplaintRow {
  id: string;
  subject: string;
  category: string;
  status: string;
  raisedBy: string;
  created: string;
  booking: {
    booking_ref: string | null;
    service_name: string | null;
    patient_name: string | null;
    nurse_name: string | null;
  } | null;
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ComplaintsPage() {
  const nav = useNavigate();
  const router = useRouter();
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch("/api/admin/complaints")
      .then((data: ComplaintRow[]) => setRows(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load complaints"))
      .finally(() => setLoading(false));
  }, []);

  const isOpen = (status: string) => !status.startsWith("resolved") && status !== "closed";

  const filtered = rows.filter((r) => {
    const matchesQuery =
      !query ||
      r.subject.toLowerCase().includes(query.toLowerCase()) ||
      (r.booking?.patient_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (r.booking?.nurse_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (r.booking?.booking_ref ?? "").toLowerCase().includes(query.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "open" ? isOpen(r.status) : r.status === statusFilter);
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h2 className="text-[18px] font-semibold leading-tight">Complaints</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Each complaint is shown with the patient, nurse and booking it relates to, so it can be
          answered without having to look those up separately.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-9 pl-8 pr-3 text-[13px] rounded-md border border-border bg-background"
            placeholder="Search patient, nurse, booking ref..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {(["open", "all", "submitted", "acknowledged", "investigating", "resolved_action_taken", "resolved_no_action", "closed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`h-9 px-3 text-[12.5px] rounded-md border capitalize ${statusFilter === f ? "bg-blue-50 border-blue-200 text-blue-700" : "border-border text-muted-foreground"}`}
          >
            {formatStatus(f)}
          </button>
        ))}
      </div>

      {error && <div className="nc-card p-4 text-[13px] text-rose-600">{error}</div>}

      <Card title="Complaint Queue" padded={false}>
        {loading ? (
          <div className="px-5 py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">No complaints match this filter.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-left">
                <th className="px-5 py-2.5 font-medium">Subject</th>
                <th className="px-5 py-2.5 font-medium">Patient</th>
                <th className="px-5 py-2.5 font-medium">Nurse</th>
                <th className="px-5 py-2.5 font-medium">Booking</th>
                <th className="px-5 py-2.5 font-medium">Category</th>
                <th className="px-5 py-2.5 font-medium">Raised By</th>
                <th className="px-5 py-2.5 font-medium">Created</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium max-w-[220px] truncate">{r.subject}</td>
                  <td className="px-5 py-3">{r.booking?.patient_name ?? "—"}</td>
                  <td className="px-5 py-3">{r.booking?.nurse_name ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-[12px]">{r.booking?.booking_ref ?? "—"}</td>
                  <td className="px-5 py-3"><StatusChip tone="info" label={r.category} /></td>
                  <td className="px-5 py-3">{r.raisedBy}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(r.created)}</td>
                  <td className="px-5 py-3"><StatusChip tone={statusToneFor(r.status)} label={formatStatus(r.status)} dot /></td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => nav({ to: "/complaints/$complaintId", params: { complaintId: r.id } })}
                      className="text-[12px] text-primary"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
