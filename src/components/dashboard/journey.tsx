import { ArrowRight, Check, FileCheck2, PartyPopper, Plane, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { JourneyStep, JourneyStepId } from "@/lib/trips/journey";

const ICON: Record<JourneyStepId, LucideIcon> = {
  documents: FileCheck2,
  certificate: Stethoscope,
  flights: Plane,
  insurance: ShieldCheck,
  ready: PartyPopper,
};

/** The guided path on Home: done steps tick off, the current one has the only button. */
export function JourneyStrip({ steps }: { steps: JourneyStep[] }) {
  const current = steps.find((s) => s.state === "current");
  const doneCount = steps.filter((s) => s.state === "done").length;
  return (
    <section aria-label="Your journey" data-testid="journey" className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Your journey</h2>
        <p className="tabular text-sm text-ink-500">
          {doneCount} of {steps.length} done
        </p>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-5">
        {steps.map((s, i) => {
          const Icon = ICON[s.id];
          return (
            <li key={s.id} data-testid="journey-step" data-step={s.id} data-state={s.state} className="relative">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute -top-3 left-5 hidden h-3 w-px sm:-left-3 sm:top-5 sm:block sm:h-px sm:w-3",
                    s.state === "upcoming" ? "bg-line" : "bg-forest-700",
                  )}
                />
              )}
              <Link
                href={s.href}
                className={cn(
                  "flex h-full items-center gap-3 rounded-control border p-3 transition-colors sm:flex-col sm:items-start",
                  s.state === "current" && "border-forest-800 bg-sage-50 ring-2 ring-forest-800/10",
                  s.state === "done" && "border-line bg-surface hover:bg-cream-50",
                  s.state === "upcoming" && "border-dashed border-line bg-surface text-ink-500 hover:bg-cream-50",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full",
                    s.state === "done" && "bg-ok-100 text-ok-700",
                    s.state === "current" && "bg-forest-800 text-cream-50",
                    s.state === "upcoming" && "bg-cream-200 text-ink-400",
                  )}
                >
                  {s.state === "done" ? <Check className="size-4.5" /> : <Icon className="size-4.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Step {i + 1}</span>
                  <span className={cn("block text-sm font-semibold", s.state === "upcoming" ? "text-ink-500" : "text-ink-900")}>
                    {s.state === "done" ? s.doneLabel : s.title}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {current && (
        <div
          data-testid="journey-current"
          className="mt-5 flex flex-col gap-4 rounded-control bg-cream-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">Next step</p>
            <p className="mt-0.5 font-semibold">{current.title}</p>
            <p className="mt-0.5 text-sm text-ink-700">{current.description}</p>
          </div>
          <ButtonLink href={current.href} size="lg" iconRight={<ArrowRight className="size-4" />}>
            {current.cta}
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
