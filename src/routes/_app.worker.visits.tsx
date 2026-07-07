import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/worker/visits")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Visits — NurseConnect" }] }),
});