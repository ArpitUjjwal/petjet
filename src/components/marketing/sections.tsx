import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ClipboardCheck, FileUp, PawPrint, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { TIERS, formatPrice } from "@/lib/marketing/pricing";
import { SUPPORTED_ROUTES } from "@/lib/marketing/routes";
import { Reveal, SectionHeading } from "./reveal";

const STEPS = [
  {
    icon: PawPrint,
    title: "Tell us about your pet",
    body: "Species, age, microchip and vaccination status, plus where and when you're going.",
  },
  {
    icon: ClipboardCheck,
    title: "Get your dated plan",
    body: "Every requirement for your route, in the right order, with deadlines worked back from departure.",
  },
  {
    icon: FileUp,
    title: "Check records and book",
    body: "Upload records to be checked, then request the vet or lab appointments that are still missing.",
  },
  {
    icon: Plane,
    title: "Fly together",
    body: "Book a flight that accepts your pet and keep the e-ticket and readiness status in one place.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-cream-50 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps from idea to take-off."
          align="center"
        />
        <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          <span
            aria-hidden
            className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-[repeating-linear-gradient(to_right,var(--color-line-strong)_0_6px,transparent_6px_12px)] md:block"
          />
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 0.1} className="relative flex flex-col items-center text-center">
                <span className="relative grid size-12 place-items-center rounded-2xl bg-forest-800 text-cream-50 shadow-raised">
                  <Icon className="size-5" />
                  <span className="tabular absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border-2 border-cream-50 bg-tan-500 text-[11px] font-semibold text-forest-950">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-base font-semibold">{title}</h3>
                <p className="mt-2 max-w-60 text-sm leading-relaxed text-ink-500">{body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function RouteCards() {
  return (
    <section id="routes" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Supported routes"
            title="Three routes, checked properly."
            description="We only plan routes whose rules we have verified. For anywhere else we tell you plainly, rather than guess."
          />
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {SUPPORTED_ROUTES.map((route, i) => (
            <Reveal key={route.id} delay={i * 0.08}>
              <article
                data-testid={`route-${route.id}`}
                className="flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-card transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="flex items-center gap-3">
                  <span className="tabular rounded-lg bg-forest-800 px-2.5 py-1.5 font-mono text-sm font-semibold text-cream-50">
                    {route.from.code}
                  </span>
                  <span className="h-px flex-1 border-t border-dashed border-line-strong" />
                  <Plane className="size-4 text-tan-600" />
                  <span className="h-px flex-1 border-t border-dashed border-line-strong" />
                  <span className="tabular rounded-lg bg-tan-100 px-2.5 py-1.5 font-mono text-sm font-semibold text-tan-700">
                    {route.to.code}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">
                  {route.from.name} to {route.to.name}
                </h3>
                <p className="mt-1 text-sm text-ink-500">{route.headline}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {route.keyRequirements.map((req) => (
                    <li key={req} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-forest-700" strokeWidth={2.5} />
                      {req}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  {route.species.map((s) => (
                    <Badge key={s} tone="brand">
                      {s}
                    </Badge>
                  ))}
                  <span className="ml-auto text-xs text-ink-500">Source: {route.authority}</span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-6 text-center text-[13px] text-ink-500">
            Return travel to Great Britain is included in every plan. Requirements are summaries;
            your plan lists each one with its official source.{" "}
            <Link href="/rules" className="font-medium text-forest-800 underline-offset-4 hover:underline">
              See every rule and source
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function Pricing({ primaryHref }: { primaryHref: string }) {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-line bg-cream-50 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Pay per trip. No subscription."
          description="Start free, then upgrade the trip you're actually taking."
          align="center"
        />
        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.id} delay={i * 0.08}>
              <article
                data-testid={`tier-${tier.id}`}
                className={cn(
                  "relative flex h-full flex-col rounded-card p-7",
                  tier.highlighted
                    ? "bg-forest-800 text-cream-50 shadow-float md:-my-3 md:py-10"
                    : "border border-line bg-surface shadow-card",
                )}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-7 rounded-full bg-tan-500 px-3 py-1 text-xs font-semibold text-forest-950">
                    Most popular
                  </span>
                )}
                <h3 className="text-base font-semibold">{tier.name}</h3>
                <p className={cn("mt-1 text-sm", tier.highlighted ? "text-sage-200" : "text-ink-500")}>
                  {tier.tagline}
                </p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="tabular text-5xl font-semibold tracking-tight">
                    {formatPrice(tier.price)}
                  </span>
                  {tier.price > 0 && (
                    <span className={tier.highlighted ? "text-sage-300" : "text-ink-500"}>/ trip</span>
                  )}
                </p>
                <ul className="mt-7 flex flex-1 flex-col gap-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          tier.highlighted ? "text-tan-500" : "text-forest-700",
                        )}
                        strokeWidth={2.5}
                      />
                      <span className={tier.highlighted ? "text-cream-50" : "text-ink-700"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={primaryHref}
                  variant={tier.highlighted ? "accent" : "secondary"}
                  className="mt-8 w-full"
                  iconRight={<ArrowRight className="size-4" />}
                >
                  {tier.price === 0 ? "Start free" : `Choose ${tier.name}`}
                </ButtonLink>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-ink-500">
          Vet fees, lab tests, flights and official certificates are paid separately to the
          provider. Payments in this demo are simulated; no card is ever charged.
        </p>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Is PetJet an official source of pet travel rules?",
    a: "No. PetJet turns official rules into a personal plan. Every requirement links to the government source it came from and shows when we last checked it. Always confirm with that source and your vet before you travel.",
  },
  {
    q: "Does PetJet issue health certificates?",
    a: "No. An animal health certificate must be issued by an official vet. PetJet helps you find one, shares the right records with them and tracks the certificate's validity window in your plan.",
  },
  {
    q: "Which pets and routes are covered?",
    a: "Dogs, cats and ferrets travelling from Great Britain to France or Ireland, and dogs and cats from Great Britain to the United States, including the return journey. For any other pet or route we say clearly that it isn't supported yet.",
  },
  {
    q: "Why not just search online or ask a chatbot?",
    a: "Search gives you pages to read. PetJet gives you dated tasks in the right order, checks your documents against them and connects you with the vets, labs and flights that complete them.",
  },
  {
    q: "What if my travel date doesn't work?",
    a: "If a waiting period or validity window can't be met, your plan says the trip isn't ready, names the rule that blocks it and shows the earliest date your pet could travel.",
  },
  {
    q: "Who can see my pet's records?",
    a: "Only you, and the vets or labs you choose to share a record with. Sharing is per appointment and ends if the vet declines, and you can delete any document from your vault.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1fr_1.4fr]">
        <SectionHeading
          eyebrow="Questions"
          title="Good to know."
          description="Straight answers about what PetJet does, and what it doesn't."
        />
        <Reveal>
          <div className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-medium transition-colors hover:text-forest-700">
                  {q}
                  <ChevronDown className="size-4.5 shrink-0 text-ink-400 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="-mt-1 pb-5 text-sm leading-relaxed text-ink-500">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function CtaBand({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="relative overflow-hidden rounded-[28px] bg-forest-800 px-6 py-14 text-center text-cream-50 shadow-float sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="absolute -left-20 -top-24 size-72 rounded-full bg-forest-600/50 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-28 -right-10 size-80 rounded-full bg-tan-500/20 blur-3xl"
          />
          <h2 className="display-lg relative mx-auto max-w-2xl">{title}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[17px] text-sage-200">{body}</p>
          <div className="relative mt-8 flex justify-center">
            <ButtonLink href={href} size="lg" variant="accent" iconRight={<ArrowRight className="size-4" />}>
              {label}
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
