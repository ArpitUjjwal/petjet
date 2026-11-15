import { ArrowRight, CalendarClock, PartyPopper, Plane, Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AttentionTile, HeroTile } from "@/components/dashboard/bento";
import { JourneyStrip } from "@/components/dashboard/journey";
import { CostSummary } from "@/components/costs/cost-summary";
import { TripSwitcher } from "@/components/dashboard/trip-switcher";
import { InsurerLogo } from "@/components/insurance/insurance-picker";
import { PageHeader } from "@/components/shell/app-shell";
import { TripEditorProvider } from "@/components/trips/trip-editor";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { listDocuments } from "@/lib/documents/repository";
import { AIRLINES } from "@/lib/flights/core";
import { listBookings } from "@/lib/flights/repository";
import { findOffer } from "@/lib/insurance/offers";
import { formatDate, todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { attention, countdown, openTasks, petNames, pickTrip, readiness } from "@/lib/trips/dashboard";
import { tripCosts } from "@/lib/trips/cost-lines";
import { buildJourney, journeyComplete } from "@/lib/trips/journey";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { listTrips } from "@/lib/trips/repository";
import { buildTimeline } from "@/lib/trips/timeline";

export const metadata: Metadata = { title: "Home" };

export default async function OwnerHome({ searchParams }: PageProps<"/app">) {
  const user = await requireOwner();
  const today = todayISO();
  const { trip: requested } = await searchParams;
  const [trips, { rules }, docs] = await Promise.all([listTrips(user.id), loadRules(), listDocuments(user.id)]);
  const firstName = user.name.split(/\s+/)[0];
  const trip = pickTrip(trips, typeof requested === "string" ? requested : undefined, today);

  if (!trip) {
    return (
      <>
        <PageHeader title={`Welcome, ${firstName}.`} description="Your pet's travel plan will appear here." />
        <EmptyState
          icon={<Plane className="size-5" />}
          title="No trips yet"
          description="Tell us about your pet and where you're going. It takes about three minutes."
          action={
            <ButtonLink href="/plan" iconLeft={<Plus className="size-4" />}>
              Plan a trip
            </ButtonLink>
          }
        />
      </>
    );
  }

  const plan = planStoredTrip(trip, today, rules);
  const [bookings, costs] = await Promise.all([listBookings(user.id, trip.id), tripCosts(user.id, trip, today, rules)]);
  const ready = readiness(plan.pets);
  const pets = trip.pets.map((tp) => tp.pet);
  const names = petNames(pets);
  const timeline = buildTimeline(trip, plan.pets, today);
  const deadlines = timeline.entries.filter((e) => e.kind === "task" && e.state !== "advice").map((e) => e.date);
  const petIds = new Set(pets.map((p) => p.id));
  const toReview = docs.filter((d) => (d.status === "NEEDS_REVIEW" || d.status === "READY") && (!d.petId || petIds.has(d.petId)));
  const species = [...new Set(pets.map((p) => p.species))];
  const insurance = findOffer(trip.insuranceOffer, trip.destination, species);

  const steps = buildJourney({
    tripId: trip.id,
    petNames: names,
    plans: plan.pets,
    toReview: toReview.length,
    firstToReviewId: toReview.at(-1)?.id ?? null,
    legsNeeded: trip.returnDate ? 2 : 1,
    legsBooked: bookings.length,
    insurer: insurance?.insurer ?? null,
  });
  const complete = journeyComplete(steps);
  /* Only problems that stop the plan show on Home; due dates and documents are what the journey is for */
  const problems = attention(trip, plan.pets, today, toReview.length).filter((i) =>
    ["conflict", "unsupported", "overdue", "verify"].includes(i.kind),
  );
  /* Steps that can only happen later (e.g. the tapeworm dose before coming home) */
  const later = openTasks(plan.pets, today).map((m) => m.task).filter((t) => t.leg === "RETURN");

  const switcherTrips = trips.map((t) => ({
    id: t.id,
    origin: t.origin,
    destination: t.destination,
    title: routeTitle(t),
    subtitle: `${formatDate(t.arrivalDate)} · ${petNames(t.pets.map((p) => p.pet))}`,
    past: (t.returnDate ?? t.arrivalDate) < today,
  }));

  return (
    <TripEditorProvider trip={trip} rules={rules} today={today}>
      <PageHeader
        title={complete ? `${names} is ready to fly.` : `Hi ${firstName}, you're on track.`}
        description={complete ? "Everything is booked and checked. Have a lovely trip." : "Follow the steps below. We'll take care of the details."}
        action={trips.length > 1 ? <TripSwitcher trips={switcherTrips} currentId={trip.id} /> : undefined}
      />
      <div className="flex flex-col gap-5" data-testid="dashboard" data-trip={trip.id}>
        <HeroTile
          className=""
          trip={{ ...trip, pets: pets.map((p) => ({ id: p.id, name: p.name, species: p.species })) }}
          status={plan.status}
          count={countdown(trip, today)}
          today={today}
          deadlines={deadlines}
          ready={ready}
        />

        {problems.length > 0 && <AttentionTile items={problems} tripId={trip.id} firstPetId={pets[0]?.id} index={1} />}

        {complete ? (
          <section
            data-testid="ready-to-fly"
            className="animate-rise rounded-card border border-forest-800 bg-surface p-5 shadow-raised sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-ok-100 text-ok-700">
                <PartyPopper className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Ready to fly</h2>
                <p className="text-sm text-ink-500">Documents checked, certificate issued, flights booked and insured.</p>
              </div>
            </div>

            <ul className="mt-5 grid gap-3 md:grid-cols-3">
              {bookings.map((b) => {
                const a = AIRLINES[b.airline as keyof typeof AIRLINES];
                return (
                  <li key={b.id}>
                    <Link
                      href={`/app/flights/${b.id}`}
                      data-testid="dashboard-booking"
                      className="flex h-full flex-col gap-2 rounded-control border border-line p-4 hover:bg-cream-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {a?.logo && <img src={a.logo} alt={a.name} className="h-5 w-24 object-contain object-left" />}
                      <span className="tabular text-sm font-semibold">
                        {b.fromCode} {b.departTime} → {b.toCode} {b.arriveTime}
                      </span>
                      <span className="tabular text-xs text-ink-500">
                        {b.leg === "OUTBOUND" ? "Out" : "Home"} · {formatDate(b.departDate)} · {b.flightNumber}
                      </span>
                      <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-forest-800">
                        Boarding pass <ArrowRight className="size-3.5" />
                      </span>
                    </Link>
                  </li>
                );
              })}
              {insurance && (
                <li>
                  <Link
                    href={`/app/insurance?trip=${trip.id}`}
                    data-testid="dashboard-insurance"
                    className="flex h-full flex-col gap-2 rounded-control border border-line p-4 hover:bg-cream-50"
                  >
                    <InsurerLogo offer={insurance} className="h-8" />
                    <span className="text-sm font-semibold">{insurance.plan}</span>
                    <span className="text-xs text-ink-500">Vet fees up to {insurance.details.vetFees}</span>
                    <span className="mt-auto flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-forest-800">
                        <ShieldCheck className="size-3.5" /> Policy
                      </span>
                      <Badge tone="sample">Sample</Badge>
                    </span>
                  </Link>
                </li>
              )}
            </ul>

            {later.length > 0 && (
              <div className="mt-5 flex gap-3 rounded-control bg-cream-50 p-4 text-sm">
                <CalendarClock className="mt-0.5 size-4.5 shrink-0 text-forest-700" />
                <p>
                  <span className="font-semibold">While you&apos;re away: </span>
                  {later.map((t) => `${t.title.toLowerCase()}${t.window?.from ? ` (${formatDate(t.window.from)}–${formatDate(t.window.to ?? t.window.from)})` : ""}`).join("; ")}.
                  {" "}We&apos;ll remind you.
                </p>
              </div>
            )}
          </section>
        ) : (
          <JourneyStrip steps={steps} />
        )}

        <CostSummary costs={costs} href="/app/bookings#costs" />
      </div>
    </TripEditorProvider>
  );
}
