"use client";

import { ArrowLeft, ExternalLink, MapPinOff } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { CoverageIssue } from "@/lib/trips/coverage";

/** The "unsupported" ends of the questionnaire: say plainly why, and what to do instead. */
export function CoverageGuidance({ issues, onBack }: { issues: CoverageIssue[]; onBack: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6" data-testid="coverage-guidance">
      <span className="grid size-14 place-items-center rounded-2xl bg-tan-100 text-tan-700">
        <MapPinOff className="size-6" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold">We can&apos;t plan this trip yet</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
        PetJet only builds plans from rules we have checked against official sources. Rather than
        guess, here&apos;s why this one isn&apos;t covered.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {issues.map((i) => (
          <li
            key={`${i.code}-${i.message}`}
            data-code={i.code}
            className="rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-ink-700 shadow-xs"
          >
            {i.message}
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-card bg-sage-100 p-5">
        <h2 className="text-base font-semibold">What you can do</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-700">
          <li>· Check the official guidance for your route and pet.</li>
          <li>· Ask your vet. They can contact the Animal and Plant Health Agency (APHA) for you.</li>
          <li>· If any answer was wrong, change it and try again.</li>
        </ul>
        <a
          href="https://www.gov.uk/taking-your-pet-abroad"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-800 underline-offset-4 hover:underline"
        >
          GOV.UK: Taking your pet abroad <ExternalLink className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onBack} iconLeft={<ArrowLeft className="size-4" />}>
          Change my answers
        </Button>
        <ButtonLink href="/rules" variant="secondary">
          See supported routes
        </ButtonLink>
      </div>
    </div>
  );
}
