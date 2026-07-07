import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { portalHome } from "@/lib/rbac";
import { RoleBadge } from "./RoleBadge";

export function Unauthorized() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="h-14 w-14 rounded-full bg-rose-50 border border-rose-200 grid place-items-center mb-4">
        <ShieldAlert className="h-7 w-7 text-rose-600" />
      </div>
      <h2 className="text-[18px] font-semibold text-foreground">You don't have access to this module</h2>
      <p className="text-[13px] text-muted-foreground mt-2 max-w-md">
        Your current role doesn't include permission for this page. Contact an
        administrator if you need access.
      </p>
      {user && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
          Signed in as <span className="text-foreground font-medium">{user.name}</span>
          <RoleBadge role={user.role} />
        </div>
      )}
      <Link
        to={portalHome(user?.role ?? null)}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:opacity-95"
      >
        Back to your portal
      </Link>
    </div>
  );
}
