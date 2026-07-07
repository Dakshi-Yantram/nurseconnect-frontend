import { useEffect, useRef, useState } from "react";
import { Loader2, Navigation, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";

// Live "track my nurse" map. Reads the initial position from
// GET /api/tracking/booking/{id}/latest, then subscribes to the booking
// WebSocket for live location.update pushes (falling back to polling). Uses
// Leaflet via CDN + OpenStreetMap tiles — no API key required.
//
// Render only while the nurse is on the way, i.e. booking.status in
// assigned | worker_en_route | worker_arrived. Pass the destination (the
// booking's address coordinates) so both markers can be shown.

const ELIGIBLE = ["assigned", "worker_en_route", "worker_arrived"];
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";

declare global { interface Window { L?: any } }

function loadLeaflet(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.L) return resolve(true);
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => resolve(true);
    js.onerror = () => resolve(false);
    document.body.appendChild(js);
  });
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function TrackNurseMap({
  bookingId, status, destLat, destLng,
}: {
  bookingId: string;
  status: string;
  destLat?: number | string | null;
  destLng?: number | string | null;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const nurseMarker = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [nurse, setNurse] = useState<{ lat: number; lng: number; ts: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const dLat = destLat != null ? Number(destLat) : null;
  const dLng = destLng != null ? Number(destLng) : null;

  // Init map once eligible.
  useEffect(() => {
    if (!ELIGIBLE.includes(status)) return;
    let cancelled = false;
    (async () => {
      const ok = await loadLeaflet();
      if (!ok || cancelled || !mapEl.current) { setNote("Map failed to load"); return; }
      const L = window.L;
      const center = dLat != null && dLng != null ? [dLat, dLng] : [10.8505, 76.2711]; // Kerala fallback
      const map = L.map(mapEl.current).setView(center, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);
      if (dLat != null && dLng != null) {
        L.marker([dLat, dLng]).addTo(map).bindPopup("Service address");
      }
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Initial position + live subscription.
  useEffect(() => {
    if (!ELIGIBLE.includes(status)) return;

    const applyLatest = async () => {
      try {
        const last = await apiFetch(`/api/tracking/booking/${bookingId}/latest`);
        if (last && last.latitude != null) {
          setNurse({ lat: Number(last.latitude), lng: Number(last.longitude), ts: last.recorded_at });
        }
      } catch { /* ignore */ }
    };
    applyLatest();

    // Live WebSocket push.
    const token = localStorage.getItem("access_token");
    const wsBase = API_BASE.replace(/^http/, "ws");
    try {
      const ws = new WebSocket(`${wsBase}/api/ws/booking/${bookingId}?token=${token ?? ""}`);
      ws.onmessage = (evt) => {
        try {
          const m = JSON.parse(evt.data);
          if (m.type === "location.update" && m.latitude != null) {
            setNurse({ lat: Number(m.latitude), lng: Number(m.longitude), ts: m.ts });
          }
        } catch { /* ignore non-JSON keepalives */ }
      };
      ws.onerror = () => { /* fall back to polling below */ };
      wsRef.current = ws;
    } catch { /* ignore */ }

    // Polling fallback (also covers the case where the WS never opens).
    pollRef.current = setInterval(applyLatest, 8000);

    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* noop */ } wsRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, bookingId]);

  // Move the nurse marker when position changes.
  useEffect(() => {
    if (!ready || !nurse || !mapRef.current) return;
    const L = window.L;
    if (!nurseMarker.current) {
      const icon = L.divIcon({
        className: "",
        html: '<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #2563eb"></div>',
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      nurseMarker.current = L.marker([nurse.lat, nurse.lng], { icon }).addTo(mapRef.current).bindPopup("Your nurse");
    } else {
      nurseMarker.current.setLatLng([nurse.lat, nurse.lng]);
    }
    // Keep both markers in view.
    if (dLat != null && dLng != null) {
      mapRef.current.fitBounds([[nurse.lat, nurse.lng], [dLat, dLng]], { padding: [50, 50], maxZoom: 15 });
    } else {
      mapRef.current.setView([nurse.lat, nurse.lng], 14);
    }
  }, [ready, nurse, dLat, dLng]);

  if (!ELIGIBLE.includes(status)) return null;

  const distanceKm =
    nurse && dLat != null && dLng != null ? haversineKm(nurse.lat, nurse.lng, dLat, dLng) : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation size={15} className="text-primary" />
          <span className="text-[13.5px] font-bold text-foreground">Track your nurse</span>
        </div>
        {distanceKm != null && (
          <span className="text-[12px] text-muted-foreground">{distanceKm.toFixed(1)} km away</span>
        )}
      </div>

      <div ref={mapEl} className="h-64 w-full bg-muted" />

      <div className="px-5 py-3 text-[12px] text-muted-foreground flex items-center gap-2">
        {!ready ? (
          <><Loader2 size={13} className="animate-spin" /> Loading map…</>
        ) : nurse ? (
          <><MapPin size={13} className="text-primary" /> Live location · updated {new Date(nurse.ts).toLocaleTimeString("en-IN")}</>
        ) : (
          <>{note ?? "Waiting for your nurse to share their location…"}</>
        )}
      </div>
    </div>
  );
}
