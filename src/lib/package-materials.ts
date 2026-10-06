/**
 * Grouped care-package catalogue (dropdowns) + the materials checklist the
 * patient confirms twice (after booking and again at payment).
 *
 * Backend: GET /api/care-packages-grouped, /api/care-packages/{id}/materials,
 * /api/bookings/{id}/materials, POST /api/bookings/{id}/materials/ack.
 * When FEATURE_PACKAGE_MATERIALS is off the backend answers 404 — every helper
 * turns that into "feature unavailable" so the site falls back to the old flat
 * list and the old booking/payment flow, with no error shown.
 */
import { apiFetch, BASE_URL } from "@/lib/api";

export interface GroupedOption {
  id: string;
  package_code: string;
  name: string;
  description: string | null;
  included_scope: string | null;
  scope_boundary: string | null;
  material_option: string | null;
  dropdown_option: string | null;
  dropdown_note: string | null;
  package_price: string | null;
  per_visit_price: string | null;
  material_included: boolean;
  requires_prescription: boolean;
  materials_count: number;
  has_materials: boolean;
}

export interface PackageGroup {
  type: "dropdown" | "single";
  heading: string;
  /** Card heading for a dropdown group (no duration/variant in it). */
  title?: string;
  category: string | null;
  options: GroupedOption[];
}

export interface PackageMaterial {
  id: string;
  name: string;
  image_url: string | null;
  quantity: number;
  unit: string | null;
  price: string;
  notes: string | null;
  sort_order: number;
}

export type MaterialStage = "booking" | "payment";

export interface BookingMaterials {
  booking_id: string;
  package_id: string | null;
  materials: PackageMaterial[];
  acks: Record<MaterialStage, { items: unknown[]; at: string | null } | null>;
  ready_for_payment: boolean;
}

const isNotFound = (e: unknown) => (e as { status?: number })?.status === 404;

/** Backend returns relative image paths ("/api/package-materials/images/x"). */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export const optionPrice = (o: GroupedOption): number | null => {
  const raw = o.package_price ?? o.per_visit_price;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Label for one option inside a group's dropdown. */
export const optionLabel = (o: GroupedOption): string => {
  const p = optionPrice(o);
  const base = o.dropdown_option || o.name;
  return p != null ? `${base} — ₹${p.toLocaleString("en-IN")}` : base;
};

export const allMaterialsChecked = (m: PackageMaterial[], checked: Record<string, boolean>) =>
  m.length > 0 && m.every((x) => checked[x.id] === true);

export const packageMaterialsApi = {
  /** null => feature off on this backend (use the old flat list). */
  async listGrouped(): Promise<PackageGroup[] | null> {
    try {
      return (await apiFetch("/api/care-packages-grouped")) as PackageGroup[];
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  },

  /** null => feature off; materials [] => no checklist for this package. */
  async getForBooking(bookingId: string): Promise<BookingMaterials | null> {
    try {
      return (await apiFetch(`/api/bookings/${bookingId}/materials`)) as BookingMaterials;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  },

  ack(bookingId: string, stage: MaterialStage, checked: Record<string, boolean>) {
    return apiFetch(`/api/bookings/${bookingId}/materials/ack`, {
      method: "POST",
      body: JSON.stringify({
        stage,
        items: Object.entries(checked).map(([material_id, c]) => ({ material_id, checked: !!c })),
      }),
    });
  },
};
