import type { ComponentType } from "react";
import {
  LayoutDashboard, Users, UserCheck, Network, Activity, AlertOctagon, ClipboardCheck,
  ShieldCheck, Wallet, AlertTriangle, CreditCard, Package, BookOpen, MessageSquare,
  Scale, FileSearch, Database, Settings, ScrollText, HeartHandshake,
  CalendarCheck, FileText, Bell, User as UserIcon,
  Briefcase, MapPin, IndianRupee, GraduationCap, Clock, FileSignature, Inbox,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Roles + Portals
//   - ONE admin role (full access). No more super_admin / ops / finance / clinical.
//   - reviewer: reviews onboarding docs, authors training, checks assessments.
//     Reviewer shares the admin shell but only sees its own nav items.
// ---------------------------------------------------------------------------
export type Role = "admin" | "reviewer" | "support" | "consumer" | "partner";

export type Portal = "admin" | "support" | "consumer" | "partner";

export type SelfRegisterRole = Extract<Role, "consumer" | "partner">;
export const SELF_REGISTER_ROLES: { id: SelfRegisterRole; label: string; tagline: string }[] = [
  { id: "consumer", label: "Family / Patient", tagline: "Book care for a loved one" },
  { id: "partner",  label: "Care Professional", tagline: "Offer skilled care on the marketplace" },
];

export const ROLES: { id: Role; label: string; description: string }[] = [
  { id: "admin",    label: "Admin",             description: "Full platform access" },
  { id: "reviewer", label: "Reviewer",          description: "Document review, training authoring, assessments" },
  { id: "support",  label: "Support Staff",     description: "Ticket resolution and escalation management" },
  { id: "consumer", label: "Family / Patient",  description: "Self-served bookings, patients, consents" },
  { id: "partner",  label: "Care Professional", description: "Marketplace claiming + visit execution" },
];

export const ROLE_PORTAL: Record<Role, Portal> = {
  admin:    "admin",
  reviewer: "admin",   // reviewer uses the admin shell, filtered to review items
  support:  "support",
  consumer: "consumer",
  partner:  "partner",
};

export const PORTAL_LABEL: Record<Portal, string> = {
  admin:    "Admin Portal",
  consumer: "Consumer Portal",
  partner:  "Partner Portal",
  support:  "/support-dashboard",
};

export const PORTAL_HOME: Record<Role, string> = {
  admin:    "/dashboard",
  reviewer: "/onboarding-review",
  support:  "/support-dashboard",
  consumer: "/consumer",
  partner:  "/partner",
};

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------
export type Permission =
  // Admin shared
  | "overview.view" | "ops.view" | "system.view"
  | "users.view" | "users.approve" | "onboarding.review" | "background.review"
  | "clinical.escalation" | "clinical.packages" | "clinical.rules" | "clinical.insurance"
  | "finance.reconciliation" | "finance.subscriptions" | "finance.disputes"
  | "trust.incidents" | "trust.complaints"
  | "compliance.retention" | "compliance.audit" | "compliance.settings"
  // Reviewer
  | "review.training"
  // New routes
  | "consumer.addresses" | "partner.services" | "admin.reviewer.mgmt"
  // Consumer
  | "consumer.home" | "consumer.bookings" | "consumer.patients"
  | "consumer.payments" | "consumer.consents" | "consumer.notifications" | "consumer.profile"
  // Partner
  | "partner.home" | "partner.assignments" | "partner.visits" | "partner.documentation"
  | "partner.earnings" | "partner.training" | "partner.availability"
  // Support
  | "support.queue" | "support.assign" | "support.resolve";

// The single admin gets everything (former super-admin set) + training review.
const ADMIN_ALL: Permission[] = [
  "overview.view", "ops.view", "system.view",
  "users.view", "users.approve", "onboarding.review", "background.review",
  "clinical.escalation", "clinical.packages", "clinical.rules", "clinical.insurance",
  "finance.reconciliation", "finance.subscriptions", "finance.disputes",
  "trust.incidents", "trust.complaints",
  "compliance.retention", "compliance.audit", "compliance.settings",
  "review.training", "admin.reviewer.mgmt",
];

// Reviewer: onboarding/doc review + training authoring + assessment checks.
// Intentionally NO users.view so patient/nurse PII lists stay hidden; the
// review pages are gated by their own permissions below.
const REVIEWER_PERMISSIONS: Permission[] = [
  "users.approve",       // Nurse Approval
  "onboarding.review",   // Onboarding Review
  "background.review",   // Background Check
  "review.training",     // Training + assessment review
];

const CONSUMER_ALL: Permission[] = [
  "consumer.home", "consumer.bookings", "consumer.patients",
  "consumer.payments", "consumer.consents", "consumer.notifications", "consumer.profile", "consumer.addresses",
];

const PARTNER_ALL: Permission[] = [
  "partner.home", "partner.assignments", "partner.visits", "partner.documentation",
  "partner.earnings", "partner.training", "partner.availability", "partner.services",
];

const SUPPORT_PERMISSIONS: Permission[] = [
  "support.queue",
  "support.assign",
  "support.resolve",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin:    ADMIN_ALL,
  reviewer: REVIEWER_PERMISSIONS,
  support:  SUPPORT_PERMISSIONS,
  consumer: CONSUMER_ALL,
  partner:  PARTNER_ALL,
};

// ---------------------------------------------------------------------------
// Navigation registry
// ---------------------------------------------------------------------------
export type NavSection =
  | "Overview" | "Users" | "Clinical" | "Finance" | "Trust & Safety" | "Compliance"
  | "My Care" | "Account"
  | "Work" | "Personal"
  | "Support";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section: NavSection;
  permission: Permission;
  portal: Portal;
}

