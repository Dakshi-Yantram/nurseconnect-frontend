import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/earnings")({
  component: WorkerEarnings,
  head: () => ({ meta: [{ title: "Earnings — NurseConnect" }] }),
});

type Payout = {
  id: string;
  booking_id: string;
  gross_amount: number;
  tds_deducted: number;
  net_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};
type Earnings = { total_paid: number; total_pending: number; payouts: Payout[] };

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

function WorkerEarnings() {
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/workers/me/earnings")
      .then(setData)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <h1 className="text-[18px] font-bold text-foreground">Earnings</h1>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 size={14} />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Paid out</p>
            </div>
            <p className="text-[26px] font-bold text-emerald-700 mt-0.5">{inr(data?.total_paid ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock size={14} />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Pending</p>
            </div>
            <p className="text-[26px] font-bold text-amber-700 mt-0.5">{inr(data?.total_pending ?? 0)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <IndianRupee size={15} className="text-primary" />
            <span className="text-[14px] font-bold text-foreground">Payout History</span>
          </div>
          {(!data?.payouts || data.payouts.length === 0) ? (
            <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
              No payouts yet. Completed visits will appear here.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.payouts.map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{inr(p.net_amount)}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      Gross {inr(p.gross_amount)} · TDS {inr(p.tds_deducted)} ·{" "}
                      {new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase",
                    p.status === "paid" ? "bg-emerald-100 text-emerald-700"
                      : p.status === "failed" ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  )}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
