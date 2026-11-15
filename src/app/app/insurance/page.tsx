import { ArrowRight, CalendarDays, Info, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { ChangeInsuranceButton, InsurancePicker, InsurerLogo } from "@/components/insurance/insurance-picker";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { findOffer, insuranceOffers, samplePolicyNumber } from "@/lib/insurance/offers";
import { formatDate, todayISO } from "@/lib/rules/dates";
import { petNames, pickTrip } from "@/lib/trips/dashboard";
import { countryLabel } from "@/lib/trips/options";
import { listTrips } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Insurance" };

export default async function InsurancePage({ searchParams }: PageProps<"/app/insurance">) {
  const user = await requireOwner();
  const { trip: requested, chosen: justChosen } = await searchParams;
  const trips = await listTrips(user.id);
  const trip = pickTrip(trips, typeof requested === "string" ? requested : undefined, todayISO());

  if (!trip) {
    return (
      <>
        <PageHeader title="Insurance" />
        <EmptyState title="No trip yet" description="Plan a trip to compare cover for your pet." action={<ButtonLink href="/plan">Plan a trip</ButtonLink>} />
      </>
    );
  }

  const species = [...new Set(trip.pets.map((p) => p.pet.species))];
  const names = petNames(trip.pets.map((p) => p.pet));
  const offers = insuranceOffers(trip.destination, species);
  const chosen = findOffer(trip.insuranceOffer, trip.destination, species);

  if (chosen) {
    return (
      <>
        <PageHeader title="Insurance" description={`${names} is covered for ${countryLabel(trip.destination)}.`} />
        <section
          data-testid="insurance-policy"
          className="mx-auto flex max-w-xl flex-col gap-5 rounded-card border border-forest-800 bg-surface p-6 shadow-raised"
        >
          {justChosen && (
            <p className="flex items-center gap-2 text-sm font-medium text-ok-700">
              <PartyPopper className="size-4" /> Cover chosen. One less thing to think about.
            </p>
          )}
          <div className="flex items-start justify-between gap-3">
            <InsurerLogo offer={chosen} className="h-12" />
            <Badge tone="sample">Sample, not a real policy</Badge>
          </div>
          <div>
            <p className="text-lg font-semibold">{chosen.plan}</p>
            <p className="text-sm text-ink-500">For {names}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-ink-500">Policy number</dt>
              <dd className="tabular font-medium">{samplePolicyNumber(trip.id, chosen.id)}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Price</dt>
              <dd className="tabular font-medium">£{chosen.price}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-500">Cover</dt>
              <dd className="flex items-center gap-1.5 font-medium">
                <CalendarDays className="size-4 text-ink-400" />
                {formatDate(trip.arrivalDate)} – {formatDate(trip.returnDate ?? trip.arrivalDate)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">Vet fees abroad</dt>
              <dd className="tabular font-medium">{chosen.details.vetFees}</dd>
            </div>
            <div>
              <dt className="text-ink-500">24/7 vet line</dt>
              <dd className="font-medium">{chosen.details.vetLine}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <ChangeInsuranceButton tripId={trip.id} />
            <ButtonLink href={`/app?trip=${trip.id}`} iconRight={<ArrowRight className="size-4" />}>
              Back to your journey
            </ButtonLink>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Insure ${names}`}
        description={`Four plans for ${countryLabel(trip.destination)}. We've picked the best fit — tap any card to compare.`}
      />
      <p className="mb-5 flex gap-2 text-[13px] text-ink-500">
        <Info className="mt-0.5 size-4 shrink-0 text-info-700" />
        Sample offers from made-up insurers, to show how PetJet compares cover. Not real quotes.
      </p>
      <InsurancePicker tripId={trip.id} offers={offers} petName={names} />
    </>
  );
}
