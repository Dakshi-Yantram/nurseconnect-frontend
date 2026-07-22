import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/operations")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Operations — NurseConnect" }] }),
});
