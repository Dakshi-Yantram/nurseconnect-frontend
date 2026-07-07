import { useState, useEffect } from "react";
import { MapPin, Bell, X } from "lucide-react";
import { useAppPermissions, PermissionBadge } from "@/lib/useAppPermissions";

const STORAGE_KEY = "nc_perms_banner_dismissed";

// Shows once after first login (until dismissed). Explains why the app needs
// location and notifications, then prompts the browser. After granting both
// it auto-dismisses. Works for both consumer and partner portals:
//   - Consumer: location fills address + powers the live nurse tracker.
//   - Partner (nurse/caregiver): location is used for dispatch — so nearby
//     bookings are sent to them.
// No Bluetooth is required.
export function PermissionBanner() {
  const { perms, request } = useAppPermissions();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    const alreadyGranted = perms.location === "granted" && perms.notifications === "granted";
    if (!dismissed && !alreadyGranted) setVisible(true);
  }, [perms]);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function allow() {
    request();
    // Give 2 s then auto-hide so we don't block the UI.
    setTimeout(dismiss, 2500);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 md:left-auto md:right-4 md:w-96">
      <div className="rounded-2xl border border-border bg-background shadow-xl px-5 py-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[14px] font-bold text-foreground">Enable permissions</p>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground -mt-1">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2.5 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
              <MapPin size={15} />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Location</p>
              <p className="text-[11.5px] text-muted-foreground">
                Fills your address automatically and shows nearby nurses.
              </p>
              <div className="mt-1"><PermissionBadge status={perms.location} label="Location" /></div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
              <Bell size={15} />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">Notifications</p>
              <p className="text-[11.5px] text-muted-foreground">
                Get alerted when a nurse accepts your booking or is on the way.
              </p>
              <div className="mt-1"><PermissionBadge status={perms.notifications} label="Notifications" /></div>
            </div>
          </div>
        </div>
        {perms.location === "denied" || perms.notifications === "denied" ? (
          <p className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            One or more permissions are blocked. Open your browser settings and allow them for this site.
          </p>
        ) : (
          <button
            onClick={allow}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            Allow location & notifications
          </button>
        )}
      </div>
    </div>
  );
}