export const NAV_REGISTRY: NavItem[] = [
  // ---------- ADMIN ----------
  { to: "/dashboard",               label: "Dashboard",          icon: LayoutDashboard, section: "Overview",       permission: "overview.view",             portal: "admin" },
  { to: "/ops-dashboard",           label: "Live Ops",           icon: Activity,        section: "Overview",       permission: "ops.view",                  portal: "admin" },
  { to: "/system-index",            label: "System Index",       icon: Network,         section: "Overview",       permission: "system.view",               portal: "admin" },

  { to: "/users/patients",          label: "Patients",           icon: Users,           section: "Users",          permission: "users.view",                portal: "admin" },
  { to: "/users/nurses",            label: "Nurses",             icon: HeartHandshake,  section: "Users",          permission: "users.view",                portal: "admin" },
  { to: "/nurse-approval",          label: "Nurse Approval",     icon: UserCheck,       section: "Users",          permission: "users.approve",             portal: "admin" },
  { to: "/onboarding-review",       label: "Onboarding Review",  icon: ClipboardCheck,  section: "Users",          permission: "onboarding.review",         portal: "admin" },
  { to: "/background-verification", label: "Background Check",   icon: ShieldCheck,     section: "Users",          permission: "background.review",         portal: "admin" },
  { to: "/moderation/training",     label: "Training Review",    icon: GraduationCap,   section: "Users",          permission: "review.training",           portal: "admin" },

  { to: "/clinical-escalation",     label: "Clinical Escalation",icon: AlertOctagon,    section: "Clinical",       permission: "clinical.escalation",       portal: "admin" },
  { to: "/care-packages",           label: "Care Packages",      icon: Package,         section: "Clinical",       permission: "clinical.packages",         portal: "admin" },
  { to: "/clinical-rule-sets",      label: "Clinical Rule Sets", icon: BookOpen,        section: "Clinical",       permission: "clinical.rules",            portal: "admin" },
  { to: "/insurance-review",        label: "Insurance Review",   icon: FileSearch,      section: "Clinical",       permission: "clinical.insurance",        portal: "admin" },

  { to: "/financial-reconciliation",label: "Financial Recon",    icon: Wallet,          section: "Finance",        permission: "finance.reconciliation",    portal: "admin" },
  { to: "/subscription-subsidy",    label: "Subscriptions",      icon: CreditCard,      section: "Finance",        permission: "finance.subscriptions",     portal: "admin" },
  { to: "/disputes",                label: "Disputes",           icon: Scale,           section: "Finance",        permission: "finance.disputes",          portal: "admin" },

  { to: "/incidents",               label: "Incidents",          icon: AlertTriangle,   section: "Trust & Safety", permission: "trust.incidents",           portal: "admin" },
  { to: "/complaints",              label: "Complaints",         icon: MessageSquare,   section: "Trust & Safety", permission: "trust.complaints",          portal: "admin" },

  { to: "/retention-dashboard",     label: "Data Retention",     icon: Database,        section: "Compliance",     permission: "compliance.retention",      portal: "admin" },
  { to: "/compliance",              label: "Compliance",         icon: ShieldCheck,     section: "Compliance",     permission: "compliance.audit",          portal: "admin" },
  { to: "/audit-logs",              label: "Audit Logs",         icon: ScrollText,      section: "Compliance",     permission: "compliance.audit",          portal: "admin" },
  { to: "/settings",                label: "Settings",           icon: Settings,        section: "Compliance",     permission: "compliance.settings",       portal: "admin" },

  // ---------- NEW ROUTES ----------
  { to: "/reviewer-management", label: "Reviewer Workload", icon: LayoutDashboard, section: "Users",    permission: "admin.reviewer.mgmt", portal: "admin" },
  { to: "/consumer/addresses",  label: "Addresses",         icon: LayoutDashboard, section: "Account",  permission: "consumer.addresses",  portal: "consumer" },
  { to: "/partner/services",    label: "My Services",       icon: LayoutDashboard, section: "Work",     permission: "partner.services",    portal: "partner" },

    // ---------- CONSUMER ----------
  { to: "/consumer",                label: "Home",               icon: LayoutDashboard, section: "My Care",        permission: "consumer.home",             portal: "consumer" },
  { to: "/consumer/bookings",       label: "Bookings",           icon: CalendarCheck,   section: "My Care",        permission: "consumer.bookings",         portal: "consumer" },
  { to: "/consumer/patients",       label: "Patients",           icon: HeartHandshake,  section: "My Care",        permission: "consumer.patients",         portal: "consumer" },
  { to: "/consumer/payments",       label: "Payments",           icon: CreditCard,      section: "Account",        permission: "consumer.payments",         portal: "consumer" },
  { to: "/consumer/consents",       label: "Consents",           icon: FileSignature,   section: "Account",        permission: "consumer.consents",         portal: "consumer" },
  { to: "/consumer/notifications",  label: "Notifications",      icon: Bell,            section: "Account",        permission: "consumer.notifications",    portal: "consumer" },
  { to: "/consumer/profile",        label: "Profile",            icon: UserIcon,        section: "Account",        permission: "consumer.profile",          portal: "consumer" },

  // ---------- PARTNER ----------
  { to: "/partner",                 label: "Workspace",          icon: LayoutDashboard, section: "Work",           permission: "partner.home",              portal: "partner" },
  { to: "/partner/assignments",     label: "Assignments",        icon: Briefcase,       section: "Work",           permission: "partner.assignments",       portal: "partner" },
  { to: "/partner/visits",          label: "Visits",             icon: MapPin,          section: "Work",           permission: "partner.visits",            portal: "partner" },
  { to: "/partner/documentation",   label: "Documentation",      icon: FileText,        section: "Work",           permission: "partner.documentation",     portal: "partner" },
  { to: "/partner/earnings",        label: "Earnings",           icon: IndianRupee,     section: "Personal",       permission: "partner.earnings",          portal: "partner" },
  { to: "/partner/training",        label: "Training",           icon: GraduationCap,   section: "Personal",       permission: "partner.training",          portal: "partner" },
  { to: "/partner/availability",    label: "Availability",       icon: Clock,           section: "Personal",       permission: "partner.availability",      portal: "partner" },

  // ---------- SUPPORT ----------
  { to: "/support-dashboard",   label: "Support Queue",    icon: Inbox,        section: "Support", permission: "support.queue",   portal: "support" },
  { to: "/support-escalations", label: "All Escalations",  icon: AlertOctagon, section: "Support", permission: "support.queue",   portal: "support" },
];

