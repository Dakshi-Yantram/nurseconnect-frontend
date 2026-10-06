import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Bell } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/notifications")({
  component: NotificationsPage,
});

type Notif = {
  id: string;
  title?: string | null;
  body?: string | null;
  template_code?: string | null;
  read_at?: string | null;
  created_at: string;
};

function NotificationsPage() {
  const [items, setItems] = useState<Notif[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/notifications/")
      .then((r) => setItems(Array.isArray(r) ? r : []))
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : "Could not load notifications"); setItems([]); });
  }, []);

  async function markRead(n: Notif) {
    if (n.read_at) return;
    try {
      await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      setItems((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    } catch { /* non-fatal */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
      <h1 className="text-[20px] font-bold text-foreground">Notifications</h1>
      {items === null && <Loader2 className="animate-spin text-primary" />}
      {error && <p className="text-[12.5px] text-red-600">{error}</p>}
      {items?.length === 0 && !error && (
        <div className="rounded-xl border border-border bg-card py-12 text-center text-[13px] text-muted-foreground">
          <Bell className="mx-auto mb-2 h-6 w-6" /> No notifications yet.
        </div>
      )}
      <ul className="space-y-2">
        {items?.map((n) => (
          <li key={n.id} onClick={() => markRead(n)}
            className={cn("rounded-xl border px-4 py-3 cursor-pointer", n.read_at ? "border-border bg-card" : "border-primary/30 bg-primary/5")}>
            <p className="text-[13.5px] font-semibold text-foreground">{n.title}</p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{n.body}</p>
            {n.template_code === "onboarding_clarification" && (
              <Link to="/partner/documentation" className="mt-1.5 inline-block text-[12px] font-semibold text-primary hover:underline">Upload documents →</Link>
            )}
            <p className="text-[10.5px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("en-IN")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
