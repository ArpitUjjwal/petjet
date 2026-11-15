import { ArrowRight, BadgeCheck, CalendarClock, Plane, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { startDemoAction } from "@/app/actions/demo";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Float, Reveal } from "./reveal";

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-10 pt-6 sm:px-8">
      <div
        aria-hidden
        className="absolute inset-x-6 top-10 bottom-16 rounded-[44px] bg-[radial-gradient(circle_at_30%_20%,var(--color-sage-200),transparent_60%),radial-gradient(circle_at_80%_90%,var(--color-tan-100),transparent_55%)]"
      />
      <Float className="relative">
        <div className="relative aspect-square overflow-hidden rounded-[36px] bg-white shadow-float ring-1 ring-line">
          <Image
            src="/brand/petjet-illustration.jpg"
            alt="A dog and a cat riding a small green plane"
            fill
            sizes="(min-width: 768px) 920px, 190vw"
            className="scale-[1.35] object-cover"
            priority
          />
        </div>
      </Float>

      {/* Floating product moments. Illustrative, not live data. */}
      <Float
        delay={0.35}
        className="absolute left-0 top-16 hidden w-60 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-raised backdrop-blur sm:block"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ok-100 text-ok-700">
            <BadgeCheck className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">Rabies vaccination</p>
            <p className="text-xs text-ink-500">Record checked against microchip</p>
          </div>
        </div>
      </Float>

      <Float
        delay={0.55}
        className="absolute -left-2 bottom-24 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 pr-4 shadow-raised backdrop-blur sm:left-2"
      >
        <ProgressRing value={5} max={7} size={48} stroke={5} label="Example readiness">
          <span className="tabular text-[11px] font-semibold">5/7</span>
        </ProgressRing>
        <div>
          <p className="text-[13px] font-semibold">Milo is nearly ready</p>
          <p className="text-xs text-ink-500">Next: health certificate</p>
        </div>
      </Float>

      <Float
        delay={0.75}
        className="absolute -right-1 bottom-6 w-56 overflow-hidden rounded-2xl bg-forest-800 text-cream-50 shadow-float sm:right-0"
      >
        <div className="flex items-center justify-between px-3.5 pt-3">
          <span className="eyebrow text-[10px] text-sage-300">Boarding</span>
          <Plane className="size-3.5 text-tan-500" />
        </div>
        <div className="flex items-end justify-between px-3.5 pb-3 pt-1">
          <div>
            <p className="tabular text-xl font-semibold tracking-tight">LHR</p>
            <p className="text-[11px] text-sage-300">London</p>
          </div>
          <span className="mb-2 h-px flex-1 border-t border-dashed border-sage-500 mx-2" />
          <div className="text-right">
            <p className="tabular text-xl font-semibold tracking-tight">CDG</p>
            <p className="text-[11px] text-sage-300">Paris</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-dashed border-forest-600 bg-forest-900/60 px-3.5 py-2 text-[11px] text-sage-200">
          <span>Pet in cabin</span>
          <span className="tabular">15 Mar</span>
        </div>
      </Float>

      <Float
        delay={0.95}
        className="absolute right-2 top-2 hidden rounded-full border border-line bg-surface/95 px-3 py-1.5 shadow-card backdrop-blur sm:flex sm:items-center sm:gap-2"
      >
        <CalendarClock className="size-3.5 text-tan-600" />
        <span className="tabular text-xs font-medium">42 days to go</span>
      </Float>
    </div>
  );
}

export function Hero({ primaryHref, demo = false }: { primaryHref: string; demo?: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.05fr_1fr] md:gap-6 md:pb-24 md:pt-20">
        <Reveal>
          <Badge tone="brand" dot>
            Now planning Great Britain to France, Ireland and the USA
          </Badge>
          <h1 className="display-xl mt-6 text-forest-900">Pet travel, simplified.</h1>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-500 sm:text-lg">
            One clear plan for your pet&apos;s trip. We check the records, book the vet, find
            pet-friendly flights and compare cover.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={primaryHref} size="lg" iconRight={<ArrowRight className="size-4" />}>
              Plan my trip
            </ButtonLink>
            {demo ? (
              <form action={startDemoAction}>
                <Button type="submit" size="lg" variant="secondary">
                  Try the demo
                </Button>
              </form>
            ) : (
              <ButtonLink href="/#how-it-works" size="lg" variant="secondary">
                How it works
              </ButtonLink>
            )}
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[13px] text-ink-500">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-forest-700" />
              Every rule links to its official source
            </li>
            <li className="flex items-center gap-2">
              <CalendarClock className="size-4 text-forest-700" />
              Deadlines worked back from take-off
            </li>
          </ul>
        </Reveal>
        <HeroVisual />
      </div>
    </section>
  );
}
