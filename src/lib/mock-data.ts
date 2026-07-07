// Centralized realistic mock data for NurseConnect

export const KPIS = {
  totalPatients: 2847,
  activeNurses: 156,
  activeVisits: 42,
  revenue: "₹8.4L",
  avgRating: 4.8,
  completionRate: 97.5,
  responseTime: 12,
};

export const BOOKING_TREND = [
  { day: "Mon", bookings: 64, completed: 58 },
  { day: "Tue", bookings: 72, completed: 68 },
  { day: "Wed", bookings: 81, completed: 75 },
  { day: "Thu", bookings: 69, completed: 65 },
  { day: "Fri", bookings: 88, completed: 84 },
  { day: "Sat", bookings: 95, completed: 90 },
  { day: "Sun", bookings: 76, completed: 71 },
];

export const SERVICE_DISTRIBUTION = [
  { name: "Post-Operative Care", value: 324, growth: "+12%", pct: 28 },
  { name: "Geriatric Care", value: 286, growth: "+8%", pct: 25 },
  { name: "Wound Care", value: 245, growth: "+15%", pct: 21 },
  { name: "IV Therapy", value: 178, growth: "+5%", pct: 15 },
  { name: "Medication Mgmt", value: 89, growth: "+3%", pct: 11 },
];

export const REGIONS = [
  { city: "Bangalore", nurses: 64, patients: 1247, visits: 856, revenue: "₹3.2L", change: 18 },
  { city: "Delhi NCR", nurses: 42, patients: 789, visits: 542, revenue: "₹2.1L", change: 12 },
  { city: "Mumbai", nurses: 38, patients: 654, visits: 478, revenue: "₹1.9L", change: 15 },
  { city: "Chennai", nurses: 12, patients: 157, visits: 124, revenue: "₹1.2L", change: 8 },
];

export const ALERTS = [
  { id: 1, label: "12 Pending Nurse Approvals", priority: "high", action: "Review Now", to: "/nurse-approval" },
  { id: 2, label: "3 Background Verifications Needed", priority: "medium", action: "View Details", to: "/background-verification" },
  { id: 3, label: "2 Incident Reports Unresolved", priority: "high", action: "Investigate", to: "/incidents" },
  { id: 4, label: "5 Applications Pending Onboarding", priority: "medium", action: "Process", to: "/onboarding-review" },
  { id: 5, label: "System Health: All Services Operational", priority: "low", action: "View Status", to: "/audit-logs" },
];

export const ACTIVITY = [
  { who: "Admin User", what: "Approved nurse application", target: "Sarah Johnson", when: "5 mins ago" },
  { who: "System", what: "Completed payment reconciliation", target: "Batch #1234", when: "15 mins ago" },
  { who: "Admin User", what: "Updated subsidy rules", target: "BPL Program", when: "1 hour ago" },
  { who: "Ops Manager", what: "Assigned nurse to urgent visit", target: "Visit #B0042", when: "2 hours ago" },
  { who: "Admin User", what: "Resolved incident report", target: "INC-2847", when: "3 hours ago" },
];

export type Patient = {
  id: string; name: string; age: number; gender: "M"|"F";
  phone: string; city: string; plan: string; status: "Active"|"Inactive"|"Suspended";
  bpl: boolean; spent: string; lastVisit: string;
  ownerId?: string;
};

export const DEMO_CONSUMER_OWNER_ID = "demo-user";

