import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, MapPin, CalendarClock, IndianRupee, CheckCircle2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/partner/assignments")({
  component: WorkerAssignments,
  head: () => ({ meta: [{ title: "Assignments — NurseConnect" }] }),
});

type Request = {
  id: string;
  booking_ref?: string;
  service_name?: string | null;
  patient_name?: string | null;
  scheduled_date: string;
  scheduled_start_time: string;
  total_amount: number | string;
  distance_km?: number | null;
  address_snapshot?: { city?: string; line1?: string } | null;
};

function WorkerAssignments() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/bookings/worker/new-requests");
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function accept(id: string) {
    setError(null);
    setBusy(id);
    try {
      await apiFetch(`/api/bookings/${id}/accept`, { method: "POST" });
      // Won the booking — drop it from the inbox and go to the visit.
      setRows((r) => r.filter((x) => x.id !== id));
      nav({ to: "/partner/visits/$visitId", params: { visitId: id } });
    } catch (e: any) {
      // 409 (already claimed / schedule conflict) etc. — surface + refresh.
      let msg = String(e?.message ?? e);
      try { const j = JSON.parse(msg); msg = j.message ?? j.detail ?? msg; } catch { /* keep */ }
      setError(msg);
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-foreground">New Requests</h1>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              Bookings near you that match your skills and are free in your schedule.
            </p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium hover:bg-muted">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-[13px] text-muted-foreground">
            No new requests right now. Make sure you're online in Availability.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-foreground">{r.service_name ?? "Care service"}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {r.patient_name ? `${r.patient_name} · ` : ""}#{(r.booking_ref ?? r.id).slice(0, 10)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[13px] font-bold text-foreground">
                    <IndianRupee size={13} />{Number(r.total_amount).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock size={13} />
                    {new Date(r.scheduled_date).toLocaleDateString("en-IN")} · {r.scheduled_start_time.slice(0, 5)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} />
                    {r.address_snapshot?.city ?? "Nearby"}
                    {typeof r.distance_km === "number" ? ` · ${r.distance_km} km` : ""}
                  </span>
                </div>

                <button
                  onClick={() => accept(r.id)}
                  disabled={busy !== null}
                  className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  {busy === r.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Accept booking
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
