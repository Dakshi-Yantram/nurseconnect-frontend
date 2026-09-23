import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EyeOff, LockKeyhole, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/rbac";
import { apiFetch, refreshSession } from "@/lib/api";

/**
 * Wraps a block of protected health information (PHI) — the visit care
 * summary — with best-effort, SCOPED anti-capture measures. Nothing here
 * applies outside the wrapped block.
 *
 * What each measure really is (browsers cannot block OS screenshots; only a
 * native app can, e.g. Android FLAG_SECURE):
 *
 *  - Watermark (name + role + live clock) ........... DETERRENT + weak traceability
 *      Any screenshot/photo carries who took it and when. Can be removed with
 *      DevTools — a MutationObserver notices and blanks the block if it is.
 *  - No right-click / selection / copy / drag ....... DETERRENT
 *      Stops casual copy-paste; DevTools, "view source" or OCR get around it.
 *  - Ctrl/Cmd+P intercepted ......................... DETERRENT (+ logged)
 *  - @media print blanks the block .................. REAL for printing
 *      Any print path (menu, shortcut, print-to-PDF) renders the "protected
 *      content" notice instead of the data. The legitimate way to get a
 *      printable copy is the watermarked, audited PDF download.
 *  - Blur while the tab/window is inactive .......... DETERRENT
 *      Also blurs while Win/Cmd+Shift is held (the Snipping Tool / macOS
 *      screenshot chords) and on PrintScreen. Races with the OS; not a block.
 *  - Blank the block once the session token expires / is removed ... hygiene
 *  - Client events (print/copy/screenshot-key) sent to the audit log ...
 *      DETECTION ONLY; client-reported, so they can be suppressed.
 */

type ClientEvent = "print_shortcut" | "print_dialog" | "copy_attempt" | "screenshot_key";

const EVENT_THROTTLE_MS = 30_000;
const TOAST_THROTTLE_MS = 4_000;
const lastToastAt: Record<string, number> = {};

function throttledToast(key: string, msg: string) {
  const now = Date.now();
  if ((lastToastAt[key] ?? 0) + TOAST_THROTTLE_MS > now) return;
  lastToastAt[key] = now;
  toast.warning(msg);
}

