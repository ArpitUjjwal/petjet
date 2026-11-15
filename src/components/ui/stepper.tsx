import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  /** Zero-based index of the active step */
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Progress">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li
            key={step}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-2"
          >
            {i > 0 && (
              <span
                aria-hidden
                className="absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-line"
              >
                <span
                  className={cn(
                    "block h-full origin-left bg-forest-800 transition-transform duration-500 ease-out-soft",
                    i <= current ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                state === "done" && "border-forest-800 bg-forest-800 text-cream-50",
                state === "current" &&
                  "border-forest-800 bg-surface text-forest-800 ring-4 ring-sage-200",
                state === "upcoming" && "border-line-strong bg-surface text-ink-400",
              )}
            >
              {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                "px-1 text-center text-xs font-medium sm:text-[13px]",
                state === "upcoming" ? "text-ink-400" : "text-ink-900",
                state !== "current" && "hidden sm:block",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
