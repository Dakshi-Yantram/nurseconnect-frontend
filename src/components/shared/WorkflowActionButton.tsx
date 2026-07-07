import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAction } from "./ActionGate";
import type { ActionKey } from "@/lib/actions";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  action: ActionKey;
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
}

/**
 * Permission-aware action button. Hides itself when the role+portal cannot
 * perform the action; renders disabled if explicitly forced via `disabled`.
 */
export function WorkflowActionButton({
  action, variant = "primary", icon, className, children, ...rest
}: Props) {
  const allowed = useAction(action);
  if (!allowed) return null;

  const tone =
    variant === "primary"  ? "bg-primary text-primary-foreground hover:opacity-95"
    : variant === "danger" ? "bg-rose-600 text-white hover:bg-rose-700"
                           : "bg-secondary text-foreground hover:bg-muted border border-border";

  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition disabled:opacity-50",
        tone, className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
