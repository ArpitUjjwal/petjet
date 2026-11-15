import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "info" | "brand" | "sample";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-cream-200 text-ink-700",
  ok: "bg-ok-100 text-ok-700",
  warn: "bg-warn-100 text-warn-700",
  danger: "bg-danger-100 text-danger-700",
  info: "bg-info-100 text-info-700",
  brand: "bg-sage-200 text-forest-800",
  /* Used for anything simulated or illustrative, as the blueprint requires clear labelling */
  sample: "border border-dashed border-ink-400 bg-transparent text-ink-500",
};

export function Badge({
  tone = "neutral",
  dot = false,
  icon,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}
