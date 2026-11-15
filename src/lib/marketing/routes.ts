/*
 * Summary of supported routes for public pages. Deliberately high level:
 * the detailed, dated rules with official links live in the rules database (Module 3).
 */
export type RouteSummary = {
  id: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  species: string[];
  headline: string;
  keyRequirements: string[];
  authority: string;
};

export const SUPPORTED_ROUTES: RouteSummary[] = [
  {
    id: "gb-fr",
    from: { code: "GB", name: "Great Britain" },
    to: { code: "FR", name: "France" },
    species: ["Dogs", "Cats", "Ferrets"],
    headline: "The classic first trip abroad.",
    keyRequirements: [
      "Microchip before rabies vaccination",
      "Rabies vaccination, then a 21-day wait",
      "Animal health certificate from an official vet",
    ],
    authority: "GOV.UK",
  },
  {
    id: "gb-ie",
    from: { code: "GB", name: "Great Britain" },
    to: { code: "IE", name: "Ireland" },
    species: ["Dogs", "Cats", "Ferrets"],
    headline: "EU rules, plus a tapeworm window for dogs.",
    keyRequirements: [
      "Microchip and rabies vaccination",
      "Animal health certificate from an official vet",
      "Dogs: tapeworm treatment 1 to 5 days before arrival",
    ],
    authority: "GOV.UK and Ireland's DAFM",
  },
  {
    id: "gb-us",
    from: { code: "GB", name: "Great Britain" },
    to: { code: "US", name: "United States" },
    species: ["Dogs", "Cats"],
    headline: "Long haul, with CDC rules for dogs.",
    keyRequirements: [
      "Dogs: at least 6 months old and microchipped",
      "Dogs: CDC Dog Import Form receipt",
      "Cats: no federal paperwork, but check state rules",
    ],
    authority: "US CDC and USDA",
  },
];
