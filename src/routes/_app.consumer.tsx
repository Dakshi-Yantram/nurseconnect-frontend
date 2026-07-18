import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/consumer")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "My Care — NurseConnect" }] }),
});
