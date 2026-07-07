import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/partner/visits")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Visits â€” NurseConnect" }] }),
});
