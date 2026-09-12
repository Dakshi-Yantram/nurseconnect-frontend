/**
 * Renders one MediaStreamTrack (self or a remote participant) into a
 * <video> element. Reused for both the doctor's own preview and every
 * remote participant tile in the tele-consultation screen.
 */
import { useEffect, useRef } from "react";
import { VideoOff } from "lucide-react";

export function VideoTile({
  track,
  label,
  muted = false,
  mirrored = false,
}: {
  track: MediaStreamTrack | null;
  label: string;
  muted?: boolean;
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (track) {
      const stream = new MediaStream([track]);
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [track]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
      {track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <VideoOff className="h-8 w-8" />
          <span className="text-[12px]">Camera off</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white">
        {label}
      </span>
    </div>
  );
}
