import { useEffect, useState, useCallback } from "react";
import { Loader2, MapPin, Plus, Check, Home } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AddressForm, EMPTY_ADDRESS, type Address } from "@/components/AddressForm";
import { cn } from "@/lib/utils";

// Swiggy-style address selector for the booking flow. Loads saved addresses,
// auto-selects the default, and lets the user add a new one inline (GPS or
// manual). Reports the chosen address's id via onChange so the booking request
// can send `address_id` (the backend resolves the snapshot + coordinates).
export function AddressPicker({
  value, onChange,
}: {
  value: string | null;
  onChange: (addressId: string | null) => void;
}) {
  const [rows, setRows] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (selectId?: string) => {
    setLoading(true);
    try {
      const data: Address[] = await apiFetch("/api/consumers/me/addresses");
      setRows(data);
      // Auto-select: explicit id > current value > default > first.
      const pick =
        (selectId && data.find((a) => a.id === selectId)?.id) ||
        (value && data.find((a) => a.id === value)?.id) ||
        data.find((a) => a.is_default)?.id ||
        data[0]?.id ||
        null;
      onChange(pick);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading addresses…</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-semibold text-foreground">Service address <span className="text-red-500">*</span></label>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
            <Plus size={13} /> Add new
          </button>
        )}
      </div>

      {rows.length === 0 && !adding && (
        <p className="text-[12px] text-muted-foreground">No saved addresses. Add one to continue.</p>
      )}

      {!adding && rows.map((a) => {
        const selected = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-2.5 transition-all",
              selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            )}
          >
            <span className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-md", selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
              {a.label === "Home" ? <Home size={14} /> : <MapPin size={14} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-semibold text-foreground">{a.label}</span>
                {a.is_default && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700">Default</span>}
              </div>
              <p className="text-[11.5px] text-muted-foreground truncate">
                {[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(", ")}
              </p>
            </div>
            {selected && <Check size={16} className="text-primary flex-shrink-0" />}
          </button>
        );
      })}

      {adding && (
        <AddressForm
          initial={{ ...EMPTY_ADDRESS, is_default: rows.length === 0 }}
          onCancel={() => setAdding(false)}
          onSaved={async (saved) => { setAdding(false); await load(saved.id); }}
        />
      )}
    </div>
  );
}
