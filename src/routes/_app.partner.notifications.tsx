import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/partner/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Notifications</h1>
      <p className="text-muted-foreground">No notifications yet.</p>
    </div>
  );
}