"use client";

import { FlaskConical, PawPrint, Stethoscope, type LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { switchDemoAccountAction } from "@/app/actions/demo";
import { cn } from "@/lib/cn";

const ICON: Record<string, LucideIcon> = { owner: PawPrint, vet: Stethoscope, lab: FlaskConical };

/** A slim bar, shown only to demo accounts, for jumping between the owner, vet and lab. */
export function DemoSwitcher({ targets }: { targets: { who: string; label: string; current: boolean }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!targets.length) return null;
  return (
    <div
      role="region"
      aria-label="Demo switcher"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-forest-900 bg-forest-800 px-4 py-1.5 text-cream-50 sm:px-6"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-sage-300">Demo</span>
      <div className="flex flex-wrap gap-1">
        {targets.map(({ who, label, current }) => {
          const Icon = ICON[who] ?? PawPrint;
          return (
            <button
              key={who}
              type="button"
              aria-pressed={current}
              disabled={current || pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await switchDemoAccountAction(who);
                  if (r && !r.ok) setError(r.message);
                })
              }
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
                current ? "bg-cream-50 text-forest-900" : "text-cream-50/85 hover:bg-forest-700 disabled:opacity-60",
              )}
            >
              <Icon className="size-3.5" />
              {current ? label : `Switch to ${label.toLowerCase()}`}
            </button>
          );
        })}
      </div>
      {error && <span className="text-xs text-tan-300">{error}</span>}
    </div>
  );
}