/** Reads `exp` from the stored JWT (no verification — expiry display only). */
function accessTokenExpired(): boolean {
  if (typeof window === "undefined") return false;
  const token = window.localStorage.getItem("access_token");
  if (!token) return true;
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" && json.exp * 1000 <= Date.now();
  } catch {
    return false; // opaque/unknown token format: let the API decide
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

function watermarkDataUri(line1: string, line2: string): string {
  const svg =
    // Short tile (96px) with the first line near the top, so even a small
    // block shows a full, legible identity line in any screenshot.
    `<svg xmlns='http://www.w3.org/2000/svg' width='330' height='96'>` +
    `<g transform='rotate(-8 165 48)' fill='rgb(100,116,139)' fill-opacity='0.32' ` +
    `font-family='Inter,system-ui,sans-serif' font-size='12.5' font-weight='600' text-anchor='middle'>` +
    `<text x='165' y='30'>${escapeXml(line1)}</text>` +
    `<text x='165' y='46' font-size='11'>${escapeXml(line2)}</text>` +
    `</g></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

export function ProtectedContent({
  children,
  bookingId,
  className,
  label = "Visit care summary",
}: {
  children: ReactNode;
  /** When set, print/copy/screenshot attempts are reported to the audit log. */
  bookingId?: string;
  className?: string;
  label?: string;
}) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const [inactive, setInactive] = useState(false);
  const [chordHeld, setChordHeld] = useState(false);
  const [tampered, setTampered] = useState(false);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const lastEventAt = useRef<Record<string, number>>({});

  const identity = useMemo(() => {
    if (!user) return "Signed-out session";
    const name = user.name?.trim() || user.email?.trim() || `User ${user.id.slice(0, 8)}`;
    return `${name} · ${roleLabel(user.role)}`;
  }, [user]);

  const report = useCallback(
    (event: ClientEvent) => {
      if (!bookingId) return;
      const t = Date.now();
      if ((lastEventAt.current[event] ?? 0) + EVENT_THROTTLE_MS > t) return;
      lastEventAt.current[event] = t;
      // Fire-and-forget telemetry; must never break or block the page.
      apiFetch(`/api/visits/${bookingId}/report/client-events`, {
        method: "POST",
        body: JSON.stringify({ event, surface: "care_summary" }),
        timeoutMs: 10_000,
        keepalive: true,
      }).catch(() => {});
    },
    [bookingId],
  );

  // Live clock for the watermark + session-expiry check (1 Hz).
  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      setExpired(accessTokenExpired());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "access_token" || e.key === null) tick(); // logout in another tab
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Access token expired: try a silent refresh before blanking the block, so
  // an active user isn't shown "session ended" while their refresh token is
  // still valid. Only a failed refresh leaves the block blanked.
  useEffect(() => {
    if (!expired) return;
    let cancelled = false;
    refreshSession().then((ok) => {
      if (!cancelled && ok) setExpired(accessTokenExpired());
    });
    return () => { cancelled = true; };
  }, [expired]);

  // Blur when the tab is hidden or the window loses focus.
  useEffect(() => {
    const sync = () => setInactive(document.visibilityState === "hidden" || !document.hasFocus());
    const onBlur = () => setInactive(true);
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // Keyboard: print shortcut, screenshot chords, PrintScreen.
  useEffect(() => {
    const onScreenshotKey = () => {
      setChordHeld(true);
      window.setTimeout(() => setChordHeld(false), 1500);
      report("screenshot_key");
      throttledToast("shot", "Screenshots of patient information are not permitted. This has been logged.");
      // Overwrite what PrintScreen just put on the clipboard (Chrome/Edge).
      navigator.clipboard?.writeText("Protected health information — screenshot not permitted.").catch(() => {});
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "p") {
        e.preventDefault();
        e.stopPropagation();
        report("print_shortcut");
        throttledToast(
          "print",
          "Printing this page is disabled for patient privacy. Use “Download report” for a printable copy.",
        );
        return;
      }
      if (key === "printscreen") {
        onScreenshotKey();
        return;
      }
      // Win+Shift (Snipping Tool) / Cmd+Shift (macOS screenshot) chords.
      if (e.metaKey && e.shiftKey) setChordHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      // Windows usually only delivers keyup for PrintScreen.
      if (key === "printscreen") {
        onScreenshotKey(); // sets its own 1.5s timer; don't clear it below
        return;
      }
      if (!e.metaKey || !e.shiftKey) setChordHeld(false);
    };
    const onBeforePrint = () => report("print_dialog");
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("beforeprint", onBeforePrint);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
  }, [report]);

  // Block text selection inside the block (belt-and-braces with user-select).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("selectstart", stop);
    return () => el.removeEventListener("selectstart", stop);
  }, []);

  // Tamper detection: watermark removed or hidden via DevTools.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof MutationObserver === "undefined") return;
    const check = () => {
      const wm = wmRef.current;
      if (!wm || !container.contains(wm)) return setTampered(true);
      const cs = window.getComputedStyle(wm);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.5) {
        setTampered(true);
      }
    };
    const mo = new MutationObserver(check);
    mo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    return () => mo.disconnect();
  }, []);

  const block = (e: React.SyntheticEvent) => {
    e.preventDefault();
    report("copy_attempt");
    throttledToast("copy", "Copying patient information is disabled.");
  };

  const obscured = inactive || chordHeld;
  const blanked = tampered || expired;
  const clock = now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });

  return (
    <div
      ref={containerRef}
      className={`nc-protected ${className ?? ""}`}
      data-protected="phi"
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
      style={{ position: "relative", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
    >
      {/* Each branch is ONE keyed element. If the watermark node was deleted
          via DevTools, switching branches makes React remove the whole
          wrapper (still attached) instead of the detached watermark node —
          removing the latter throws "removeChild … not a child" and would
          crash the tree rather than blank it. */}
      {blanked ? (
        <div key="blanked" className="flex flex-col items-center gap-2 py-8 text-center" role="status">
          {expired ? <LockKeyhole className="h-5 w-5 text-muted-foreground" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
          <p className="text-[13px] font-semibold text-foreground">
            {expired ? "Your session has ended" : "Protected view was modified"}
          </p>
          <p className="max-w-xs text-[12px] text-muted-foreground">
            {expired
              ? "Sign in again to view this patient information."
              : "Reload the page to view this patient information."}
          </p>
          {expired ? (
            <a href="/auth/login" className="text-[12.5px] font-medium text-primary hover:underline">Sign in</a>
          ) : (
            <button type="button" onClick={() => window.location.reload()} className="text-[12.5px] font-medium text-primary hover:underline">
              Reload
            </button>
          )}
        </div>
      ) : (
        <div key="view" className="nc-protected__view" style={{ position: "relative" }}>
          <div
            className="nc-protected__content transition-[filter] duration-150"
            style={obscured ? { filter: "blur(14px)" } : undefined}
            aria-hidden={obscured || undefined}
          >
            {children}
          </div>

          <div
            ref={wmRef}
            aria-hidden
            className="nc-protected__wm rounded-[inherit]"
            style={{
              position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none",
              backgroundImage: watermarkDataUri(identity, clock), backgroundRepeat: "repeat",
            }}
          />

          {obscured && (
            <button
              type="button"
              onClick={() => setInactive(false)}
              className="nc-protected__shield flex flex-col items-center justify-center gap-1.5 rounded-[inherit] bg-background/40 text-center"
              style={{ position: "absolute", inset: 0, zIndex: 20 }}
            >
              <EyeOff className="h-5 w-5 text-muted-foreground" />
              <span className="text-[12.5px] font-medium text-foreground">Hidden while this window is inactive</span>
              <span className="text-[11.5px] text-muted-foreground">Click to show</span>
            </button>
          )}
        </div>
      )}

      {/* Only visible on paper / print-to-PDF (see styles.css). */}
      <div className="nc-protected__print">
        <p><strong>{label}: protected content</strong></p>
        <p>
          Patient health information is not included in printed pages. Use “Download report” in
          NurseConnect for an official, watermarked copy.
        </p>
      </div>
    </div>
  );
}