export const PATIENTS: Patient[] = [
  { id: "PAT-1001", name: "Anjali Verma", age: 67, gender: "F", phone: "+91 98432 11290", city: "Bangalore", plan: "Geriatric Care", status: "Active", bpl: false, spent: "₹42,500", lastVisit: "2026-05-04", ownerId: DEMO_CONSUMER_OWNER_ID },
  { id: "PAT-1002", name: "Ramesh Iyer", age: 72, gender: "M", phone: "+91 97864 33122", city: "Chennai", plan: "Post-Op Recovery", status: "Active", bpl: false, spent: "₹28,300", lastVisit: "2026-05-06", ownerId: DEMO_CONSUMER_OWNER_ID },
  { id: "PAT-1003", name: "Sunita Devi", age: 58, gender: "F", phone: "+91 99012 87644", city: "Delhi NCR", plan: "Diabetes Mgmt", status: "Active", bpl: true, spent: "₹6,200", lastVisit: "2026-05-05", ownerId: DEMO_CONSUMER_OWNER_ID },
  { id: "PAT-1004", name: "Vikram Singh", age: 45, gender: "M", phone: "+91 98212 43321", city: "Mumbai", plan: "Wound Care", status: "Inactive", bpl: false, spent: "₹14,800", lastVisit: "2026-04-22" },
  { id: "PAT-1005", name: "Meera Joshi", age: 81, gender: "F", phone: "+91 90011 22334", city: "Bangalore", plan: "Live-In Care", status: "Active", bpl: false, spent: "₹1,12,400", lastVisit: "2026-05-07", ownerId: DEMO_CONSUMER_OWNER_ID },
  { id: "PAT-1006", name: "Arjun Kapoor", age: 34, gender: "M", phone: "+91 90999 88172", city: "Delhi NCR", plan: "IV Therapy", status: "Suspended", bpl: false, spent: "₹3,200", lastVisit: "2026-03-12" },
  { id: "PAT-1007", name: "Lakshmi Pillai", age: 65, gender: "F", phone: "+91 98112 56710", city: "Chennai", plan: "Palliative Care", status: "Active", bpl: true, spent: "₹8,900", lastVisit: "2026-05-04", ownerId: DEMO_CONSUMER_OWNER_ID },
  { id: "PAT-1008", name: "Harish Mehta", age: 70, gender: "M", phone: "+91 90876 22310", city: "Mumbai", plan: "Geriatric Care", status: "Active", bpl: false, spent: "₹35,100", lastVisit: "2026-05-03", ownerId: DEMO_CONSUMER_OWNER_ID },
  // Phase 10 — additional patients for marketplace seed bookings
  { id: "PAT-1009", name: "Mrs. Sharma", age: 67, gender: "F", phone: "+91 98100 11111", city: "Delhi NCR", plan: "Physiotherapy", status: "Active", bpl: false, spent: "₹0", lastVisit: "—" },
  { id: "PAT-1010", name: "Mr. Singh", age: 59, gender: "M", phone: "+91 98100 22222", city: "Delhi NCR", plan: "Blood Pressure Monitoring", status: "Active", bpl: false, spent: "₹0", lastVisit: "—" },
  { id: "PAT-1011", name: "Mrs. Kapoor", age: 74, gender: "F", phone: "+91 98100 33333", city: "Mumbai", plan: "Post-Op Wound Care", status: "Active", bpl: false, spent: "₹0", lastVisit: "—" },
  { id: "PAT-1012", name: "Mr. Nair", age: 62, gender: "M", phone: "+91 98100 44444", city: "Bangalore", plan: "Diabetes Management", status: "Active", bpl: true, spent: "₹0", lastVisit: "—" },
];

export type Nurse = {
  id: string; name: string; specialty: string; experience: number;
  rating: number; visits: number; earnings: string; city: string;
  status: "Active"|"On Duty"|"Off Duty"|"Suspended"; verified: boolean;
};

export const NURSES: Nurse[] = [
  { id: "NUR-2001", name: "Priya Sharma", specialty: "Geriatric / Critical Care", experience: 8, rating: 4.9, visits: 412, earnings: "₹4,82,000", city: "Bangalore", status: "On Duty", verified: true },
  { id: "NUR-2002", name: "Sarah Johnson", specialty: "Pediatric RN", experience: 6, rating: 4.8, visits: 287, earnings: "₹3,21,400", city: "Bangalore", status: "Active", verified: true },
  { id: "NUR-2003", name: "Ravi Kumar", specialty: "Post-Operative", experience: 5, rating: 4.7, visits: 198, earnings: "₹2,18,600", city: "Mumbai", status: "Active", verified: true },
  { id: "NUR-2004", name: "Asha Nair", specialty: "Wound Care / IV", experience: 9, rating: 4.9, visits: 521, earnings: "₹5,64,900", city: "Chennai", status: "On Duty", verified: true },
  { id: "NUR-2005", name: "Deepak Singh", specialty: "Palliative", experience: 4, rating: 4.6, visits: 142, earnings: "₹1,68,200", city: "Delhi NCR", status: "Off Duty", verified: true },
  { id: "NUR-2006", name: "Kavita Rao", specialty: "Maternal Care", experience: 7, rating: 4.8, visits: 233, earnings: "₹2,87,500", city: "Bangalore", status: "Active", verified: true },
  { id: "NUR-2007", name: "Manoj Gupta", specialty: "ICU / Critical", experience: 11, rating: 4.9, visits: 612, earnings: "₹6,92,000", city: "Delhi NCR", status: "Suspended", verified: false },
];

