import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { PortalBadge } from "@/components/shared/PortalBadge";
import {
  User, ChevronRight, LogOut, UserCircle, Settings, SlidersHorizontal,
  HelpCircle, ArrowLeft, Lock, Shield, Trash2, Globe, Bell, Moon,
  MessageCircle, Phone, FileText, Info, Check, X, Sun, Monitor
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/consumer/profile_")({
  component: ConsumerProfile,
  head: () => ({ meta: [{ title: "Profile — NurseConnect" }] }),
});

type Page = null | "personal" | "settings" | "preferences" | "help"
  | "change-password" | "2fa" | "delete-account"
  | "language" | "notifications" | "theme"
  | "faqs" | "contact" | "privacy" | "terms" | "version";

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="h-3.5 w-3.5" /> Back
    </button>
  );
}

function SettingRow({ icon, label, sub, onClick, danger, noChevron }: {
  icon: React.ReactNode; label: string; sub?: string;
  onClick: () => void; danger?: boolean; noChevron?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 transition-colors text-left ${danger ? "hover:bg-rose-50 dark:hover:bg-rose-950/20" : "hover:bg-muted/40"}`}
    >
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-medium ${danger ? "text-rose-500" : ""}`}>{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
      </div>
      {!noChevron && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="mt-0.5 text-[13px] font-medium">{value}</div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function ConsumerProfile() {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState<Page>(null);

  // Change password state
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSuccess, setPwSuccess] = useState(false);

  // 2FA state
  const [twoFA, setTwoFA] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Notifications
  const [notifs, setNotifs] = useState({ email: true, sms: false, push: true });

  // Language
  const [lang, setLang] = useState("English");

  // Theme
  const [theme, setTheme] = useState("System");

  if (!user) return null;

  const go = (p: Page) => setPage(p);

  /* ── Pages ── */

  if (page === "change-password") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("settings")} />
      <Card title="Change Password">
        <div className="space-y-3">
          {["current", "next", "confirm"].map((f) => (
            <div key={f}>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {f === "current" ? "Current Password" : f === "next" ? "New Password" : "Confirm New Password"}
              </label>
              <input type="password" value={pwForm[f as keyof typeof pwForm]}
                onChange={e => setPwForm(p => ({ ...p, [f]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
          {pwSuccess && <p className="text-[12px] text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Password updated!</p>}
          <button onClick={() => { setPwSuccess(true); setPwForm({ current: "", next: "", confirm: "" }); }}
            className="w-full py-2.5 rounded-lg bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors mt-1"
          >Update Password</button>
        </div>
      </Card>
    </div>
  );

  if (page === "2fa") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("settings")} />
      <Card title="Two-Factor Authentication">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">Enable 2FA</div>
              <div className="text-[11px] text-muted-foreground">Secure your account with an extra step</div>
            </div>
            <Toggle enabled={twoFA} onChange={setTwoFA} />
          </div>
          {twoFA && (
            <div className="rounded-lg bg-muted p-3 text-[12px] text-muted-foreground">
              Two-factor authentication is <span className="text-emerald-600 font-medium">enabled</span>. You'll be asked for a verification code on each login.
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  if (page === "delete-account") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("settings")} />
      <Card title="Delete Account">
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">This action is <span className="text-rose-500 font-medium">permanent</span> and cannot be undone. All your data will be removed.</p>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Type DELETE to confirm</label>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-rose-400/40"
            />
          </div>
          <button disabled={deleteConfirm !== "DELETE"}
            className="w-full py-2.5 rounded-lg bg-rose-500 text-white text-[13px] font-medium hover:bg-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Delete My Account</button>
        </div>
      </Card>
    </div>
  );

  if (page === "language") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("preferences")} />
      <Card title="Language" padded={false}>
        {["English", "Hindi", "Tamil", "Telugu", "Marathi"].map(l => (
          <button key={l} onClick={() => setLang(l)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/40 text-[13px]"
          >
            {l}
            {lang === l && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </Card>
    </div>
  );

  if (page === "notifications") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("preferences")} />
      <Card title="Notifications">
        <div className="space-y-4">
          {(["email", "sms", "push"] as const).map(k => (
            <div key={k} className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium capitalize">{k === "sms" ? "SMS" : k === "push" ? "Push Notifications" : "Email Notifications"}</div>
                <div className="text-[11px] text-muted-foreground">{k === "email" ? "Booking updates via email" : k === "sms" ? "Alerts via text message" : "In-app notifications"}</div>
              </div>
              <Toggle enabled={notifs[k]} onChange={v => setNotifs(p => ({ ...p, [k]: v }))} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

if (page === "theme") return (
  <div className="space-y-4 max-w-md mx-auto">
    <BackBtn onClick={() => go("preferences")} />
    <Card title="Theme" padded={false}>
      {[
        { label: "Light",  icon: <Sun className="h-4 w-4 text-amber-500" /> },
        { label: "Dark",   icon: <Moon className="h-4 w-4 text-violet-500" /> },
        { label: "System", icon: <Monitor className="h-4 w-4 text-blue-500" /> },
      ].map(({ label, icon }) => (
        <button key={label} onClick={() => {
          setTheme(label);
          const root = document.documentElement;
          if (label === "Dark") {
            root.classList.add("dark");
          } else if (label === "Light") {
            root.classList.remove("dark");
          } else {
            // System
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            prefersDark ? root.classList.add("dark") : root.classList.remove("dark");
          }
        }}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/40 text-[13px]"
        >
          {icon}
          <span className="flex-1">{label}</span>
          {theme === label && <Check className="h-4 w-4 text-primary" />}
        </button>
      ))}
    </Card>
  </div>
);

  if (page === "faqs") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("help")} />
      <Card title="FAQs" padded={false}>
        {[
          { q: "How do I book a nurse?", a: "Go to Bookings → New Booking and fill in the details." },
          { q: "Can I cancel a booking?", a: "Yes, you can cancel up to 2 hours before the scheduled time." },
          { q: "How do I add a patient?", a: "Go to Patients → Add Patient and fill in the form." },
          { q: "How are nurses verified?", a: "All nurses are background-checked and licensed before onboarding." },
          { q: "How do I contact my nurse?", a: "Open your booking and use the contact button to reach your nurse." },
        ].map(({ q, a }) => (
          <FAQItem key={q} question={q} answer={a} />
        ))}
      </Card>
    </div>
  );

  if (page === "contact") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("help")} />
      <Card title="Contact Support" padded={false}>
        <ContactRow label="Email" value="support@nurseconnect.in" />
        <ContactRow label="Phone" value="+91 98765 00000" />
        <ContactRow label="Hours" value="Mon–Sat, 9am–6pm IST" noAction />
      </Card>
    </div>
  );

  if (page === "privacy") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("help")} />
      <Card title="Privacy Policy">
        <div className="space-y-3 text-[13px] text-muted-foreground leading-relaxed">
          <p>NurseConnect collects only the data necessary to provide healthcare coordination services.</p>
          <p>Your personal information is never sold to third parties. It is shared only with nurses and healthcare providers involved in your care.</p>
          <p>You may request deletion of your data at any time by contacting support or using the Delete Account option.</p>
          <p>We use industry-standard encryption to protect your data in transit and at rest.</p>
        </div>
      </Card>
    </div>
  );

  if (page === "terms") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go("help")} />
      <Card title="Terms of Service">
        <div className="space-y-3 text-[13px] text-muted-foreground leading-relaxed">
          <p>By using NurseConnect, you agree to use the platform for lawful healthcare coordination purposes only.</p>
          <p>Bookings are subject to nurse availability. NurseConnect is not liable for service interruptions beyond our control.</p>
          <p>You are responsible for providing accurate patient information to ensure safe care delivery.</p>
          <p>Misuse of the platform may result in account suspension or termination.</p>
        </div>
      </Card>
    </div>
  );

  if (page === "personal") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go(null)} />
      <Card title="Personal Information">
        <div className="divide-y divide-border">
          <Field label="Full Name"     value={user.name} />
          <Field label="Email Address" value={user.email} />
          <Field label="Role"          value={user.role} />
          <Field label="Account ID"    value={user.id} />
        </div>
      </Card>
    </div>
  );

  if (page === "settings") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go(null)} />
      <Card title="Account Settings" padded={false}>
        <SettingRow icon={<Lock className="h-4 w-4 text-blue-500" />}   label="Change Password"           sub="Update your password"              onClick={() => go("change-password")} />
        <SettingRow icon={<Shield className="h-4 w-4 text-emerald-500" />} label="Two-Factor Authentication" sub={twoFA ? "Enabled" : "Disabled"}  onClick={() => go("2fa")} />
        <SettingRow icon={<Trash2 className="h-4 w-4 text-rose-500" />} label="Delete Account"             sub="Permanently remove your account"  onClick={() => go("delete-account")} danger />
      </Card>
    </div>
  );

  if (page === "preferences") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go(null)} />
      <Card title="App Preferences" padded={false}>
        <SettingRow icon={<Globe className="h-4 w-4 text-blue-500" />}   label="Language"      sub={lang}   onClick={() => go("language")} />
        <SettingRow icon={<Bell className="h-4 w-4 text-amber-500" />}   label="Notifications" sub={`${[notifs.email && "Email", notifs.sms && "SMS", notifs.push && "Push"].filter(Boolean).join(", ") || "All off"}`} onClick={() => go("notifications")} />
        <SettingRow icon={<Moon className="h-4 w-4 text-violet-500" />}  label="Theme"         sub={theme}  onClick={() => go("theme")} />
      </Card>
    </div>
  );

  if (page === "help") return (
    <div className="space-y-4 max-w-md mx-auto">
      <BackBtn onClick={() => go(null)} />
      <Card title="Help & Support" padded={false}>
        <SettingRow icon={<MessageCircle className="h-4 w-4 text-blue-500" />}  label="FAQs"             sub="Frequently asked questions"    onClick={() => go("faqs")} />
        <SettingRow icon={<Phone className="h-4 w-4 text-emerald-500" />}       label="Contact Support"  sub="support@nurseconnect.in"       onClick={() => go("contact")} />
        <SettingRow icon={<FileText className="h-4 w-4 text-violet-500" />}     label="Privacy Policy"   sub="How we handle your data"       onClick={() => go("privacy")} />
        <SettingRow icon={<FileText className="h-4 w-4 text-amber-500" />}      label="Terms of Service" sub="Usage terms and conditions"    onClick={() => go("terms")} />
        <SettingRow icon={<Info className="h-4 w-4 text-muted-foreground" />}   label="App Version"      sub="v1.0.0"                        onClick={() => {}} noChevron />
      </Card>
    </div>
  );

  /* ── Main profile page ── */
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Card padded={false}>
        <div className="flex flex-col items-center py-8 px-4 text-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center mb-4">
            <User className="h-10 w-10 text-primary" />
          </div>
          <div className="text-[16px] font-semibold tracking-tight">{user.name}</div>
          <div className="text-[12px] text-muted-foreground mt-1">{user.email}</div>
          <div className="flex gap-2 mt-3">
            <RoleBadge role={user.role} />
            <PortalBadge portal="consumer" />
          </div>
        </div>
      </Card>

      <Card padded={false}>
        {[
          { label: "Personal Information", icon: UserCircle,        key: "personal",    color: "text-blue-500" },
          { label: "Account Settings",     icon: Settings,          key: "settings",    color: "text-violet-500" },
          { label: "App Preferences",      icon: SlidersHorizontal, key: "preferences", color: "text-emerald-500" },
          { label: "Help & Support",       icon: HelpCircle,        key: "help",        color: "text-amber-500" },
        ].map(({ label, icon: Icon, key, color }) => (
          <button key={key} onClick={() => go(key as Page)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors text-[13px] font-medium text-left"
          >
            <div className={`h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="flex-1">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </Card>

      <button onClick={signOut}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-[13px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-[13px] font-medium text-left hover:bg-muted/40 transition-colors"
      >
        {question}
        <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-4 pb-3.5 text-[12px] text-muted-foreground leading-relaxed">{answer}</div>}
    </div>
  );
}

function ContactRow({ label, value, noAction }: { label: string; value: string; noAction?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0">
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-[13px] font-medium mt-0.5">{value}</div>
      </div>
      {!noAction && (
        <button onClick={copy} className="text-[11px] text-primary hover:underline">
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}