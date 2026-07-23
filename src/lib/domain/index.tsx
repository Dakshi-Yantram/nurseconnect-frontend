/**
 * Shared Domain Context — Backend-connected version v2.
 * Fetches real data from the NurseConnect API, falls back to mock data
 * if the API is unavailable.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACTIVE_VISITS, CLINICAL_CASES, COMPLAINTS, CONSENTS,
  DISPUTES, INCIDENTS, PATIENTS, PAYOUTS,
  resolvePatientIdByName,
  type Patient,
} from "@/lib/mock-data";
import { OrchestrationProvider, useOrchestration } from "@/lib/orchestration";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function apiFetch(path: string, init?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.[0]?.msg ?? err?.detail ?? `API error ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------- Entity types
export interface BookingEntity {
  id: string;
  patientId?: string;
  patientName: string;
  nurseName: string;
  service: string;
  area: string;
  startedAt: string;
  duration: string;
  rawStatus: string;
  paymentStatus?: string;
  totalAmount?: number;
  latitude?: number;
  longitude?: number;
}

export interface VisitEntity extends BookingEntity { }

export interface ConsentEntity {
  id: string;
  patientId?: string;
  patientName: string;
  type: string;
  version: string;
  rawStatus: string;
  signedAt: string;
}

export interface IncidentEntity {
  id: string;
  patientId?: string;
  bookingId?: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  rawStatus: string;
  reporter: string;
  assigned: string;
  createdAt: string;
}

export interface PackageEntity {
  id: string;
  code?: string;
  name: string;
  rawStatus: string;
  packagePrice?: number;
  perVisitPrice?: number;
  primaryServiceId?: string;
  visitsPerCycle?: number;
  cycleDurationDays?: number;
  tagline?: string;
  description?: string;
  targetCondition?: string;
  minTier?: string;
  insuranceCovered?: boolean;
}

export interface ServiceEntity {
  id: string;
  name: string;
  durationMinutes?: number;
  basePrice?: number;
}

// ---------------------------------------------------------------- Patient create payload
export interface PatientCreatePayload {
  full_name: string;
  date_of_birth?: string | null;
  gender?: "male" | "female" | "other" | null;
  relationship_to_consumer?: string | null;
  blood_group?: string | null;
  medical_conditions?: string[] | null;
  allergies?: string[] | null;
  current_medications?: Record<string, any>[] | null;
  abha_id?: string | null;
  is_minor?: boolean;
  notes?: string | null;
}

// ---------------------------------------------------------------- Context
interface DomainState {
  bookings: BookingEntity[];
  visits: VisitEntity[];
  patients: Patient[];
  consents: ConsentEntity[];
  incidents: IncidentEntity[];
  packages: PackageEntity[];
  services: ServiceEntity[];
  loading: boolean;

  getBooking: (id: string) => BookingEntity | undefined;
  getPatient: (nameOrId: string) => Patient | undefined;
  getVisitsForPatient: (patientName: string) => VisitEntity[];
  getConsentsForPatient: (patientName: string) => ConsentEntity[];
  getIncidentsForPatient: (patientName: string) => IncidentEntity[];
  getVisitsForPatientId: (patientId: string) => VisitEntity[];
  getConsentsForPatientId: (patientId: string) => ConsentEntity[];
  getIncidentsForPatientId: (patientId: string) => IncidentEntity[];
  refetchBookings: () => Promise<void>;
  createPatient: (payload: PatientCreatePayload) => Promise<Patient>;
}

const DomainCtx = createContext<DomainState | null>(null);

// ── Map API booking → BookingEntity ─────────────────────────────────────
function mapBooking(
  b: any,
  patientMap: Map<string, string>,
  serviceMap: Map<string, string>,
): BookingEntity {
  const patientName = patientMap.get(b.patient_id) ?? "—";
  const service = serviceMap.get(b.service_id) ?? b.service_code ?? "Service";
  const area = b.address_snapshot
    ? [b.address_snapshot.line1, b.address_snapshot.city].filter(Boolean).join(", ")
    : "—";
  const startedAt = b.scheduled_date && b.scheduled_start_time
    ? `${b.scheduled_date} ${b.scheduled_start_time.slice(0, 5)}`
    : b.created_at ?? "";

  // NOTE: exact backend field name unconfirmed — trying top-level and
  // address_snapshot variants as fallback. Check the real API response
  // and trim this down to the one field name that's actually returned.
  const latitude =
    b.latitude ?? b.lat ?? b.address_snapshot?.latitude ?? b.address_snapshot?.lat ?? undefined;
  const longitude =
    b.longitude ?? b.lng ?? b.address_snapshot?.longitude ?? b.address_snapshot?.lng ?? undefined;

  return {
    id: b.id ?? "",
    patientId: b.patient_id ?? undefined,
    patientName,
    nurseName: b.worker_name ?? "",
    service,
    area,
    startedAt,
    duration: b.scheduled_duration_minutes ? `${b.scheduled_duration_minutes} mins` : "—",
    rawStatus: b.status ?? "pending",
    paymentStatus: b.payment_status ?? undefined,
    totalAmount: b.total_amount ?? undefined,
    latitude: latitude != null ? Number(latitude) : undefined,
    longitude: longitude != null ? Number(longitude) : undefined,
  };
}

// ── Map API patient → Patient ───────────────────────────────────────────
function mapPatient(p: any): Patient {
  return {
    id: p.id ?? "",
    name: p.full_name ?? p.name ?? "—",
    age: p.age ?? (p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : 0),
    gender: p.gender === "female" ? "F" : "M",
    phone: p.phone_e164 ?? p.phone ?? "—",
    city: p.city ?? "—",
    plan: p.care_plan ?? p.relationship_to_consumer ?? "—",
    status: "Active",
    bpl: p.bpl ?? false,
    spent: "₹0",
    lastVisit: "—",
    ownerId: p.consumer_id ?? undefined,
  };
}

// ── Map API service → ServiceEntity ─────────────────────────────────────
function mapService(s: any): ServiceEntity {
  return {
    id: s.id ?? "",
    name: s.name ?? s.service_code ?? "Service",
    durationMinutes: s.duration_minutes ?? undefined,
    basePrice: s.base_price ?? undefined,
  };
}

// ── Map API escalation → IncidentEntity ─────────────────────────────────
function mapEscalation(e: any): IncidentEntity {
  const triggerLabel = e.trigger_type ? String(e.trigger_type).replace(/_/g, " ") : "Escalation";
  const noteSnippet = e.notes ? String(e.notes).slice(0, 60) : "";
  return {
    id: e.id ?? "",
    patientId: e.patient_id ?? undefined,
    bookingId: e.booking_id ?? undefined,
    title: noteSnippet ? `${triggerLabel} — ${noteSnippet}` : triggerLabel,
    severity: (
      e.level === "emergency" ? "critical"
        : e.level === "contact_doctor" ? "high"
          : e.level === "watch" ? "medium"
            : "low"
    ) as IncidentEntity["severity"],
    rawStatus: e.status ?? "open",
    reporter: e.worker_id ?? "—",
    assigned: e.assigned_to ?? "Unassigned",
    createdAt: e.created_at ?? "",
  };
}

// ── Build mock fallback data ────────────────────────────────────────────
function buildMockData() {
  const consents: ConsentEntity[] = CONSENTS.map(c => ({
    id: c.id,
    patientId: resolvePatientIdByName(c.patient),
    patientName: c.patient, type: c.type, version: c.version,
    rawStatus: c.status, signedAt: c.signedAt,
  }));

  const packages: PackageEntity[] = [
    { id: "PKG-101", name: "Geriatric Care Plus", rawStatus: "active" },
    { id: "PKG-102", name: "Post-Op Recovery 14d", rawStatus: "active" },
    { id: "PKG-103", name: "Palliative Live-In", rawStatus: "on_hold" },
    { id: "PKG-104", name: "Diabetes Monitoring", rawStatus: "pending" },
  ];

  const services: ServiceEntity[] = [
    { id: "SVC-101", name: "Geriatric Care" },
    { id: "SVC-102", name: "Wound Dressing" },
    { id: "SVC-103", name: "Post-Op" },
    { id: "SVC-104", name: "Diabetes Check" },
    { id: "SVC-105", name: "IV Therapy" },
  ];

  return {
    bookings: [] as BookingEntity[],
    visits: [] as VisitEntity[],
    patients: PATIENTS,
    consents,
    incidents: [] as IncidentEntity[],
    packages,
    services,
  };
}

function BookingSyncer({ bookings, userId }: { bookings: BookingEntity[]; userId: string | null }) {
  const store = useOrchestration();
  useEffect(() => {
    if (!userId || bookings.length === 0) return;
    bookings.forEach(b => {
      store.repos.booking.upsert({
        id: b.id,
        workflow: "booking",
        state: b.rawStatus,
        enteredAt: b.startedAt ?? new Date().toISOString(),
        data: {
          ...b,
          ownerId: userId,
          patientName: b.patientName,
          service: b.service,
          area: b.area,
          status: b.rawStatus,
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, userId]);
  return null;
}

export function DomainProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(buildMockData);
  const [loading, setLoading] = useState(true);

  async function load() {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    console.log("Token:", token ? "present" : "MISSING");
    if (!token) { setLoading(false); return; }

    let role: string | null = null;
    try {
      const raw = localStorage.getItem("nc.session.v1");
      role = raw ? JSON.parse(raw)?.role ?? null : null;
    } catch { role = null; }
    const isConsumer = role === "consumer";

    try {
      const mock = buildMockData();

      const [bookingsRes, patientsRes, servicesRes, packagesRes, escalationsRes] = await Promise.allSettled([
        isConsumer ? apiFetch("/api/bookings/consumer") : Promise.resolve([]),
        isConsumer ? apiFetch("/api/patients") : Promise.resolve([]),
        apiFetch("/api/services"),
        apiFetch("/api/care-packages"),
        apiFetch("/api/escalations/"),
      ]);
      console.log("patients:", patientsRes);
      console.log("services:", servicesRes);

      const patientMap = new Map<string, string>();
      const serviceMap = new Map<string, string>();

      if (patientsRes.status === "fulfilled") {
        const list = Array.isArray(patientsRes.value)
          ? patientsRes.value
          : (patientsRes.value?.items ?? []);
        list.forEach((p: any) => patientMap.set(p.id, p.full_name ?? p.name ?? "—"));
      }

      if (servicesRes.status === "fulfilled") {
        const list = Array.isArray(servicesRes.value)
          ? servicesRes.value
          : (servicesRes.value?.items ?? []);
        list.forEach((s: any) => serviceMap.set(s.id, s.name ?? s.service_code ?? "Service"));
      }

      const bookings: BookingEntity[] =
        bookingsRes.status === "fulfilled"
          ? (Array.isArray(bookingsRes.value)
            ? bookingsRes.value
            : (bookingsRes.value?.items ?? [])
          ).map((b: any) => mapBooking(b, patientMap, serviceMap))
          : [];

      if (bookingsRes.status !== "fulfilled") {
        console.warn("Bookings API failed — showing empty state instead of mock data:", bookingsRes.reason);
      }

      const incidents: IncidentEntity[] =
        escalationsRes.status === "fulfilled"
          ? (Array.isArray(escalationsRes.value) ? escalationsRes.value : []).map(mapEscalation)
          : [];

      if (escalationsRes.status !== "fulfilled") {
        console.warn("Escalations API failed — showing no alerts instead of mock data:", escalationsRes.reason);
      }

      const patients: Patient[] =
        patientsRes.status === "fulfilled"
          ? (Array.isArray(patientsRes.value)
            ? patientsRes.value
            : (patientsRes.value?.items ?? [])
          ).map(mapPatient)
          : mock.patients;

      const services: ServiceEntity[] =
        servicesRes.status === "fulfilled"
          ? (Array.isArray(servicesRes.value)
            ? servicesRes.value
            : (servicesRes.value?.items ?? [])
          ).map(mapService)
          : [];

      if (servicesRes.status !== "fulfilled") {
        console.warn("Services API failed — showing empty state instead of mock data:", servicesRes.reason);
      }

      const packages: PackageEntity[] =
        packagesRes.status === "fulfilled"
          ? (Array.isArray(packagesRes.value)
            ? packagesRes.value
            : (packagesRes.value?.items ?? [])
          ).map((p: any) => ({
            id: p.id ?? "",
            code: p.package_code ?? "",
            name: p.name ?? p.package_name ?? "Package",
            rawStatus: p.is_active ? "active" : "inactive",
            packagePrice: p.package_price != null ? Number(p.package_price) : undefined,
            perVisitPrice: p.per_visit_price != null ? Number(p.per_visit_price) : undefined,
            primaryServiceId: p.primary_service_id ?? undefined,
            visitsPerCycle: p.visits_per_cycle ?? undefined,
            cycleDurationDays: p.cycle_duration_days ?? undefined,
            tagline: p.tagline ?? undefined,
            description: p.description ?? undefined,
            targetCondition: p.target_condition ?? undefined,
            minTier: p.min_tier ?? undefined,
            insuranceCovered: p.insurance_covered ?? undefined,
          }))
          : [];

      if (packagesRes.status !== "fulfilled") {
        console.warn("Care-packages API failed — showing empty state instead of mock data:", packagesRes.reason);
      }

      setData({
        bookings,
        visits: bookings,
        patients,
        consents: mock.consents,
        incidents,
        packages,
        services,
      });
    } catch (e) {
      console.warn("Domain API load failed:", e);
      setData(prev => ({ ...prev, bookings: [], visits: [], incidents: [] }));
    } finally {
      setLoading(false);
    }
  }

  async function createPatient(payload: PatientCreatePayload): Promise<Patient> {
    const created = await apiFetch("/api/patients", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const mapped = mapPatient(created);

    setData(prev => ({ ...prev, patients: [mapped, ...prev.patients] }));

    return mapped;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<DomainState>(() => {
    const { bookings, visits, patients, consents, incidents, packages, services } = data;
    const idByName = new Map(patients.map(p => [p.name, p.id] as const));
    const idFor = (name: string) => idByName.get(name);

    return {
      bookings, visits, patients, consents, incidents, packages, services, loading,
      getBooking: (id) => bookings.find(b => b.id === id),
      getPatient: (k) => patients.find(p => p.id === k || p.name === k),
      getVisitsForPatient: (n) => visits.filter(v => v.patientName === n),
      getConsentsForPatient: (n) => consents.filter(c => c.patientName === n),
      getIncidentsForPatient: (n) => incidents.filter(i => i.title.includes(n)),
      getVisitsForPatientId: (id) => visits.filter(v => (v.patientId ?? idFor(v.patientName)) === id),
      getConsentsForPatientId: (id) => consents.filter(c => (c.patientId ?? idFor(c.patientName)) === id),
      getIncidentsForPatientId: (id) => {
        const patient = patients.find(p => p.id === id);
        return incidents.filter(i => {
          if (i.patientId) return i.patientId === id;
          return patient ? i.title.includes(patient.name) : false;
        });
      },
      refetchBookings: load,
      createPatient,
    };
  }, [data, loading]);

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nc.session.v1");
      setUserId(raw ? JSON.parse(raw)?.id ?? null : null);
    } catch { setUserId(null); }
  }, []);
  return (
    <DomainCtx.Provider value={value}>
      <OrchestrationProvider>
        <BookingSyncer bookings={data.bookings} userId={userId} />
        {children}
      </OrchestrationProvider>
    </DomainCtx.Provider>
  );
}

function useDomainCtx(): DomainState {
  const ctx = useContext(DomainCtx);
  if (!ctx) throw new Error("useDomain must be used within <DomainProvider>");
  return ctx;
}

// Public hooks ----------------------------------------------------------------
export const useBookings = () => useDomainCtx().bookings;
export const useVisits = () => useDomainCtx().visits;
export const usePatients = () => useDomainCtx().patients;
export const useConsents = () => useDomainCtx().consents;
export const useIncidents = () => useDomainCtx().incidents;
export const usePackages = () => useDomainCtx().packages;
export const useServices = () => useDomainCtx().services;
export const useDomainLoading = () => useDomainCtx().loading;
export const useRefetchBookings = () => useDomainCtx().refetchBookings;

export const useConsumerPatients = (ownerId: string | null | undefined) => {
  const all = useDomainCtx().patients;
  return useMemo(() => {
    if (!ownerId) return all;
    const filtered = all.filter(p => (p as any).ownerId === ownerId);
    return filtered.length > 0 ? filtered : all;
  }, [all, ownerId]);
};
export const useBooking = (id: string) => useDomainCtx().getBooking(id);
export const usePatient = (k: string) => useDomainCtx().getPatient(k);
export const usePatientVisits = (name: string) => useDomainCtx().getVisitsForPatient(name);
export const usePatientConsents = (name: string) => useDomainCtx().getConsentsForPatient(name);
export const usePatientIncidents = (name: string) => useDomainCtx().getIncidentsForPatient(name);

export const usePatientVisitsById = (id: string | null | undefined): VisitEntity[] => {
  const ctx = useDomainCtx();
  return id ? ctx.getVisitsForPatientId(id) : [];
};
export const usePatientConsentsById = (id: string | null | undefined): ConsentEntity[] => {
  const ctx = useDomainCtx();
  return id ? ctx.getConsentsForPatientId(id) : [];
};
export const usePatientIncidentsById = (id: string | null | undefined): IncidentEntity[] => {
  const ctx = useDomainCtx();
  return id ? ctx.getIncidentsForPatientId(id) : [];
};

export const useCreatePatient = () => useDomainCtx().createPatient;

export function useDomainSummary() {
  const d = useDomainCtx();
  return {
    activeBookings: d.bookings.length,
    patients: d.patients.length,
    pendingConsents: d.consents.filter(c => c.rawStatus === "blocked").length,
    openIncidents: d.incidents.filter(i => i.rawStatus !== "resolved").length,
    activePackages: d.packages.filter(p => p.rawStatus === "active").length,
  };
}

export const ADMIN_PAYOUTS = PAYOUTS;
export const ADMIN_DISPUTES = DISPUTES;
export const ADMIN_COMPLAINTS = COMPLAINTS;