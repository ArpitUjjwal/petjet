import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  Lock,
  Stethoscope,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Reveal, SectionHeading } from "@/components/marketing/reveal";
import { CtaBand } from "@/components/marketing/sections";
import { PublicShell } from "@/components/shell/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For vets & labs",
  description: "PetJet sends veterinary practices and pathology labs travel-ready clients with structured requests.",
};

function Point({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest-800">
        {icon}
      </span>
      <div>
        <h4 className="text-[15px] font-semibold">{title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">{body}</p>
      </div>
    </li>
  );
}

/* An illustrative incoming request card, built from the real design components. */
function RequestPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="absolute inset-0 rounded-[40px] sm:-inset-6 bg-[radial-gradient(circle_at_70%_20%,var(--color-sage-200),transparent_60%)]"
      />
      <div className="relative overflow-hidden rounded-card border border-line bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-line bg-cream-50 px-5 py-3.5">
          <p className="text-sm font-semibold">New appointment request</p>
          <Badge tone="sample">Example</Badge>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-tan-100 text-xs font-semibold text-tan-700">
              MK
            </span>
            <div>
              <p className="text-sm font-semibold">Milo · Cat, 3 years</p>
              <p className="text-xs text-ink-500">Owner: Mariyam K.</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-cream-50 p-4 text-[13px]">
            <div>
              <dt className="text-ink-500">Trip</dt>
              <dd className="font-medium">London → Paris</dd>
            </div>
            <div>
              <dt className="text-ink-500">Departs</dt>
              <dd className="tabular font-medium">15 Mar 2027</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-500">Service needed</dt>
              <dd className="font-medium">Animal health certificate (official vet)</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-500">Must be issued between</dt>
              <dd className="tabular font-medium">6 and 15 Mar 2027</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Badge tone="ok" icon={<FileCheck2 className="size-3.5" />}>
              Rabies record shared
            </Badge>
            <Badge tone="ok" icon={<BadgeCheck className="size-3.5" />}>
              Microchip matches
            </Badge>
          </div>
          <div className="flex gap-2 pt-1">
            <span className="inline-flex h-9 flex-1 items-center justify-center rounded-control bg-forest-800 text-sm font-medium text-cream-50">
              Offer a slot
            </span>
            <span className="inline-flex h-9 items-center justify-center rounded-control border border-line-strong px-4 text-sm font-medium text-ink-700">
              Decline
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForProvidersPage() {
  return (
    <PublicShell>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-20">
        <Reveal>
          <Badge tone="brand" dot>
            For veterinary practices and pathology labs
          </Badge>
          <h1 className="display-xl mt-6 text-forest-900">Clients who arrive prepared.</h1>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-500 sm:text-lg">
            Pet owners on PetJet come to you with a structured request: the pet, the trip, the
            service the rules require and the records they have chosen to share.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/provider/login" size="lg" iconRight={<ArrowRight className="size-4" />}>
              Provider login
            </ButtonLink>
            <ButtonLink href="#how-partners-work" size="lg" variant="secondary">
              How it works for you
            </ButtonLink>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <RequestPreview />
        </Reveal>
      </section>

      <section className="border-y border-line bg-cream-50 py-20 sm:py-28">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-2">
          <Reveal>
            <article
              data-testid="audience-vets"
              className="h-full rounded-card border border-line bg-surface p-7 shadow-card"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-forest-800 text-cream-50">
                <Stethoscope className="size-5" />
              </span>
              <h2 className="mt-6 text-2xl font-semibold">Veterinary practices</h2>
              <ul className="mt-6 flex flex-col gap-5">
                <Point
                  icon={<CalendarCheck className="size-4.5" />}
                  title="Requests with the service already identified"
                  body="Vaccinations, tapeworm treatment and health certificates, with the date window they must fall in."
                />
                <Point
                  icon={<ClipboardList className="size-4.5" />}
                  title="Record what you did, once"
                  body="Record treatments and certificates and the owner's plan updates itself."
                />
                <Point
                  icon={<FlaskConical className="size-4.5" />}
                  title="Order lab tests in the same place"
                  body="Send a test order to a partner lab and see the result when it is posted."
                />
              </ul>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article
              data-testid="audience-labs"
              className="h-full rounded-card border border-line bg-surface p-7 shadow-card"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-tan-500 text-forest-950">
                <FlaskConical className="size-5" />
              </span>
              <h2 className="mt-6 text-2xl font-semibold">Pathology labs</h2>
              <ul className="mt-6 flex flex-col gap-5">
                <Point
                  icon={<ClipboardList className="size-4.5" />}
                  title="A clear queue of test orders"
                  body="Rabies antibody tests and pre-travel health screens, with the pet and requesting vet attached."
                />
                <Point
                  icon={<FileCheck2 className="size-4.5" />}
                  title="Post results that reach everyone who needs them"
                  body="Results update the owner's plan and notify the requesting vet."
                />
                <Point
                  icon={<Lock className="size-4.5" />}
                  title="Only what you need to see"
                  body="Labs see the order and sample details, never the owner's wider records."
                />
              </ul>
            </article>
          </Reveal>
        </div>
      </section>

      <section id="how-partners-work" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="The partner pilot"
            title="Simple to join, honest about what's live."
            align="center"
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <Users className="size-5" />,
                title: "Free onboarding",
                body: "Initial partner practices and labs join at no cost while we prove the value to owners and to you.",
              },
              {
                icon: <BadgeCheck className="size-5" />,
                title: "Credentials checked",
                body: "We confirm your registration so owners are matched to providers authorised for the service they need.",
              },
              {
                icon: <Lock className="size-5" />,
                title: "Owner-controlled sharing",
                body: "You see only the records an owner chooses to share with you, and they can withdraw access.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <div className="h-full rounded-card border border-line bg-surface p-6 shadow-card">
                  <span className="grid size-10 place-items-center rounded-xl bg-sage-100 text-forest-800">
                    {item.icon}
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] text-ink-500">
            In this demo, appointment slots are simulated and provider accounts are pre-created.
            Live calendar integration needs a connection to your practice system.
          </p>
        </div>
      </section>

      <CtaBand
        title="Already a PetJet partner?"
        body="Log in to see appointment requests, shared records and lab orders."
        href="/provider/login"
        label="Provider login"
      />
    </PublicShell>
  );
}