export const NAV_SECTIONS: NavSection[] = [
  "Overview", "Users", "Clinical", "Finance", "Trust & Safety", "Compliance",
  "My Care", "Account",
  "Work", "Personal",
  "Support",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function portalForRole(role: Role | null): Portal | null {
  return role ? ROLE_PORTAL[role] : null;
}

export function portalHome(role: Role | null): string {
  return role ? PORTAL_HOME[role] : "/auth/login";
}

function matchNav(pathname: string): NavItem | undefined {
  return NAV_REGISTRY
    .filter(n => pathname === n.to || pathname.startsWith(n.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

export function routePortal(pathname: string): Portal | null {
  return matchNav(pathname)?.portal ?? null;
}

export function canAccessRoute(role: Role | null, pathname: string): boolean {
  if (!role) return false;
  const match = matchNav(pathname);
  if (!match) return true;
  if (match.portal !== ROLE_PORTAL[role]) return false;
  return hasPermission(role, match.permission);
}

export function navForRole(role: Role | null): NavItem[] {
  if (!role) return [];
  const portal = ROLE_PORTAL[role];
  return NAV_REGISTRY.filter(n => n.portal === portal && hasPermission(role, n.permission));
}

export function routeMeta(pathname: string): { title: string; section?: NavSection; portal?: Portal } {
  const match = matchNav(pathname);
  if (!match) return { title: "NurseConnect" };
  return { title: match.label, section: match.section, portal: match.portal };
}

export function roleLabel(role: Role | null): string {
  return ROLES.find(r => r.id === role)?.label ?? "Guest";
}
