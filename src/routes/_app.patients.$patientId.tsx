import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { ArrowLeft, Phone, MapPin, Heart, Wallet } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/patients/$patientId")({ component: PatientProfile });

interface ApiPatient {
  id: string; full_name: string; age?: number; gender?: string;
  phone_e164?: string; city?: string; care_plan?: string; is_bpl?: boolean;
}

function PatientProfile() {
  const { patientId } = useParams({ from: "/_app/patients/$patientId" });
  const [p, setP] = useState<ApiPatient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/admin/patients/${patientId}`)
      .then(setP)
      .catch(() => toast.error("Failed to load patient"))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="text-[13px] text-muted-foreground">Loading…</div>;
  if (!p) return <div className="text-[13px] text-muted-foreground">Patient not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/users/patients" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Patients
      </Link>

      <Card>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-purple grid place-items-center text-white text-[18px] font-semibold">
            {p.full_name.split(" ").map(w => w[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[18px] font-semibold">{p.full_name}</div>
              {p.is_bpl && <StatusChip tone="purple" label="BPL" dot />}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5">
              {p.id.slice(0, 8)} · {p.age ?? "—"} yrs · {p.gender ?? "—"}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.phone_e164 ?? "—"}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{p.city ?? "—"}</span>
              <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" />{p.care_plan ?? "—"}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}