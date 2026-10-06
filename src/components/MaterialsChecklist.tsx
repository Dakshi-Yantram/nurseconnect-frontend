import { resolveMediaUrl, type PackageMaterial } from "@/lib/package-materials";

// Items the nurse brings for a care package, each with photo + checkbox.
// Shown twice in the patient flow: after booking, and again at payment.
export function MaterialsChecklist({
  materials, checked, onChange, title = "Materials the nurse will bring",
}: {
  materials: PackageMaterial[];
  checked: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  title?: string;
}) {
  if (materials.length === 0) return null;
  const done = materials.filter((m) => checked[m.id]).length;
  const all = done === materials.length;

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div>
          <div className="text-[13px] font-semibold text-foreground">{title}</div>
          <div className="text-[11.5px] text-muted-foreground">{done}/{materials.length} confirmed</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(Object.fromEntries(materials.map((m) => [m.id, !all])))}
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          {all ? "Clear" : "Select all"}
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-border">
        {materials.map((m) => {
          const on = !!checked[m.id];
          const uri = resolveMediaUrl(m.image_url);
          return (
            <li key={m.id}>
              <label className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${on ? "bg-primary/5" : ""}`}>
                {uri ? (
                  <img src={uri} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-secondary shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground">{m.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Qty {m.quantity}{m.unit ? ` ${m.unit}` : ""}
                    {m.notes && !/^SAMPLE/i.test(m.notes) ? ` · ${m.notes}` : ""}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange({ ...checked, [m.id]: !on })}
                  className="h-4 w-4 accent-[var(--primary,#0a7)]"
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