export type Application = {
  id: string; name: string; specialty: string; experience: number;
  city: string; submitted: string; progress: number; stage: string;
  status: "In Review"|"Pending Documents"|"Background Check"|"Ready"|"Rejected";
};

export const APPLICATIONS: Application[] = [
  { id: "APP-0001", name: "Anjali Verma", specialty: "Geriatric Care", experience: 6, city: "Bangalore", submitted: "2026-05-01", progress: 60, stage: "References Check", status: "In Review" },
  { id: "APP-0002", name: "Karthik Reddy", specialty: "ICU", experience: 9, city: "Hyderabad", submitted: "2026-05-02", progress: 80, stage: "Background Check", status: "Background Check" },
  { id: "APP-0003", name: "Neha Sharma", specialty: "Pediatric", experience: 4, city: "Pune", submitted: "2026-04-28", progress: 100, stage: "Final Review", status: "Ready" },
  { id: "APP-0004", name: "Mohit Bansal", specialty: "Post-Op", experience: 3, city: "Delhi NCR", submitted: "2026-05-04", progress: 40, stage: "Documents", status: "Pending Documents" },
  { id: "APP-0005", name: "Priti Menon", specialty: "Wound Care", experience: 7, city: "Bangalore", submitted: "2026-05-05", progress: 20, stage: "Initial Screening", status: "In Review" },
];

export const ACTIVE_VISITS = [
  // ── Already-running visits (Today's Schedule / Visits page) ──────────────
  { id: "B0042", patient: "Meera Joshi",  nurse: "Priya Sharma", service: "Geriatric Care",  started: "10:30 AM", duration: "1h 20m", status: "in_progress",    area: "Indiranagar, BLR" },
  { id: "B0043", patient: "Ramesh Iyer",  nurse: "Asha Nair",    service: "Wound Dressing",  started: "11:00 AM", duration: "45m",    status: "in_progress",    area: "T Nagar, MAA"     },
  { id: "B0044", patient: "Sunita Devi",  nurse: "Ravi Kumar",   service: "Diabetes Check",  started: "11:45 AM", duration: "20m",    status: "checkin_pending", area: "Saket, DEL"       },
  { id: "B0045", patient: "Harish Mehta", nurse: "Kavita Rao",   service: "Post-Op",         started: "09:15 AM", duration: "2h 10m", status: "delayed",        area: "Bandra, BOM"      },

  // ── New marketplace requests (New Requests tab — state: "pending", no nurse/claimant) ──
  { id: "B0046", patient: "Mrs. Sharma",  nurse: null, service: "Physiotherapy",          started: "03:00 PM", duration: "60 mins", status: "pending", area: "Rohini Sector 7, DEL",  amount: 500,  priority: "high"   },
  { id: "B0047", patient: "Mr. Singh",    nurse: null, service: "Blood Pressure Monitoring", started: "05:30 PM", duration: "30 mins", status: "pending", area: "Mayur Vihar Phase 1, DEL", amount: 300, priority: "normal" },
  { id: "B0048", patient: "Mrs. Kapoor",  nurse: null, service: "Post-Op Wound Care",     started: "09:00 AM", duration: "45 mins", status: "pending", area: "Andheri West, BOM",    amount: 650,  priority: "urgent" },
  { id: "B0049", patient: "Mr. Nair",     nurse: null, service: "Diabetes Management",    started: "11:00 AM", duration: "30 mins", status: "pending", area: "Koramangala, BLR",     amount: 400,  priority: "normal" },
];

export const CLINICAL_CASES = [
  { id: "CL-0004", patient: "Meera Joshi", issue: "Irregular Heart Rate", severity: "critical", vitals: { bp: "168/98", hr: 124, temp: 99.2, spo2: 91 }, raised: "1:30 PM", nurse: "Priya Sharma" },
  { id: "CL-0005", patient: "Ramesh Iyer", issue: "Low SpO2", severity: "high", vitals: { bp: "128/82", hr: 88, temp: 98.4, spo2: 89 }, raised: "12:45 PM", nurse: "Asha Nair" },
  { id: "CL-0006", patient: "Sunita Devi", issue: "Hyperglycemia", severity: "medium", vitals: { bp: "138/86", hr: 92, temp: 98.6, spo2: 96 }, raised: "11:10 AM", nurse: "Ravi Kumar" },
  { id: "CL-0007", patient: "Lakshmi Pillai", issue: "Pain Escalation", severity: "high", vitals: { bp: "144/90", hr: 110, temp: 100.1, spo2: 94 }, raised: "10:25 AM", nurse: "Deepak Singh" },
];

