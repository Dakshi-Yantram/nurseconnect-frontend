import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PermissionBanner } from "@/components/PermissionBanner";
import { AppShell } from "@/components/layout/AppShell";
import { DomainProvider } from "@/lib/domain";
import { Toaster } from "sonner";  // ← ADD THIS

export const Route = createFileRoute("/_app")({
  component: () => (
    <DomainProvider>
      <Toaster position="top-right" richColors />  {/* ← ADD THIS */}
      <AppShell />
      <PermissionBanner />
    </DomainProvider>
  ),
});