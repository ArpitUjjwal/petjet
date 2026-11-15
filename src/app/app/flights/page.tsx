import { ArrowRight, CheckCircle2, Info, Lock, Plane, PlaneLanding, PlaneTakeoff, Ticket, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookFlightButton } from "@/components/flights/flight-buttons";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import {
  AIRLINES,
  PLACEMENT_LABEL,
  POLICY_NOTE,
  canBookFlights,
  cityOf,
  durationLabel,
  flightEligibility,
  type Leg,
} from "@/lib/flights/core";
import { flightsForTrip, listBookings, petsForFlights } from "@/lib/flights/repository";
import { formatDate, todayISO } from "@/lib/rules/dates";
import { pickTrip } from "@/lib/trips/dashboard";
import { routeTitle } from "@/lib/trips/plan";
import { listTrips } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Flights" };

export default async function FlightsPage({ searchParams }: PageProps<"/app/flights">) {
  const user = await requireOwner();
  const sp = await searchParams;
  const today = todayISO();
  const [trips, account] = await Promise.all([
    listTrips(user.id),
    db.user.findUnique({ where: { id: user.id }, select: { plan: true } }),
  ]);
  const trip = pickTrip(trips, typeof sp.trip === "string" ? sp.trip : undefined, today);

  if (!trip) {
    return (
      <>
        <PageHeader title="Flights" description="Pet-friendly flights for your trip." />
        <EmptyState
          icon={<Plane className="size-5" />}
          title="Plan a trip first"
          description="We search flights for your trip's route and dates, and check each one against your pets."
          action={<ButtonLink href="/plan">Plan a trip</ButtonLink>}
        />
      </>
    );
  }

  const leg: Leg = sp.leg === "RETURN" && trip.returnDate ? "RETURN" : "OUTBOUND";
  const canBook = canBookFlights(account?.plan ?? "EXPLORE");
  const bookings = await listBookings(user.id, trip.id);
  const booked = bookings.find((b) => b.leg === leg);
  const flights = flightsForTrip(trip, leg);
  const pets = petsForFlights(trip);
  const here = `/app/flights?trip=${trip.id}&leg=${leg}`;
  const missingWeight = pets.filter((p) => p.weightKg === null);

  const legs = [
    { id: "OUTBOUND" as const, label: "Journey out", date: trip.arrivalDate, icon: PlaneTakeoff },
    ...(trip.returnDate ? [{ id: "RETURN" as const, label: "Journey home", date: trip.returnDate, icon: PlaneLanding }] : []),
  ];

  return (
    <>
      <PageHeader
        title={`Flights: ${routeTitle(trip)}`}
        description={`For ${pets.map((p) => p.name).join(" and ")}. Every flight is checked against each pet's species, weight and breed.`}
      />

      {sp.upgraded && (
        <Callout tone="ok" icon={<CheckCircle2 className="size-4.5" />} title="You're on the Complete plan" className="mb-6">
          Booking is unlocked. Payment was simulated; no money was taken.
        </Callout>
      )}

      {trips.length > 1 && (
        <nav aria-label="Trips" className="mb-4 flex flex-wrap gap-2">
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/app/flights?trip=${t.id}`}
              aria-current={t.id === trip.id ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium",
                t.id === trip.id ? "border-forest-800 bg-forest-800 text-cream-50" : "border-line-strong bg-surface text-ink-700 hover:bg-sage-50",
              )}
            >
              {routeTitle(t)} · {formatDate(t.arrivalDate)}
            </Link>
          ))}
        </nav>
      )}

      <nav aria-label="Journey" className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {legs.map(({ id, label, date, icon: Icon }) => (
          <Link
            key={id}
            href={`/app/flights?trip=${trip.id}&leg=${id}`}
            aria-current={id === leg ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-card border p-4 transition-colors",
              id === leg ? "border-forest-800 bg-forest-800 text-cream-50 shadow-raised" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <Icon className={cn("size-5", id === leg ? "text-tan-200" : "text-ink-400")} />
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className={cn("tabular block text-xs", id === leg ? "text-sage-300" : "text-ink-500")}>{formatDate(date)}</span>
            </span>
            {bookings.some((b) => b.leg === id) && (
              <Badge tone="ok" className="ml-auto">
                Booked
              </Badge>
            )}
          </Link>
        ))}
      </nav>

      {!canBook && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-tan-200 bg-tan-100 p-5" data-testid="upgrade-banner">
          <div className="flex gap-3">
            <Lock className="mt-0.5 size-5 shrink-0 text-tan-700" />
            <div>
              <p className="font-semibold">Searching is free. Booking is part of Complete.</p>
              <p className="mt-0.5 text-[13px] text-ink-700">Upgrade to book a flight that suits your pets and get the boarding pass in your plan.</p>
            </div>
          </div>
          <ButtonLink href={`/app/upgrade?next=${encodeURIComponent(here)}`} variant="accent" iconRight={<ArrowRight className="size-4" />}>
            Upgrade to book
          </ButtonLink>
        </div>
      )}

      {missingWeight.length > 0 && (
        <Callout tone="info" icon={<Info className="size-4.5" />} title="Add a weight for cabin checks" className="mb-6">
          We don&apos;t know {missingWeight.map((p) => p.name).join(" and ")}&apos;s weight, so we can only offer the hold.{" "}
          <Link href="/app/pets" className="font-medium text-forest-800 underline">
            Update in My pets
          </Link>
        </Callout>
      )}

      {booked ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-ok-700/20 bg-ok-100 p-5" data-testid="leg-booked">
          <div className="flex gap-3">
            <Ticket className="mt-0.5 size-5 shrink-0 text-ok-700" />
            <div>
              <p className="font-semibold text-ok-700">
                Booked: {AIRLINES[booked.airline as keyof typeof AIRLINES]?.name} {booked.flightNumber}
              </p>
              <p className="tabular mt-0.5 text-[13px] text-ink-700">
                {booked.fromCode} {booked.departTime} → {booked.toCode} {booked.arriveTime} · ref {booked.reference}
              </p>
            </div>
          </div>
          <ButtonLink href={`/app/flights/${booked.id}`} variant="secondary" iconRight={<ArrowRight className="size-4" />}>
            Boarding pass
          </ButtonLink>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3" aria-label="Flights">
        {flights.map((f) => {
          const airline = AIRLINES[f.airline];
          const check = flightEligibility(f, pets, trip.petPlacement);
          return (
            <li
              key={f.id}
              data-testid="flight"
              data-airline={f.airline}
              data-eligible={check.ok}
              className={cn("rounded-card border bg-surface p-4 shadow-card sm:p-5", check.ok ? "border-line" : "border-line opacity-80")}
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex w-36 shrink-0 flex-col gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={airline.logo} alt={airline.name} className="h-5 w-auto max-w-[130px] object-contain object-left" />
                  <span className="tabular text-xs text-ink-500">{f.flightNumber}</span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div>
                    <p className="tabular text-lg font-semibold">{f.depart}</p>
                    <p className="text-xs text-ink-500">
                      {f.from} · {cityOf(f.from)}
                    </p>
                  </div>
                  <div className="flex min-w-12 flex-1 flex-col items-center">
                    <span className="tabular text-[11px] text-ink-500">{durationLabel(f.durationMin)}</span>
                    <span className="h-px w-full border-t border-dashed border-line-strong" />
                    <span className="text-[11px] text-ink-400">Direct</span>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-lg font-semibold">
                      {f.arrive}
                      {f.dayOffset ? <sup className="ml-0.5 text-[10px] text-ink-500">+1</sup> : null}
                    </p>
                    <p className="text-xs text-ink-500">
                      {f.to} · {cityOf(f.to)}
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                  <p className="tabular text-right">
                    <span className="text-lg font-semibold">£{check.price}</span>
                    <span className="block text-[11px] text-ink-500">incl. pet fees · sample fare</span>
                  </p>
                  {!check.ok ? (
                    <Badge tone="neutral">Not possible</Badge>
                  ) : booked ? null : canBook ? (
                    <BookFlightButton tripId={trip.id} leg={leg} flightId={f.id} label={`Book ${f.flightNumber} at ${f.depart}`} />
                  ) : (
                    <ButtonLink size="sm" variant="secondary" href={`/app/upgrade?next=${encodeURIComponent(here)}`} iconLeft={<Lock className="size-3.5" />}>
                      Upgrade to book
                    </ButtonLink>
                  )}
                </div>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3" aria-label="Pet eligibility">
                {check.pets.map((p) => (
                  <li key={p.name} className="flex items-start gap-2 text-[13px]" data-testid="pet-eligibility">
                    {p.placement ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok-700" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-danger-700" />
                    )}
                    <span className="text-ink-700">
                      {p.placement && <span className="font-medium text-ink-900">{PLACEMENT_LABEL[p.placement]}. </span>}
                      {p.summary}
                    </span>
                  </li>
                ))}
              </ul>
              <details className="mt-2 text-[12px] text-ink-500 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none font-medium text-forest-800 hover:underline">{airline.name} pet policy</summary>
                <p className="mt-1">{airline.policy}</p>
                <p className="mt-1 italic">{POLICY_NOTE}</p>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
