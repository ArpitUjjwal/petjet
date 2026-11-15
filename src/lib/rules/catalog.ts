import type { Rule } from "./types";

/*
 * Verified pet travel rules for PetJet's supported routes.
 *
 * Each rule was checked against the linked official page on the date in `lastVerified`.
 * Bump `version` and `lastVerified` whenever a rule is re-checked or changed; the seed
 * script writes these into the database, which keeps the audit trail.
 *
 * NEEDS_REVIEW marks guidance PetJet could not fully confirm. The engine shows those
 * as advisory checks only and never treats them as legal requirements.
 */

export const LAST_VERIFIED = "2026-11-15";

const GOV_UK_ABROAD = "https://www.gov.uk/taking-your-pet-abroad";
const GOV_UK_TO_GB = "https://www.gov.uk/bring-pet-to-great-britain";
const GOV_IE_GB =
  "https://assets.gov.ie/static/documents/09fe3ad4/1._changes-to-the-rules-for-pet-travel-cats-dogs-ferrets-between-ireland-and-GB_update_22.4.26.pdf";
const FR_CUSTOMS = "https://www.douane.gouv.fr/fiche/travel-coming-france-your-pet";
const CDC_DOGS_LOW_RISK = "https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html";
const CDC_CATS = "https://www.cdc.gov/importation/bringing-an-animal-into-the-united-states/cats.html";

const src = {
  govUkAbroad: { name: "GOV.UK: Taking your pet abroad", url: GOV_UK_ABROAD },
  govUkMicrochip: { name: "GOV.UK: Microchip", url: `${GOV_UK_ABROAD}/microchip` },
  govUkRabies: {
    name: "GOV.UK: Rabies vaccinations and boosters",
    url: `${GOV_UK_ABROAD}/rabies-vaccinations-and-boosters`,
  },
  govUkAhc: {
    name: "GOV.UK: Getting an animal health certificate",
    url: `${GOV_UK_ABROAD}/getting-an-animal-health-certificate`,
  },
  govUkTapewormOut: {
    name: "GOV.UK: Tapeworm treatment for dogs",
    url: `${GOV_UK_ABROAD}/tapeworm-treatment-for-dogs`,
  },
  govUkNonEu: {
    name: "GOV.UK: Travelling to a non-EU country",
    url: `${GOV_UK_ABROAD}/travelling-to-a-noneu-country`,
  },
  govUkToGb: { name: "GOV.UK: Bringing your pet to Great Britain", url: GOV_UK_TO_GB },
  govUkToGbRabies: {
    name: "GOV.UK: Rabies vaccination and boosters (entering GB)",
    url: `${GOV_UK_TO_GB}/rabies-vaccination-and-boosters`,
  },
  govUkToGbDocument: {
    name: "GOV.UK: Which pet travel document you need",
    url: `${GOV_UK_TO_GB}/which-pet-travel-document`,
  },
  govUkToGbCertificate: {
    name: "GOV.UK: Great Britain pet health certificate",
    url: `${GOV_UK_TO_GB}/great-britain-pet-health-certificate`,
  },
  govUkToGbTapeworm: {
    name: "GOV.UK: Tapeworm treatment for dogs (entering GB)",
    url: `${GOV_UK_TO_GB}/tapeworm-treatment-dogs`,
  },
  govUkToGbRoutes: { name: "GOV.UK: Approved travel routes", url: `${GOV_UK_TO_GB}/travel-routes-pets` },
  govIe: { name: "gov.ie (DAFM): Pet travel between Ireland and GB, updated 22 Apr 2026", url: GOV_IE_GB },
  frCustoms: { name: "French Customs: Travelling to France with your pet", url: FR_CUSTOMS },
  cdcDogs: { name: "CDC: Dogs from rabies-free or low-risk countries", url: CDC_DOGS_LOW_RISK },
  cdcCats: { name: "CDC: Bringing a cat into the United States", url: CDC_CATS },
};

const EU_ROUTES = ["GB-FR", "GB-IE"];
const RETURN_ROUTES = ["FR-GB", "IE-GB", "US-GB"];
const ALL = ["DOG", "CAT", "FERRET"] as const;

function rule(r: Omit<Rule, "version" | "lastVerified" | "reviewStatus"> & Partial<Rule>): Rule {
  return { version: 1, lastVerified: LAST_VERIFIED, reviewStatus: "VERIFIED", ...r, species: [...r.species] };
}

