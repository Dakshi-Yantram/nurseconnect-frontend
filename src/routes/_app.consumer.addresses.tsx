import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, MapPin, Plus, Star, Trash2, Home, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AddressForm, EMPTY_ADDRESS, type Address } from "@/components/AddressForm";

export const Route = createFileRoute("/_app/consumer/addresses")({
  component: AddressBook,
  head: () => ({ meta: [{ title: "Addresses — NurseConnect" }] }),
});

function AddressBook() {
  const [rows, setRows] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<null | (typeof EMPTY_ADDRESS & { id?: string })>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await apiFetch("/api/consumers/me/addresses")); }
    catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this address?")) return;
    await apiFetch(`/api/consumers/me/addresses/${id}`, { method: "DELETE" });
    await load();
  }
  async function makeDefault(id: string) {
    await apiFetch(`/api/consumers/me/addresses/${id}/default`, { method: "POST" });
    await load();
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-foreground">Saved addresses</h1>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Manage where nurses visit. Book for yourself or someone else.</p>
          </div>
          <button onClick={() => setEditing({ ...EMPTY_ADDRESS })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90">
            <Plus size={15} /> Add address
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</div>}

        {rows.length === 0 && !editing ? (
          <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-[13px] text-muted-foreground">
            No saved addresses yet. Add one to book faster next time.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {a.label === "Home" ? <Home size={15} /> : <MapPin size={15} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-foreground">{a.label}</p>
                    {a.is_default && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Default</span>}
                  </div>
                  {a.recipient_name && <p className="text-[12px] text-muted-foreground">For {a.recipient_name}{a.recipient_phone ? ` · ${a.recipient_phone}` : ""}</p>}
                  <p className="text-[12.5px] text-muted-foreground">
                    {[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!a.is_default && (
                    <button onClick={() => makeDefault(a.id)} title="Set default" className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Star size={15} /></button>
                  )}
                  <button onClick={() => setEditing({ ...EMPTY_ADDRESS, ...a, recipient_name: a.recipient_name ?? "", line2: a.line2 ?? "" })} title="Edit" className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil size={15} /></button>
                  <button onClick={() => remove(a.id)} title="Delete" className="p-1.5 rounded hover:bg-muted text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <AddressForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => { setEditing(null); await load(); }}
          />
        )}
      </div>
    </div>
  );
}
