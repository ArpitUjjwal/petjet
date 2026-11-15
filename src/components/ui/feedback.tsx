import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-cream-200)_25%,var(--color-sage-100)_50%,var(--color-cream-200)_75%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-line-strong bg-cream-50 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-sage-100 text-forest-800">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type CalloutTone = "info" | "warn" | "danger" | "ok";

const calloutTones: Record<CalloutTone, string> = {
  info: "bg-info-100 text-info-700 border-info-700/15",
  warn: "bg-warn-100 text-warn-700 border-warn-700/15",
  danger: "bg-danger-100 text-danger-700 border-danger-700/15",
  ok: "bg-ok-100 text-ok-700 border-ok-700/15",
};

export function Callout({
  tone = "info",
  icon,
  title,
  children,
  className,
}: {
  tone?: CalloutTone;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" || tone === "warn" ? "alert" : "note"}
      className={cn("flex gap-3 rounded-control border p-4", calloutTones[tone], className)}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-[13px] text-ink-700">{children}</div>}
      </div>
    </div>
  );
}