export const RULES: Rule[] = [
  /* ---------- Great Britain to the EU (France, Ireland) ---------- */
  rule({
    id: "GB-EU-MICROCHIP",
    routes: EU_ROUTES,
    species: [...ALL],
    title: "Microchip before rabies vaccination",
    summary:
      "Your pet must be microchipped before, or at the same time as, its rabies vaccination. If the vaccination came first, it must be given again.",
    sources: [src.govUkMicrochip, src.frCustoms],
    params: { mustPrecedeRabies: true, standard: "ISO 11784/11785" },
  }),
  rule({
    id: "GB-EU-RABIES",
    routes: EU_ROUTES,
    species: [...ALL],
    title: "Rabies vaccination and 21-day wait",
    summary:
      "Your pet must be at least 12 weeks old when vaccinated. After a first vaccination, wait at least 21 full days before travelling (day 1 is the day after the vaccination). No wait is needed after a booster given with no break in cover.",
    sources: [src.govUkRabies, src.frCustoms],
    params: { minAgeDays: 84, waitFullDays: 21 },
  }),
  rule({
    id: "GB-EU-AHC",
    routes: EU_ROUTES,
    species: [...ALL],
    title: "Animal health certificate from an official vet",
    summary:
      "An official vet must issue an animal health certificate for each trip. It is valid for entry to the EU for 10 days (the issue date is day 1), then for onward EU travel and for return to Great Britain for 6 months. You also sign a declaration that you won't sell or rehome your pet.",
    sources: [src.govUkAhc],
    params: { entryValidityDays: 10, reentryValidityMonths: 6, maxPetsPerCertificate: 5 },
  }),
  rule({
    id: "GB-EU-PET-LIMIT",
    routes: [...EU_ROUTES, "GB-US"],
    species: [...ALL],
    title: "No more than 5 pets",
    summary:
      "Non-commercial travel covers up to 5 pets. More than 5 is treated as a commercial movement unless you are attending a competition, show or sporting event.",
    sources: [src.govUkAbroad, src.frCustoms],
    params: { maxPets: 5 },
  }),
  rule({
    id: "GB-EU-ACCOMPANIED",
    routes: [...EU_ROUTES],
    species: [...ALL],
    title: "Pet travels with you or someone you authorise",
    summary:
      "Your pet must travel with you, or with a person you authorise in writing who travels within 5 days of your own journey. Otherwise it is a commercial movement.",
    sources: [src.govUkAbroad],
    params: { withinDays: 5 },
  }),

  /* ---------- France ---------- */
  rule({
    id: "FR-MIN-AGE",
    routes: ["GB-FR"],
    species: [...ALL],
    title: "At least 16 weeks old on arrival in France",
    summary: "Bringing a dog, cat or ferret younger than 16 weeks into France is prohibited, even if vaccinated.",
    sources: [src.frCustoms],
    params: { minAgeDays: 112 },
  }),
  rule({
    id: "FR-DOG-CATEGORY",
    routes: ["GB-FR"],
    species: ["DOG"],
    title: "Restricted dog breeds",
    summary:
      "Category 1 dogs cannot enter France: dogs of Staffordshire terrier, American Staffordshire terrier, Mastiff (Boerboel) or Tosa type without a pedigree recognised by the French Ministry of Agriculture. Dogs of these breeds with a recognised pedigree are Category 2: carry the pedigree, and keep them muzzled and on a lead in public.",
    sources: [src.frCustoms],
    params: {
      breedPatterns: [
        "american staffordshire",
        "staffordshire terrier",
        "amstaff",
        "pit bull",
        "pitbull",
        "boerboel",
        "boerbull",
        "tosa",
      ],
      excludedPatterns: ["staffordshire bull terrier"],
      /* Pit bull types cannot hold a recognised pedigree */
      noPedigreePossible: ["pit bull", "pitbull"],
    },
  }),

  /* ---------- Ireland ---------- */
  rule({
    id: "IE-TAPEWORM",
    routes: ["GB-IE"],
    species: ["DOG"],
    title: "Tapeworm treatment for dogs, 1 to 5 days before arrival",
    summary:
      "A vet must treat your dog against Echinococcus multilocularis tapeworm (with praziquantel) no less than 24 hours and no more than 120 hours before you arrive in Ireland, and record it on the certificate.",
    sources: [src.govIe, src.govUkTapewormOut],
    params: { minHours: 24, maxHours: 120 },
  }),
  rule({
    id: "IE-ENTRY-POINT",
    routes: ["GB-IE"],
    species: [...ALL],
    title: "Arrive through an approved point of entry",
    summary:
      "Pets from Great Britain may only enter Ireland through Dublin Airport, Shannon Airport, Cork Airport, Dublin Port, Rosslare Port or the Port of Cork at Ringaskiddy.",
    sources: [src.govIe],
    params: { airports: ["DUB", "SNN", "ORK"] },
  }),
  rule({
    id: "IE-ADVANCE-NOTICE",
    routes: ["GB-IE"],
    species: [...ALL],
    title: "Tell the point of entry before you arrive",
    summary: "Give advance notice of your pet's arrival to the Irish point of entry you will use.",
    sources: [src.govIe],
    params: {},
  }),

  /* ---------- United States ---------- */
  rule({
    id: "US-DOG-AGE",
    routes: ["GB-US"],
    species: ["DOG"],
    title: "Dogs must be at least 6 months old",
    summary: "Dogs must be at least 6 months old when they enter the United States.",
    sources: [src.cdcDogs],
    params: { minAgeMonths: 6 },
  }),
  rule({
    id: "US-DOG-MICROCHIP",
    routes: ["GB-US"],
    species: ["DOG"],
    title: "Microchip readable by a universal scanner",
    summary: "Dogs must have a microchip that a universal scanner can detect.",
    sources: [src.cdcDogs],
    params: {},
  }),
  rule({
    id: "US-DOG-IMPORT-FORM",
    routes: ["GB-US"],
    species: ["DOG"],
    title: "CDC Dog Import Form receipt",
    summary:
      "Complete the free CDC Dog Import Form for each dog, up to 6 months before travel (a few days before is recommended). The receipt is valid for 6 months and is the only document CDC requires for dogs from rabies-free or low-risk countries such as the UK.",
    sources: [src.cdcDogs],
    params: { maxMonthsBefore: 6 },
  }),
  rule({
    id: "US-DOG-HEALTHY",
    routes: ["GB-US"],
    species: ["DOG"],
    title: "Dogs must look healthy on arrival",
    summary: "Dogs must appear healthy when they arrive in the United States.",
    sources: [src.cdcDogs],
    params: {},
  }),
  rule({
    id: "US-CAT",
    routes: ["GB-US"],
    species: ["CAT"],
    title: "Cats: no federal import paperwork",
    summary:
      "CDC does not require a health certificate or proof of rabies vaccination for cats, but cats are inspected on arrival, and airlines or US states may set their own rules.",
    sources: [src.cdcCats],
    params: {},
  }),
  rule({
    id: "GB-EXPORT-NON-EU",
    routes: ["GB-US"],
    species: ["DOG", "CAT"],
    title: "Check whether you need an export health certificate",
    summary:
      "GOV.UK says pets going to non-EU countries need an export health certificate from an official vet. US entry rules for UK dogs and cats don't ask for one, so confirm with your official vet before you book.",
    sources: [src.govUkNonEu, src.cdcDogs],
    reviewStatus: "NEEDS_REVIEW",
    params: {},
  }),

  /* ---------- Return to Great Britain ---------- */
  rule({
    id: "GB-ENTRY-MICROCHIP-RABIES",
    routes: RETURN_ROUTES,
    species: [...ALL],
    title: "Microchip and valid rabies vaccination to re-enter",
    summary:
      "To enter Great Britain your pet must be microchipped before its rabies vaccination, and the vaccination must still be valid, with the 21-day wait complete after a first vaccination.",
    sources: [src.govUkToGbRabies, src.govUkRabies],
    params: { waitFullDays: 21, minAgeDays: 84 },
  }),
  rule({
    id: "GB-ENTRY-DOCUMENT-EU",
    routes: ["FR-GB", "IE-GB"],
    species: [...ALL],
    title: "Return from the EU with your animal health certificate",
    summary:
      "From an EU country, an animal health certificate issued in Great Britain in the last 6 months is accepted for re-entry. For a longer stay you need another accepted document, such as a Great Britain pet health certificate.",
    sources: [src.govUkToGbDocument, src.govUkAhc],
    params: { ahcReentryMonths: 6 },
  }),
  rule({
    id: "GB-ENTRY-CERTIFICATE",
    routes: ["US-GB", "FR-GB", "IE-GB"],
    species: [...ALL],
    title: "Great Britain pet health certificate",
    summary:
      "An official vet abroad signs a Great Britain pet health certificate. Your pet must enter Great Britain within 10 days of it being issued. This is the accepted document when returning from the USA.",
    sources: [src.govUkToGbCertificate, src.govUkToGbDocument],
    params: { entryValidityDays: 10 },
  }),
  rule({
    id: "GB-ENTRY-TAPEWORM",
    routes: RETURN_ROUTES,
    species: ["DOG"],
    title: "Tapeworm treatment before returning to Great Britain",
    summary:
      "A vet must treat your dog for tapeworm no less than 24 hours and no more than 5 days (120 hours) before you enter Great Britain. Not needed when coming directly from Ireland, Northern Ireland, Finland, Malta or Norway. Treat your dog again within 28 days of getting home.",
    sources: [src.govUkToGbTapeworm, src.govUkTapewormOut],
    params: { minHours: 24, maxHours: 120, exemptFrom: ["IE", "FI", "MT", "NO"], retreatWithinDays: 28 },
  }),
  rule({
    id: "GB-ENTRY-APPROVED-ROUTE",
    routes: RETURN_ROUTES,
    species: [...ALL],
    title: "Approved route, pet travels as cargo",
    summary:
      "Pets flying into Great Britain must use an approved route and travel as cargo, except on chartered private planes and for assistance dogs. You don't need an approved route when travelling from Ireland.",
    sources: [src.govUkToGbRoutes],
    params: { exemptFrom: ["IE"] },
  }),
];

/** Routes PetJet plans, with the species allowed on each. */
export const SUPPORTED_ROUTE_SPECIES: Record<string, readonly string[]> = {
  "GB-FR": ["DOG", "CAT", "FERRET"],
  "GB-IE": ["DOG", "CAT", "FERRET"],
  "GB-US": ["DOG", "CAT"],
};

export const COUNTRY_NAMES: Record<string, string> = {
  GB: "Great Britain",
  FR: "France",
  IE: "Ireland",
  US: "the United States",
};
