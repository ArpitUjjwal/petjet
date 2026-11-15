import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { ETicket } from "@/components/ui/e-ticket";
import { Callout } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { AIRLINES, PLACEMENT_LABEL, cityOf, durationLabel, type Placement } from "@/lib/flights/core";
import { getBooking } from "@/lib/flights/repository";
import { formatDate } from "@/lib/rules/dates";
import { routeTitle } from "@/lib/trips/plan";

export const metadata: Metadata = { title: "Boarding pass" };

function beforeYouFly(placement: Placement, intoGB: boolean) {
  const list = [
    placement === "CABIN"
      ? "Use a soft, leak-proof bag that fits under the seat in front, and keep your pet in it for the whole flight."
      : "Use an IATA-compliant crate big enough for your pet to stand up and turn around, with water attached.",
    placement === "CARGO"
      ? "Drop your pet at the cargo terminal at least 3 hours before departure; the airline's cargo team confirms the time."
      : "Arrive at check-in at least 2 hours before departure and tell the desk you're travelling with a pet.",
    "Carry the animal health certificate, vaccination record and microchip details in your hand luggage.",
  ];
  if (intoGB) list.push("On arrival in Great Britain your pet is checked at the airport's animal reception centre before release.");
  return list;
}

export default async function BookingPage({ params, searchParams }: PageProps<"/app/flights/[id]">) {
  const user = await requireOwner();
  const { id } = await params;
  const { booked } = await searchParams;
  const b = await getBooking(user.id, id);
  if (!b) notFound();
  const airline = AIRLINES[b.airline as keyof typeof AIRLINES];
  const placement = b.placement as Placement;
  const pets = b.trip.pets.map((p) => p.pet.name).join(" & ");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href={`/app/flights?trip=${b.tripId}&leg=${b.leg}`} className="hover:text-forest-800 hover:underline">
          Flights
        </Link>{" "}
        / <span className="text-ink-900">{b.flightNumber}</span>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold sm:text-[28px]">Your boarding pass</h1>
        <p className="mt-1 text-sm text-ink-500">
          {b.leg === "OUTBOUND" ? "Journey out" : "Journey home"} · {routeTitle(b.trip)}
        </p>
      </div>

      {booked && (
        <Callout tone="ok" icon={<CheckCircle2 className="size-4.5" />} title="Flight booked">
          A simulated booking for the demo: no seat is held and nothing was charged.
          {b.leg === "OUTBOUND" ? " Your trip's airports have been updated." : placement === "CARGO" ? " Your approved route home is now ticked off." : ""}
        </Callout>
      )}

      <div data-testid="e-ticket">
        <ETicket
          ticket={{
            airline: airline?.name ?? b.airline,
            airlineLogoSrc: airline?.logo,
            flightNumber: b.flightNumber,
            from: { code: b.fromCode, city: cityOf(b.fromCode), time: b.departTime },
            to: { code: b.toCode, city: cityOf(b.toCode), time: b.arriveTime },
            date: formatDate(b.departDate),
            duration: durationLabel(b.durationMin),
            passenger: b.owner.name,
            pet: pets,
            petPlacement: PLACEMENT_LABEL[placement] ?? b.placement,
            bookingRef: b.reference,
          }}
        />
      </div>

      <section aria-label="Before you fly" className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ClipboardCheck className="size-5 text-forest-800" /> Before you fly with {airline?.name}
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-700">
          {beforeYouFly(placement, b.leg === "RETURN").map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="tabular mt-4 text-[13px] text-ink-500">Sample fare £{b.priceGbp}, including pet fees.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/app/trips/${b.tripId}`} iconRight={<ArrowRight className="size-4" />}>
          Back to the checklist
        </ButtonLink>
        {b.leg === "OUTBOUND" && b.trip.returnDate && (
          <ButtonLink href={`/app/flights?trip=${b.tripId}&leg=RETURN`} variant="secondary">
            Book the journey home
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
