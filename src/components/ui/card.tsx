import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "surface" | "sage" | "forest" | "tan";

const tones: Record<Tone, string> = {
  surface: "bg-surface border border-line shadow-card",
  sage: "bg-sage-100 border border-sage-200",
  forest: "bg-forest-800 text-cream-50 shadow-raised",
  tan: "bg-tan-100 border border-tan-200",
};

export function Card({
  tone = "surface",
  interactive = false,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: Tone; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card p-5 sm:p-6",
        tones[tone],
        interactive &&
          "transition-[box-shadow,transform,border-color] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-raised hover:border-line-strong",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
