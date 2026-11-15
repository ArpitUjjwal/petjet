/*
 * Illustrative insurance offers from made-up insurers, to show how PetJet could compare cover.
 * Nothing here is a real quote or a real company.
 */

export type InsuranceOffer = {
  id: string;
  insurer: string;
  logo: string;
  plan: string;
  price: number;
  tag: string;
  recommended: boolean;
  summary: string;
  details: {
    vetFees: string;
    excess: string;
    documents: string;
    cancellation: string;
    liability: string;
    vetLine: string;
  };
  highlights: string[];
};

export const DETAIL_ROWS: { key: keyof InsuranceOffer["details"]; label: string }[] = [
  { key: "vetFees", label: "Vet fees abroad" },
  { key: "excess", label: "Excess per claim" },
  { key: "documents", label: "Lost documents & quarantine" },
  { key: "cancellation", label: "Trip cancellation" },
  { key: "liability", label: "Third-party liability" },
  { key: "vetLine", label: "24/7 vet video line" },
];

export function insuranceOffers(destination: string, species: string[]): InsuranceOffer[] {
  const us = destination === "US";
  const dog = species.length === 0 || species.includes("DOG");
  const where = us ? "the USA" : "Europe";
  return [
    {
      id: "harbour",
      insurer: "Harbour Pet Cover",
      logo: "/insurers/harbour.svg",
      plan: "Travel Essentials",
      price: us ? 38 : 19,
      tag: "Lowest price",
      recommended: false,
      summary: "The basics for a short trip.",
      details: {
        vetFees: us ? "£3,000" : "£2,000",
        excess: "£150",
        documents: "Up to £500",
        cancellation: "Not included",
        liability: dog ? "£1m" : "Not included",
        vetLine: "Not included",
      },
      highlights: ["Emergency vet treatment abroad", "Lost pet advertising and reward", "Quarantine costs if a document is rejected"],
    },
    {
      id: "meadow",
      insurer: "Meadow Mutual",
      logo: "/insurers/meadow.svg",
      plan: "Abroad Plus",
      price: us ? 64 : 34,
      tag: "Recommended",
      recommended: true,
      summary: `Strong cover for a typical trip to ${where}.`,
      details: {
        vetFees: us ? "£8,000" : "£5,000",
        excess: "£95",
        documents: "Up to £1,500",
        cancellation: "Up to £2,000",
        liability: dog ? "£2m" : "£1m",
        vetLine: "Included",
      },
      highlights: [
        `Higher vet cover for treatment in ${where}`,
        "Cancellation if your pet is too ill to travel",
        dog ? "Third-party liability for dogs, up to £2m" : "Boarding fees if you're hospitalised abroad",
        "24/7 vet video calls in English",
      ],
    },
    {
      id: "northstar",
      insurer: "Northstar Pet Travel",
      logo: "/insurers/northstar.svg",
      plan: "Complete Journey",
      price: us ? 92 : 49,
      tag: "Most cover",
      recommended: false,
      summary: "Everything covered, including delays.",
      details: {
        vetFees: us ? "£15,000" : "£10,000",
        excess: "£50",
        documents: "Up to £3,000",
        cancellation: "Up to £5,000",
        liability: "£3m",
        vetLine: "Included",
      },
      highlights: [
        "Everything in a mid-range plan",
        "Repeat documents and treatments if a trip is delayed",
        "Return travel for your pet if you can't bring them home",
      ],
    },
    {
      id: "paws",
      insurer: "Paws & Passports",
      logo: "/insurers/paws.svg",
      plan: "Annual Multi-Trip",
      price: us ? 129 : 79,
      tag: "Best for frequent travellers",
      recommended: false,
      summary: "One policy for every trip this year.",
      details: {
        vetFees: us ? "£10,000" : "£7,500",
        excess: "£75",
        documents: "Up to £2,000",
        cancellation: "Up to £3,000",
        liability: dog ? "£2m" : "£1m",
        vetLine: "Included",
      },
      highlights: ["Unlimited trips for 12 months, up to 45 days each", "Covers Europe and the USA", "Free policy changes when dates move"],
    },
  ];
}

export function findOffer(id: string | null | undefined, destination: string, species: string[]) {
  if (!id) return null;
  return insuranceOffers(destination, species).find((o) => o.id === id) ?? null;
}

/** A stable, obviously-sample policy reference for the confirmation card. */
export function samplePolicyNumber(tripId: string, offerId: string) {
  const tail = tripId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase().padStart(6, "0");
  return `SAMPLE-${offerId.slice(0, 3).toUpperCase()}-${tail}`;
}
