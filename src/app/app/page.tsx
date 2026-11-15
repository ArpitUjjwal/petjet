import { Plane, Plus } from "lucide-react";
import type { Metadata } from "next";
import {
  AttentionTile,
  FlightsTile,
  HeroTile,
  NextStepTile,
  PetsTile,
  ReadinessTile,
  TimelineTile,
} from "@/components/dashboard/bento";
import { TripSwitcher } from "@/components/dashboard/trip-switcher";
import { PageHeader } from "@/components/shell/app-shell";
import { TripEditorProvider } from "@/components/trips/trip-editor";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { formatDate, todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { attention, countdown, openTasks, petNames, pickTrip, readiness } from "@/lib/trips/dashboard";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { countToReview } from "@/lib/documents/repository";
import { AIRLINES } from "@/lib/flights/core";
import { listBookings } from "@/lib/flights/repository";
import { listTrips } from "@/lib/trips/repository";
import { buildTimeline } from "@/lib/trips/timeline";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OwnerHome({ searchParams }: PageProps<"/app">) {
  const user = await requireOwner();
  const today = todayISO();
  const { trip: requested } = await searchParams;
  const [trips, { rules }, toReview] = await Promise.all([listTrips(user.id), loadRules(), countToReview(user.id)]);
  const firstName = user.name.split(/\s+/)[0];
  const trip = pickTrip(trips, typeof requested === "string" ? requested : undefined, today);

  const planAction = (
    <ButtonLink href="/plan" variant="secondary" iconLeft={<Plus className="size-4" />}>
      Plan a trip
    </ButtonLink>
  );

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
  const bookings = await listBookings(user.id, trip.id);
  const ready = readiness(plan.pets);
  const [next = null, ...then] = openTasks(plan.pets, today);
  const items = attention(trip, plan.pets, today, toReview);
  const timeline = buildTimeline(trip, plan.pets, today);
  const deadlines = timeline.entries.filter((e) => e.kind === "task" && e.state !== "advice").map((e) => e.date);
  const pets = trip.pets.map((tp) => tp.pet);

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
        title={`Welcome, ${firstName}.`}
        description={trips.length > 1 ? `You have ${trips.length} trips planned.` : "Here's where your trip stands."}
        action={
          <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center">
            {planAction}
            {trips.length > 1 && <TripSwitcher trips={switcherTrips} currentId={trip.id} />}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6" data-testid="dashboard" data-trip={trip.id}>
        <HeroTile
          trip={{ ...trip, pets: pets.map((p) => ({ id: p.id, name: p.name, species: p.species })) }}
          status={plan.status}
          count={countdown(trip, today)}
          today={today}
          deadlines={deadlines}
        />
        <ReadinessTile data={ready} index={1} />
        <NextStepTile
          next={next}
          then={then.slice(0, 3)}
          status={plan.status}
          tripId={trip.id}
          today={today}
          records={trip.taskRecords}
          index={2}
        />
        <AttentionTile items={items} tripId={trip.id} firstPetId={pets[0]?.id} index={3} />
        <TimelineTile entries={timeline.entries} tripId={trip.id} showPets={pets.length > 1} today={today} index={4} />
        <PetsTile
          index={5}
          pets={pets.map((p) => {
            const r = ready.perPet.find((x) => x.id === p.id)!;
            return { id: p.id, name: p.name, species: p.species, breed: p.breed, status: r.status, done: r.done, total: r.total };
          })}
        />
        <FlightsTile
          index={6}
          tripId={trip.id}
          bookings={bookings.map((b) => {
            const a = AIRLINES[b.airline as keyof typeof AIRLINES];
            return {
              id: b.id,
              leg: b.leg,
              airlineName: a?.name ?? b.airline,
              logo: a?.logo,
              flightNumber: b.flightNumber,
              from: b.fromCode,
              to: b.toCode,
              date: b.departDate,
              depart: b.departTime,
              arrive: b.arriveTime,
            };
          })}
        />
      </div>
    </TripEditorProvider>
  );
}
