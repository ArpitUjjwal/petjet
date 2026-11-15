import { Plane, Plus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { TripCard } from "@/components/trips/trip-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { planStoredTrip } from "@/lib/trips/plan";
import { listTrips } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Trip plan" };

export default async function TripsPage() {
  const user = await requireOwner();
  const today = todayISO();
  const [trips, { rules }] = await Promise.all([listTrips(user.id), loadRules()]);
  /* "Trip plan" in the menu: with one trip, go straight to its plan */
  if (trips.length === 1) redirect(`/app/trips/${trips[0].id}`);

  return (
    <>
      <PageHeader
        title="Your trips"
        description="Choose a trip to see its plan."
        action={
          trips.length > 0 ? (
            <ButtonLink href="/plan" iconLeft={<Plus className="size-4" />}>
              Plan a trip
            </ButtonLink>
          ) : undefined
        }
      />
      {trips.length === 0 ? (
        <EmptyState
          icon={<Plane className="size-5" />}
          title="No trips yet"
          description="Tell us where your pet is going and we'll build a dated plan from the official rules."
          action={
            <ButtonLink href="/plan" iconLeft={<Plus className="size-4" />}>
              Plan a trip
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard
                trip={trip}
                today={today}
                status={planStoredTrip(trip, today, rules).status}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
