"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

/** The happy-path confirmation after a demo request: each step ticks in turn. */
export function VetSuccess({
  practice,
  when,
  steps,
  homeHref,
}: {
  practice: string;
  when: string;
  steps: string[];
  homeHref: string;
}) {
  return (
    <section
      data-testid="vet-success"
      aria-live="polite"
      className="mb-8 rounded-card border border-forest-800 bg-surface p-6 shadow-raised"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold">All sorted with {practice}</p>
        <Badge tone="sample">Simulated reply</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-500">{when}</p>
      <ul className="mt-5 flex flex-col gap-3">
        {steps.map((s, i) => (
          <motion.li
            key={s}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.6, duration: 0.35 }}
            className="flex items-center gap-2.5 text-sm font-medium"
          >
            <CheckCircle2 className="size-5 text-ok-700" />
            {s}
          </motion.li>
        ))}
      </ul>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + steps.length * 0.6 }} className="mt-6">
        <ButtonLink href={homeHref} iconRight={<ArrowRight className="size-4" />}>
          Back to your journey
        </ButtonLink>
      </motion.div>
    </section>
  );
}