export const INCIDENTS = [
  { id: "INC-2847", title: "Late arrival – patient distress", severity: "high", status: "open", reporter: "Family", assigned: "Ops Team", created: "2h ago", satisfaction: "—" },
  { id: "INC-2846", title: "Documentation mismatch", severity: "medium", status: "in_progress", reporter: "Nurse", assigned: "Compliance", created: "5h ago", satisfaction: "—" },
  { id: "INC-2845", title: "Equipment malfunction", severity: "low", status: "resolved", reporter: "Nurse", assigned: "Ops Team", created: "1d ago", satisfaction: "Good" },
  { id: "INC-2844", title: "Refusal of care – consent withdrawn", severity: "high", status: "in_progress", reporter: "Family", assigned: "Clinical Desk", created: "8h ago", satisfaction: "—" },
];

export const PAYOUTS = [
  { id: "PO-9821", batch: "Batch #1234", nurses: 42, gross: "₹6,84,200", commission: "₹1,02,630", net: "₹5,81,570", status: "approved", date: "2026-05-06" },
  { id: "PO-9822", batch: "Batch #1235", nurses: 38, gross: "₹5,11,900", commission: "₹76,785", net: "₹4,35,115", status: "pending", date: "2026-05-07" },
  { id: "PO-9823", batch: "Batch #1233", nurses: 51, gross: "₹7,42,800", commission: "₹1,11,420", net: "₹6,31,380", status: "approved", date: "2026-05-05" },
];

export const REVENUE_TREND = [
  { m: "Dec", revenue: 5.4, payouts: 4.2 },
  { m: "Jan", revenue: 6.1, payouts: 4.8 },
  { m: "Feb", revenue: 6.7, payouts: 5.2 },
  { m: "Mar", revenue: 7.2, payouts: 5.7 },
  { m: "Apr", revenue: 7.8, payouts: 6.1 },
  { m: "May", revenue: 8.4, payouts: 6.6 },
];

export const CARE_PACKAGES = [
  { id: "PKG-01", code: "POSTOP_RECOVERY", name: "Post-Surgery Recovery", target: "Post knee replacement", price: "₹18,500", visits: 14, days: 14, tier: "tier3", version: 4, active: true },
  { id: "PKG-02", code: "NRI_PARENT_BASIC", name: "NRI Parent Basic", target: "Elderly parents living alone", price: "₹9,800/mo", visits: 8, days: 30, tier: "tier2", version: 7, active: true },
  { id: "PKG-03", code: "ELDERLY_PLUS", name: "Elderly Plus", target: "65+ chronic conditions", price: "₹24,000/mo", visits: 30, days: 30, tier: "tier3", version: 3, active: true },
  { id: "PKG-04", code: "NEW_MOTHER", name: "New Mother Care", target: "Postnatal first 30 days", price: "₹14,200", visits: 20, days: 30, tier: "tier2", version: 5, active: true },
  { id: "PKG-05", code: "PALLIATIVE", name: "Palliative Support", target: "End-of-life comfort care", price: "₹32,000/mo", visits: 60, days: 30, tier: "tier4", version: 2, active: true },
  { id: "PKG-06", code: "DIABETES_MGMT", name: "Diabetes Management Monthly", target: "Insulin-dependent diabetes", price: "₹6,400/mo", visits: 12, days: 30, tier: "tier1", version: 6, active: false },
];

export const RULE_SETS = [
  { id: "RS-01", name: "Default Vitals Thresholds", category: "Vitals", scope: "All packages", version: 8, updated: "2026-04-30" },
  { id: "RS-02", name: "Cardiac Escalation", category: "Escalation", scope: "Post-Op / Geriatric", version: 4, updated: "2026-05-01" },
  { id: "RS-03", name: "Red Flag Symptoms", category: "Symptoms", scope: "All", version: 12, updated: "2026-05-04" },
  { id: "RS-04", name: "Refusal of Care Protocol", category: "Compliance", scope: "All", version: 3, updated: "2026-04-15" },
];

