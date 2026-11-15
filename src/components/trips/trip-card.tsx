import { CalendarDays, Plane } from "lucide-react";
import Link from "next/link";
import { SpeciesIcon } from "@/components/pets/species-icon";
import { diffDays, formatDate } from "@/lib/rules/dates";
import type { TripStatus } from "@/lib/trips/plan";
import { TripStatusBadge } from "./trip-status";

export function TripCard({
  trip,
  status,
  today,
}: {
  trip: {
    id: string;
    origin: string;
    destination: string;
    arrivalDate: string;
    returnDate: string | null;
    pets: { pet: { id: string; name: string; species: string } }[];
  };
  status: TripStatus;
  today: string;
}) {
  const days = diffDays(trip.arrivalDate, today);
  return (
    <Link
      href={`/app/trips/${trip.id}`}
      data-testid="trip-card"
      className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-raised"
    >
      <div className="flex items-center gap-2.5">
        <span className="tabular rounded-lg bg-forest-800 px-2 py-1 font-mono text-xs font-semibold text-cream-50">
          {trip.origin}
        </span>
        <span className="h-px flex-1 border-t border-dashed border-line-strong" />
        <Plane className="size-4 text-tan-600" />
        <span className="h-px flex-1 border-t border-dashed border-line-strong" />
        <span className="tabular rounded-lg bg-tan-100 px-2 py-1 font-mono text-xs font-semibold text-tan-700">
          {trip.destination}
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold group-hover:text-forest-800">
            <CalendarDays className="size-4 text-ink-400" />
            <span className="tabular">{formatDate(trip.arrivalDate)}</span>
          </p>
          <p className="tabular mt-0.5 text-xs text-ink-500">
            {days > 0 ? `${days} days to go` : days === 0 ? "Today" : "Trip date has passed"}
            {trip.returnDate ? ` · home ${formatDate(trip.returnDate)}` : " · one way so far"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-[13px] text-ink-700">
          {trip.pets.map(({ pet }) => (
            <span key={pet.id} className="inline-flex items-center gap-1">
              <SpeciesIcon species={pet.species} className="size-3.5 text-tan-600" />
              {pet.name}
            </span>
          ))}
        </span>
        <TripStatusBadge status={status} />
      </div>
    </Link>
  );
}
