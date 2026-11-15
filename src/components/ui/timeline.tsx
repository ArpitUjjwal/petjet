"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Lightbulb, Plane } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TimelineState = "done" | "next" | "upcoming" | "blocked" | "travel" | "today" | "advice";

export type TimelineItem = {
  id: string;
  date: string;
  title: string;
  detail?: ReactNode;
  state: TimelineState;
};

const dot: Record<TimelineState, string> = {
  done: "bg-forest-800 border-forest-800 text-cream-50",
  next: "bg-surface border-forest-800 ring-4 ring-sage-200",
  upcoming: "bg-surface border-line-strong",
  blocked: "bg-danger-100 border-danger-700 text-danger-700",
  travel: "bg-tan-500 border-tan-500 text-forest-950",
  today: "bg-sage-200 border-sage-200 text-forest-800",
  advice: "bg-surface border-dashed border-tan-500 text-tan-600",
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          data-state={item.state}
          initial={reduce ? false : { opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex gap-4 pb-6 last:pb-0"
        >
          {i < items.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute left-[11px] top-6 h-full w-0.5",
                item.state === "done" ? "bg-forest-800" : "bg-line",
              )}
            />
          )}
          <span
            className={cn(
              "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2",
              dot[item.state],
            )}
          >
            {item.state === "done" && <Check className="size-3" strokeWidth={3.5} />}
            {item.state === "blocked" && <AlertTriangle className="size-3" strokeWidth={2.5} />}
            {item.state === "travel" && <Plane className="size-3" strokeWidth={2.5} />}
            {item.state === "advice" && <Lightbulb className="size-3" strokeWidth={2.5} />}
            {item.state === "today" && <span className="size-2 rounded-full bg-forest-800" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="tabular text-xs font-medium text-ink-500">{item.date}</p>
            <p
              className={cn(
                "text-sm font-medium",
                item.state === "blocked" ? "text-danger-700" : "text-ink-900",
              )}
            >
              {item.title}
            </p>
            {item.detail && <div className="mt-0.5 text-[13px] text-ink-500">{item.detail}</div>}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
