import { createFileRoute, useNavigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusChip } from "@/components/shared/StatusChip";
import { Star, Eye } from "lucide-react";
import { VISITS, type Visit } from "@/lib/mock-data";
import { getNewVisits } from "@/lib/visit-store";

export const Route = createFileRoute("/_app/visits")({ component: VisitsLayout });

const statusTone = (s: Visit["status"]) => {
    if (s === "Completed") return "success" as const;
    if (s === "Scheduled") return "warning" as const;
    if (s === "In Progress") return "primary" as const;
    return "muted" as const;
};

// Layout component — shows list OR child route (detail page)
function VisitsLayout() {
    const matchRoute = useMatchRoute();
    const isDetail = matchRoute({ to: "/visits/$visitId", fuzzy: true });

    if (isDetail) return <Outlet />;
    return <VisitsPage />;
}

function VisitsPage() {
    const nav = useNavigate();
    const [q, setQ] = useState("");

    const allVisits = [...getNewVisits(), ...VISITS];

    const rows = allVisits.filter(v =>
        `${v.id} ${v.nurseName} ${v.patientName} ${v.service} ${v.city}`.toLowerCase().includes(q.toLowerCase())
    );

    const cols: Column<Visit>[] = [
        { key: "id", header: "Visit ID", cell: r => <span className="font-mono text-[12px]">{r.id}</span> },
        { key: "nurseName", header: "Nurse", cell: r => <div><div className="font-medium text-[13px]">{r.nurseName}</div><div className="text-[11px] text-muted-foreground font-mono">{r.nurseId}</div></div> },
        { key: "patientName", header: "Patient", cell: r => <div><div className="font-medium text-[13px]">{r.patientName}</div><div className="text-[11px] text-muted-foreground font-mono">{r.patientId}</div></div> },
        { key: "service", header: "Service", cell: r => r.service },
        { key: "date", header: "Date", cell: r => r.date },
        { key: "city", header: "City", cell: r => r.city },
        {
            key: "rating", header: "Rating", cell: r => r.rating != null
                ? <span className="inline-flex items-center gap-1 font-medium"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{r.rating}</span>
                : <span className="text-[11px] text-muted-foreground">—</span>
        },
        { key: "status", header: "Status", cell: r => <StatusChip tone={statusTone(r.status)} label={r.status} dot /> },
        {
            key: "actions", header: "", cell: r => (
                <button
                    onClick={e => { e.stopPropagation(); nav({ to: "/visits/$visitId", params: { visitId: r.id } }); }}
                    className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
                >
                    <Eye className="h-4 w-4 text-muted-foreground" />
                </button>
            )
        },
    ];

    return (
        <DataTable
            columns={cols}
            rows={rows}
            allRows={rows}
            onSearch={setQ}
            onRowClick={r => nav({ to: "/visits/$visitId", params: { visitId: r.id } })}
            filterOptions={[
                { key: "status", label: "Status", options: ["Completed", "Scheduled", "In Progress", "Cancelled"] },
                { key: "city", label: "City", options: ["Bangalore", "Chennai", "Delhi NCR", "Mumbai"] },
            ]}
        />
    );
}