export const COMPLAINTS = [
  { id: "CMP-451", subject: "Nurse arrived 45 mins late", category: "Punctuality", severity: "medium", sla: "12h left", status: "open", raisedBy: "Vikram Singh", created: "6h ago" },
  { id: "CMP-450", subject: "Communication issues with caretaker", category: "Behaviour", severity: "low", sla: "32h left", status: "in_progress", raisedBy: "Anjali Verma", created: "1d ago" },
  { id: "CMP-449", subject: "Wrong medication dosage administered", category: "Clinical", severity: "high", sla: "2h left", status: "escalated", raisedBy: "Family", created: "10h ago" },
  { id: "CMP-448", subject: "Billing discrepancy on subsidy", category: "Billing", severity: "medium", sla: "Resolved", status: "resolved", raisedBy: "Sunita Devi", created: "2d ago" },
];

export const DISPUTES = [
  { id: "DSP-201", booking: "B0028", amount: "₹2,400", reason: "Service not delivered", raisedBy: "Patient", status: "evidence_review", hold: true, opened: "1d ago" },
  { id: "DSP-202", booking: "B0034", amount: "₹6,800", reason: "Partial visit – early leave", raisedBy: "Patient", status: "split_resolution", hold: true, opened: "3d ago" },
  { id: "DSP-203", booking: "B0041", amount: "₹1,200", reason: "Surge fee disputed", raisedBy: "Patient", status: "resolved_refunded", hold: false, opened: "5d ago" },
];

export const INSURANCE_REVIEWS = [
  { id: "INS-7701", booking: "B0042", patient: "Meera Joshi", insurer: "Star Health", coverage: "covered", checklist: 18, total: 18, gps: true, escalation: true, flagged: false },
  { id: "INS-7702", booking: "B0044", patient: "Sunita Devi", insurer: "HDFC Ergo", coverage: "partial", checklist: 14, total: 18, gps: true, escalation: false, flagged: true },
  { id: "INS-7703", booking: "B0040", patient: "Harish Mehta", insurer: "ICICI Lombard", coverage: "not_covered", checklist: 9, total: 18, gps: false, escalation: false, flagged: true },
];

export const SUBSCRIPTIONS = [
  { plan: "Basic", price: "₹499/mo", subscribers: 1284, mrr: "₹6.4L", churn: "2.1%", growth: "+8%" },
  { plan: "Care+", price: "₹1,499/mo", subscribers: 642, mrr: "₹9.6L", churn: "1.4%", growth: "+14%" },
  { plan: "Family Pro", price: "₹2,999/mo", subscribers: 218, mrr: "₹6.5L", churn: "0.9%", growth: "+22%" },
];

export const SUBSIDY_RECIPIENTS = [
  { id: "SUB-101", patient: "Sunita Devi", scheme: "BPL", verified: true, monthlyCap: "₹2,000", used: "₹1,250", expires: "2027-03-31" },
  { id: "SUB-102", patient: "Lakshmi Pillai", scheme: "Senior Citizen", verified: true, monthlyCap: "₹1,500", used: "₹890", expires: "2026-12-31" },
  { id: "SUB-103", patient: "Mohan Lal", scheme: "BPL", verified: false, monthlyCap: "₹2,000", used: "₹0", expires: "—" },
];

export const AUDIT_LOGS = [
  { id: 1, ts: "2026-05-07 10:42:11", actor: "admin@nurseconnect.in", action: "approve_nurse", entity: "NUR-2002", changes: "status: pending → active" },
  { id: 2, ts: "2026-05-07 10:31:00", actor: "ops@nurseconnect.in", action: "assign_visit", entity: "B0042", changes: "nurse: null → NUR-2001" },
  { id: 3, ts: "2026-05-07 10:12:45", actor: "system", action: "payout_batch", entity: "PO-9822", changes: "status: draft → pending" },
  { id: 4, ts: "2026-05-07 09:58:22", actor: "compliance@nurseconnect.in", action: "update_rule_set", entity: "RS-02", changes: "version: 3 → 4" },
  { id: 5, ts: "2026-05-07 09:40:10", actor: "admin@nurseconnect.in", action: "resolve_incident", entity: "INC-2845", changes: "status: in_progress → resolved" },
  { id: 6, ts: "2026-05-07 09:11:55", actor: "system", action: "consent_revoke", entity: "PAT-1006", changes: "marketing: true → false" },
];

