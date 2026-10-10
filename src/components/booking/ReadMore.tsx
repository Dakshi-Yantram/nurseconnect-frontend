import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Clamped paragraph with a real "Read more" / "Show less" link.
 * `extra` (e.g. "What's included") is only revealed when expanded.
 * The link only appears when there actually is more to read.
 */
export function ReadMore({
  text, lines = 3, className, extra,
}: {
  text: string;
  lines?: number;
  className?: string;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (open) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, open, lines]);

  const hasMore = overflows || open || !!extra;

  return (
    <div>
      <p
        ref={ref}
        className={cn("text-[12.5px] leading-relaxed text-muted-foreground", className)}
        style={open ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {text}
      </p>
      {open && extra}
      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-[12px] font-semibold text-primary hover:underline"
          aria-expanded={open}
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
