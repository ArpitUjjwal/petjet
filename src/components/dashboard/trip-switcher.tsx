"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronsUpDown, Plane } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type SwitcherTrip = {
  id: string;
  origin: string;
  destination: string;
  title: string;
  /** "15 Mar 2027 · Bella, Max" */
  subtitle: string;
  past: boolean;
};

/** Chooses which trip the dashboard shows. Each option is a link, so it works without script too. */
export function TripSwitcher({ trips, currentId }: { trips: SwitcherTrip[]; currentId: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = trips.find((t) => t.id === currentId) ?? trips[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLAnchorElement>('[aria-current="true"], a')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!current) return null;

  return (
    <div ref={root} className="relative w-full sm:w-auto">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Showing ${current.title}, ${current.subtitle}. Switch trip`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center gap-3 rounded-control border border-line-strong bg-surface pl-2 pr-3 text-left shadow-xs transition-[border-color,box-shadow] hover:border-ink-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage-200 sm:w-80"
      >
        <span className="tabular grid h-8 shrink-0 place-items-center rounded-lg bg-forest-800 px-2 font-mono text-[11px] font-semibold text-cream-50">
          {current.origin}–{current.destination}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{current.title}</span>
          <span className="tabular block truncate text-xs text-ink-500">{current.subtitle}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-400" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-40 mt-2 w-full origin-top-right overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-float sm:w-96"
          >
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-ink-400">Your trips</p>
            <ul aria-label="Your trips" className="max-h-80 overflow-y-auto">
              {trips.map((t) => {
                const active = t.id === current.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/app?trip=${t.id}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-sage-50 focus-visible:bg-sage-50 focus-visible:outline-none",
                        active && "bg-sage-100",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          t.past ? "bg-cream-200 text-ink-400" : "bg-tan-100 text-tan-700",
                        )}
                      >
                        <Plane className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="tabular block truncate text-xs text-ink-500">
                          {t.subtitle}
                          {t.past ? " · past" : ""}
                        </span>
                      </span>
                      {active && <Check className="size-4 shrink-0 text-forest-800" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
