import { createFileRoute, redirect } from "@tanstack/react-router";

// The stand-alone Consents page was removed: consent is now a short form shown
// inside the booking flow (once per patient). Old links/bookmarks land on Bookings.
export const Route = createFileRoute("/_app/consumer/consents")({
  beforeLoad: () => {
    throw redirect({ to: "/consumer/bookings" });
  },
});
