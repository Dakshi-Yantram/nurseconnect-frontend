import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

function ConsumerLayout() {
  const { user, hydrated, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hydrated) return;
    // Another tab may have logged into a different account (admin/ops/
    // partner) and overwritten the shared session/token. Rather than let
    // the consumer pages keep firing requests under the wrong identity —
    // which surfaces as a confusing "Consumer role required" 403 — bounce
    // back to login as soon as we detect it.
    if (!user || user.role !== "consumer") {
      signOut();
      navigate({
        to: "/auth/login",
        search: { redirect: undefined, reason: "session_mismatch" },
      });
    }
  }, [hydrated, user, signOut, navigate]);

  if (!hydrated) return null;
  if (!user || user.role !== "consumer") return null;

  return <Outlet />;
}

export const Route = createFileRoute("/_app/consumer")({
  component: ConsumerLayout,
  head: () => ({ meta: [{ title: "My Care — NurseConnect" }] }),
});