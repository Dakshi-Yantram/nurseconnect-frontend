import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasPermission as rbacHas, type Permission, type Role } from "./rbac";

/**
 * Auth context for the web portal.
 *
 * Phase 1 wires the centralized session/role provider so all route guards,
 * sidebar, topbar and permission-aware components read from one source.
 * Backed by `localStorage` for now; swap the loader for the real session
 * API in a later phase without changing call sites.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** True once the localStorage session has been read on the client.
   *  Route guards MUST wait on this before triggering any redirect,
   *  otherwise refreshes on deep-linked operational pages bounce to
   *  /auth/login before the session is restored. */
  hydrated: boolean;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  setRole: (role: Role) => void;
  hasPermission: (p: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "nc.session.v1";

function readSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as SessionUser;
    
    // ✅ Migrate old role names
   const roleMap: Record<string, string> = {
      worker: "partner",
      admin_ops: "admin", admin_clinical: "admin", admin_finance: "admin",
      admin_super: "admin", admin_support: "admin", trainer: "admin",
    };
    if (roleMap[user.role]) {
      user.role = roleMap[user.role] as Role;
      writeSession(user); // save migrated version
    }
    
    return user;
  } catch {
    return null;
  }
}

function writeSession(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(readSession());
    setHydrated(true);
  }, []);

  const signIn = useCallback((u: SessionUser) => { writeSession(u); setUser(u); }, []);
  const signOut = useCallback(() => { writeSession(null); setUser(null); }, []);
  const setRole = useCallback((role: Role) => {
    setUser(prev => {
      const next = prev ? { ...prev, role } : { id: "demo", name: "Admin User", email: "admin@nurseconnect.in", role };
      writeSession(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: !!user,
    hydrated,
    signIn, signOut, setRole,
    hasPermission: (p) => rbacHas(user?.role ?? null, p),
  }), [user, hydrated, signIn, signOut, setRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function usePermission(p: Permission): boolean {
  return useAuth().hasPermission(p);
}
