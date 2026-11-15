import { Check, HeartPulse, Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { pickTrip } from "@/lib/trips/dashboard";
import { SPECIES_NAME } from "@/lib/trips/format";
import { countryLabel } from "@/lib/trips/options";
import { listTrips } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Insurance" };

/* Illustrative offers from made-up insurers. Nothing here is a real quote or a real company. */
function offers(destination: string, species: string[]) {
  const us = destination === "US";
  const dog = species.includes("DOG");
  return [
    {
      name: "Harbour Pet Cover",
      plan: "Travel Essentials",
      price: us ? 38 : 19,
      tag: "Lowest price",
      vetCover: us ? "£3,000" : "£2,000",
      points: ["Emergency vet treatment abroad", "Lost pet advertising and reward", "Quarantine costs if a document is rejected"],
    },
    {
      name: "Meadow Mutual",
      plan: "Abroad Plus",
      price: us ? 64 : 34,
      tag: "Recommended",
      vetCover: us ? "£8,000" : "£5,000",
      points: [
        "Higher vet cover for the cost of treatment" + (us ? " in the USA" : " in Europe"),
        "Cancellation if your pet is too ill to travel",
        dog ? "Third-party liability for dogs, up to £2m" : "Boarding fees if you're hospitalised abroad",
      ],
    },
    {
      name: "Northstar Pet Travel",
      plan: "Complete Journey",
      price: us ? 92 : 49,
      tag: "Most cover",
      vetCover: us ? "£15,000" : "£10,000",
      points: ["Everything in Abroad Plus", "Repeat documents and treatments if a trip is delayed", "24/7 vet video calls in English"],
    },
  ];
}

export default async function InsurancePage() {
  const user = await requireOwner();
  const trips = await listTrips(user.id);
  const trip = pickTrip(trips, undefined, todayISO());
  const species = trip ? [...new Set(trip.pets.map((p) => p.pet.species))] : ["DOG"];
  const dest = trip?.destination ?? "FR";
  const list = offers(dest, species);

  return (
    <>
      <PageHeader
        title="Insurance"
        description={
          trip
            ? `Cover ideas for ${trip.pets.map((p) => p.pet.name).join(" and ")} travelling to ${countryLabel(dest)}.`
            : "Cover ideas for pets travelling abroad."
        }
      />
      <div className="mb-6 flex gap-3 rounded-card border border-line bg-cream-50 p-4 text-[13px] text-ink-700">
        <Info className="mt-0.5 size-4 shrink-0 text-info-700" />
        <p>
          These are <strong>illustrative sample offers</strong> from made-up insurers, to show how PetJet could compare cover.
          They aren&apos;t quotes, and PetJet doesn&apos;t sell insurance. Check that any policy covers{" "}
          {species.map((s) => SPECIES_NAME[s]?.toLowerCase() ?? s).join(" and ")}s abroad before you buy.
        </p>
      </div>
      <ul className="grid gap-4 lg:grid-cols-3" aria-label="Sample offers">
        {list.map((o) => (
          <li key={o.name} data-testid="insurance-offer" className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <span className="grid size-11 place-items-center rounded-2xl bg-sage-100 text-forest-800">
                {o.tag === "Most cover" ? <ShieldCheck className="size-5" /> : <HeartPulse className="size-5" />}
              </span>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Badge tone={o.tag === "Recommended" ? "brand" : "neutral"}>{o.tag}</Badge>
                <Badge tone="sample">Sample</Badge>
              </div>
            </div>
            <p className="mt-4 font-semibold">{o.name}</p>
            <p className="text-sm text-ink-500">{o.plan}</p>
            <p className="tabular mt-4 text-3xl font-semibold tracking-tight">
              £{o.price}
              <span className="ml-1 text-sm font-normal text-ink-500">per trip</span>
            </p>
            <p className="tabular mt-1 text-[13px] text-ink-500">Vet fees abroad up to {o.vetCover}</p>
            <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
              {o.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-forest-800" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-control bg-cream-200 px-3 py-2 text-center text-[13px] font-medium text-ink-500">
              Illustrative only, not available to buy
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
