import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusChip } from "@/components/shared/StatusChip";
import { Modal } from "@/components/shared/Modal";
import { Eye, Ban, MoreHorizontal, Pencil, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface ApiPatient {
  id: string;
  full_name: string;
  age?: number;
  gender?: string;
  phone_e164?: string;
  city?: string;
  care_plan?: string;
  is_bpl?: boolean;
}

interface ConsumerOption { id: string; full_name: string; phone: string; }

export const Route = createFileRoute("/_app/users/patients")({ component: PatientsPage });

function PatientsPage() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [consumers, setConsumers] = useState<ConsumerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [form, setForm] = useState({
    consumer_id: "", full_name: "", age: "", gender: "Female",
    phone_e164: "", city: "",
  });

  async function loadPatients() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/patients");
      setPatients(data);
    } catch (e) {
      toast.error("Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  async function loadConsumers() {
    try {
      const data = await apiFetch("/api/admin/consumers");
      setConsumers(data);
    } catch (e) {
      toast.error("Failed to load consumers");
    }
  }

  useEffect(() => { loadPatients(); loadConsumers(); }, []);

  const rows = patients.filter(p =>
    `${p.full_name} ${p.id} ${p.city ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  async function handleSubmit() {
    if (!form.consumer_id) return toast.error("Select a consumer/family first");
    if (!form.full_name) return toast.error("Full name is required");
    try {
      await apiFetch("/api/admin/patients", {
        method: "POST",
        body: JSON.stringify({
          consumer_id: form.consumer_id,
          full_name: form.full_name,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender.toLowerCase(),
          phone_e164: form.phone_e164 || undefined,
          city: form.city || undefined,
        }),
      });
      toast.success("Patient registered");
      setOpen(false);
      setForm({ consumer_id: "", full_name: "", age: "", gender: "Female", phone_e164: "", city: "" });
      loadPatients();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to register patient");
    }
  }

  const cols: Column<ApiPatient>[] = [
    {
      key: "id", header: "Patient ID",
      cell: r => <span className="font-mono text-[12px]">{r.id.slice(0, 8)}</span>
    },
    {
      key: "name", header: "Name", cell: r => (
        <div>
          <div className="font-medium">{r.full_name}</div>
          <div className="text-[11px] text-muted-foreground">{r.age ?? "—"} yrs · {r.gender ?? "—"}</div>
        </div>
      )
    },
    { key: "phone", header: "Contact", cell: r => <span className="text-[12px]">{r.phone_e164 ?? "—"}</span> },
    { key: "city", header: "City", cell: r => r.city ?? "—" },
    { key: "plan", header: "Care Plan", cell: r => r.care_plan ? <StatusChip tone="info" label={r.care_plan} /> : "—" },
    { key: "bpl", header: "Subsidy", cell: r => r.is_bpl ? <StatusChip tone="purple" label="BPL" dot /> : <span className="text-muted-foreground text-[12px]">—</span> },
    {
      key: "actions", header: "", cell: r => (
        <div className="flex items-center gap-1">
          {/* View */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              nav({ to: "/patients/$patientId", params: { patientId: r.id } });
            }}
            className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
            title="View patient"
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Suspend */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.warning(`${r.full_name} suspended`);
            }}
            className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
            title="Suspend patient"
          >
            <Ban className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* 3-dot menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === r.id ? null : r.id);
              }}
              className="h-8 w-8 grid place-items-center rounded hover:bg-secondary"
              title="More options"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>

            {openMenuId === r.id && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                  }}
                />

                {/* Dropdown */}
                <div className="absolute right-0 top-9 z-20 w-48 rounded-md border border-border bg-card shadow-md py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nav({ to: "/patients/$patientId", params: { patientId: r.id } });
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary flex items-center gap-2"
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    View Profile
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info(`Edit coming soon for ${r.full_name}`);
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary flex items-center gap-2"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    Edit Details
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info("Assign care plan coming soon");
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary flex items-center gap-2"
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                    Assign Care Plan
                  </button>

                  <div className="border-t border-border my-1" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.warning(`${r.full_name} suspended`);
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary text-destructive flex items-center gap-2"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Suspend Patient
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <DataTable
        columns={cols} rows={rows} onSearch={setQ}
        onAdd={() => setOpen(true)} addLabel="Add Patient"
        onRowClick={(r) => nav({ to: "/patients/$patientId", params: { patientId: r.id } })}
        filterOptions={[
          { key: "city", label: "City", options: Array.from(new Set(patients.map(p => p.city).filter(Boolean))) as string[] },
          { key: "gender", label: "Gender", options: ["male", "female", "other"] },
        ]}
      />

      <Modal
        open={open} onClose={() => setOpen(false)}
        title="Add New Patient" description="Register a patient and assign a care plan"
        size="lg"
        footer={<>
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-[13px] rounded-md border border-border">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-[13px] rounded-md bg-primary text-white">Add Patient</button>
        </>}
      >
        <div className="mb-6">
          <h4 className="text-[13px] font-semibold text-foreground mb-3">Family / Consumer</h4>
          <select
            className="w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card"
            value={form.consumer_id}
            onChange={(e) => setForm(f => ({ ...f, consumer_id: e.target.value }))}
          >
            <option value="">Select consumer…</option>
            {consumers.map(c => (
              <option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <h4 className="text-[13px] font-semibold text-foreground mb-3">Personal Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="e.g. Anjali Verma" />
            <Field label="Age" value={form.age} onChange={v => setForm(f => ({ ...f, age: v }))} placeholder="65" />
            <SelectField label="Gender" value={form.gender} options={["Female", "Male", "Other"]} onChange={v => setForm(f => ({ ...f, gender: v }))} />
            <Field label="Mobile" value={form.phone_e164} onChange={v => setForm(f => ({ ...f, phone_e164: v }))} placeholder="+91 XXXXX XXXXX" />
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-[13px] font-semibold text-foreground mb-3">Address</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Bangalore" full />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, full }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      <input
        value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }:
  { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border bg-card"
      >
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}