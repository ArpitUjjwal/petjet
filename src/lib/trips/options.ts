/* Choices offered in the questionnaire. Only GB to FR, IE and US are planned;
   the rest are listed so owners get a clear "not supported yet" answer instead of a dead end. */

export type Option = { value: string; label: string };

export const ORIGINS: Option[] = [
  { value: "GB", label: "Great Britain (England, Scotland, Wales)" },
  { value: "NI", label: "Northern Ireland" },
  { value: "IE", label: "Ireland" },
  { value: "FR", label: "France" },
  { value: "US", label: "United States" },
  { value: "IN", label: "India" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "OTHER", label: "Somewhere else" },
];

export const DESTINATIONS: Option[] = [
  { value: "FR", label: "France" },
  { value: "IE", label: "Ireland" },
  { value: "US", label: "United States" },
  { value: "ES", label: "Spain" },
  { value: "DE", label: "Germany" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "PT", label: "Portugal" },
  { value: "CH", label: "Switzerland" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "IN", label: "India" },
  { value: "OTHER", label: "Somewhere else" },
];

export function countryLabel(code: string) {
  return (
    ORIGINS.find((o) => o.value === code)?.label.replace(/ \(.*\)$/, "") ??
    DESTINATIONS.find((o) => o.value === code)?.label ??
    code
  );
}

export const DEPARTURE_AIRPORTS: Option[] = [
  { value: "LHR", label: "London Heathrow (LHR)" },
  { value: "LGW", label: "London Gatwick (LGW)" },
  { value: "STN", label: "London Stansted (STN)" },
  { value: "LTN", label: "London Luton (LTN)" },
  { value: "MAN", label: "Manchester (MAN)" },
  { value: "BHX", label: "Birmingham (BHX)" },
  { value: "BRS", label: "Bristol (BRS)" },
  { value: "NCL", label: "Newcastle (NCL)" },
  { value: "EDI", label: "Edinburgh (EDI)" },
  { value: "GLA", label: "Glasgow (GLA)" },
];

export const ARRIVAL_AIRPORTS: Record<string, Option[]> = {
  FR: [
    { value: "CDG", label: "Paris Charles de Gaulle (CDG)" },
    { value: "ORY", label: "Paris Orly (ORY)" },
    { value: "NCE", label: "Nice (NCE)" },
    { value: "LYS", label: "Lyon (LYS)" },
    { value: "MRS", label: "Marseille (MRS)" },
    { value: "TLS", label: "Toulouse (TLS)" },
    { value: "BOD", label: "Bordeaux (BOD)" },
    { value: "NTE", label: "Nantes (NTE)" },
  ],
  IE: [
    { value: "DUB", label: "Dublin (DUB)" },
    { value: "SNN", label: "Shannon (SNN)" },
    { value: "ORK", label: "Cork (ORK)" },
    { value: "NOC", label: "Ireland West Knock (NOC)" },
    { value: "KIR", label: "Kerry (KIR)" },
  ],
  US: [
    { value: "JFK", label: "New York JFK (JFK)" },
    { value: "EWR", label: "Newark (EWR)" },
    { value: "BOS", label: "Boston (BOS)" },
    { value: "IAD", label: "Washington Dulles (IAD)" },
    { value: "ORD", label: "Chicago O'Hare (ORD)" },
    { value: "ATL", label: "Atlanta (ATL)" },
    { value: "MIA", label: "Miami (MIA)" },
    { value: "DFW", label: "Dallas Fort Worth (DFW)" },
    { value: "LAX", label: "Los Angeles (LAX)" },
    { value: "SFO", label: "San Francisco (SFO)" },
    { value: "SEA", label: "Seattle (SEA)" },
  ],
};

export const SPECIES_OPTIONS: Option[] = [
  { value: "DOG", label: "Dog" },
  { value: "CAT", label: "Cat" },
  { value: "FERRET", label: "Ferret" },
  { value: "OTHER", label: "Another kind of animal" },
];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