export const CONSENTS = [
  { id: "CON-1", patient: "Anjali Verma", type: "Service Agreement", version: "v3.1", status: "active", signedAt: "2026-04-12" },
  { id: "CON-2", patient: "Anjali Verma", type: "Data Processing", version: "v2.0", status: "active", signedAt: "2026-04-12" },
  { id: "CON-3", patient: "Vikram Singh", type: "Marketing Comms", version: "v1.4", status: "revoked", signedAt: "2026-02-08" },
  { id: "CON-4", patient: "Sunita Devi", type: "Family Sharing", version: "v1.0", status: "active", signedAt: "2026-03-19" },
  { id: "CON-5", patient: "Harish Mehta", type: "Recording Consent", version: "v1.2", status: "blocked", signedAt: "—" },
];

export const RETENTION_SCHEDULES = [
  { id: 1, entity: "Vitals Records", policy: "7 years", lastRun: "2026-05-01", processed: 14820, next: "2026-06-01", active: true },
  { id: 2, entity: "Chat Messages", policy: "180 days", lastRun: "2026-05-06", processed: 8412, next: "2026-05-13", active: true },
  { id: 3, entity: "Audio Recordings", policy: "90 days", lastRun: "2026-05-04", processed: 312, next: "2026-05-11", active: true },
  { id: 4, entity: "Payment Logs", policy: "10 years", lastRun: "2026-04-30", processed: 2241, next: "2026-05-30", active: true },
];

export const LEDGER = [
  { id: "LED-1", booking: "B0042", date: "2026-05-07", debit: "platform_revenue", credit: "patient_wallet", amount: "₹2,400" },
  { id: "LED-2", booking: "B0042", date: "2026-05-07", debit: "worker_ledger", credit: "platform_revenue", amount: "₹2,040" },
  { id: "LED-3", booking: "B0041", date: "2026-05-06", debit: "refund_pool", credit: "patient_wallet", amount: "₹1,200" },
  { id: "LED-4", booking: "B0040", date: "2026-05-06", debit: "platform_revenue", credit: "patient_wallet", amount: "₹3,800" },
  { id: "LED-5", booking: "B0040", date: "2026-05-06", debit: "worker_ledger", credit: "platform_revenue", amount: "₹3,230" },
];

export function resolvePatientIdByName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const hit = PATIENTS.find(p => p.name === name);
  return hit?.id;
}

export type Visit = {
  id: string; service: string; date: string; time: string; duration: string;
  city: string; status: "Completed" | "Scheduled" | "In Progress" | "Cancelled";
  nurseId: string; nurseName: string; patientId: string; patientName: string;
  rating: number | null;
};

export const VISITS: Visit[] = [
  { id: "VST-001", service: "Geriatric Care", date: "2026-05-07", time: "10:30 AM", duration: "2 hours", city: "Bangalore", status: "Completed", nurseId: "NUR-2001", nurseName: "Priya Sharma", patientId: "PAT-1005", patientName: "Meera Joshi", rating: 5 },
  { id: "VST-002", service: "Wound Dressing", date: "2026-05-07", time: "11:00 AM", duration: "1 hour", city: "Chennai", status: "Completed", nurseId: "NUR-2004", nurseName: "Asha Nair", patientId: "PAT-1002", patientName: "Ramesh Iyer", rating: 5 },
  { id: "VST-003", service: "Diabetes Check", date: "2026-05-07", time: "11:45 AM", duration: "1 hour", city: "Delhi NCR", status: "In Progress", nurseId: "NUR-2003", nurseName: "Ravi Kumar", patientId: "PAT-1003", patientName: "Sunita Devi", rating: null },
  { id: "VST-004", service: "Post-Op Care", date: "2026-05-07", time: "09:15 AM", duration: "3 hours", city: "Mumbai", status: "In Progress", nurseId: "NUR-2006", nurseName: "Kavita Rao", patientId: "PAT-1008", patientName: "Harish Mehta", rating: null },
  { id: "VST-005", service: "Palliative Care", date: "2026-05-08", time: "02:00 PM", duration: "2 hours", city: "Chennai", status: "Scheduled", nurseId: "NUR-2005", nurseName: "Deepak Singh", patientId: "PAT-1007", patientName: "Lakshmi Pillai", rating: null },
  { id: "VST-006", service: "IV Therapy", date: "2026-05-06", time: "09:00 AM", duration: "1 hour", city: "Delhi NCR", status: "Cancelled", nurseId: "NUR-2002", nurseName: "Sarah Johnson", patientId: "PAT-1006", patientName: "Arjun Kapoor", rating: null },
];