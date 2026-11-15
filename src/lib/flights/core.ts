import type { ISODate } from "@/lib/rules/dates";

/*
 * Simulated flights for PetJet's three routes, with each airline's pet policy as a short summary.
 * Schedules are deterministic (the same route and date always give the same flights) so the demo
 * and tests are repeatable. Nothing here is a real fare or a live policy.
 */

export type AirlineCode = "AF" | "BA" | "EI" | "VS";

export type Airline = {
  code: AirlineCode;
  name: string;
  logo: string;
  /** Pets in the cabin: weight limit including the carrier, or null when not carried */
  cabinMaxKg: number | null;
  /** Pets in the hold: weight limit including the crate */
  holdMaxKg: number;
  /** Hold pets are booked through the airline's cargo service */
  holdViaCargo: boolean;
  species: string[];
  /** Snub-nosed (brachycephalic) breeds refused in the hold */
  refusesSnubNosedInHold: boolean;
  policy: string;
};

export const AIRLINES: Record<AirlineCode, Airline> = {
  AF: {
    code: "AF",
    name: "Air France",
    logo: "/airlines/air-france.svg",
    cabinMaxKg: 8,
    holdMaxKg: 75,
    holdViaCargo: false,
    species: ["DOG", "CAT"],
    refusesSnubNosedInHold: true,
    policy: "Dogs and cats up to 8 kg with their bag can travel in the cabin; larger pets in the hold. Snub-nosed breeds aren't accepted in the hold.",
  },
  BA: {
    code: "BA",
    name: "British Airways",
    logo: "/airlines/british-airways.svg",
    cabinMaxKg: null,
    holdMaxKg: 75,
    holdViaCargo: true,
    species: ["DOG", "CAT", "FERRET"],
    refusesSnubNosedInHold: true,
    policy: "No pets in the cabin except assistance dogs. Pets fly in the hold, booked through IAG Cargo. Snub-nosed breeds are restricted.",
  },
  EI: {
    code: "EI",
    name: "Aer Lingus",
    logo: "/airlines/aer-lingus.svg",
    cabinMaxKg: null,
    holdMaxKg: 50,
    holdViaCargo: true,
    species: ["DOG", "CAT"],
    refusesSnubNosedInHold: true,
    policy: "No pets in the cabin except assistance dogs. Pets fly in the hold, booked through Aer Lingus Cargo.",
  },
  VS: {
    code: "VS",
    name: "Virgin Atlantic",
    logo: "/airlines/virgin-atlantic.svg",
    cabinMaxKg: null,
    holdMaxKg: 75,
    holdViaCargo: true,
    species: ["DOG", "CAT"],
    refusesSnubNosedInHold: true,
    policy: "No pets in the cabin except assistance dogs. Pets fly in the hold, booked through Virgin Atlantic Cargo.",
  },
};

export const POLICY_NOTE = "Summary of the airline's published pet policy for this demo. Always check with the airline before you book.";

const ROUTE_AIRLINES: Record<string, AirlineCode[]> = {
  FR: ["AF", "BA"],
  IE: ["EI", "BA"],
  US: ["VS", "BA"],
};

export const DEFAULT_AIRPORT: Record<string, string> = { GB: "LHR", FR: "CDG", IE: "DUB", US: "JFK" };

const CITY: Record<string, string> = {
  LHR: "London", LGW: "London", STN: "London", LTN: "London", MAN: "Manchester", BHX: "Birmingham", BRS: "Bristol",
  NCL: "Newcastle", EDI: "Edinburgh", GLA: "Glasgow", CDG: "Paris", ORY: "Paris", NCE: "Nice", LYS: "Lyon", MRS: "Marseille",
  TLS: "Toulouse", BOD: "Bordeaux", NTE: "Nantes", DUB: "Dublin", SNN: "Shannon", ORK: "Cork", NOC: "Knock", KIR: "Kerry",
  JFK: "New York", EWR: "Newark", BOS: "Boston", IAD: "Washington", ORD: "Chicago", ATL: "Atlanta", MIA: "Miami",
  DFW: "Dallas", LAX: "Los Angeles", SFO: "San Francisco", SEA: "Seattle",
};

export function cityOf(code: string) {
  return CITY[code] ?? code;
}

/** Flight time in minutes and the destination's clock difference from the UK, in hours */
const ROUTE_TIMES: Record<string, { minutes: number; tz: number }> = {
  FR: { minutes: 80, tz: 1 },
  IE: { minutes: 85, tz: 0 },
  US: { minutes: 480, tz: -5 },
};

const BASE_FARE: Record<string, number> = { FR: 118, IE: 92, US: 540 };
const PET_FEE = { CABIN: 55, HOLD: 165, CARGO: 395 } as const;

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function clock(totalMin: number) {
  const m = ((totalMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type Leg = "OUTBOUND" | "RETURN";

export type Flight = {
  id: string;
  airline: AirlineCode;
  flightNumber: string;
  from: string;
  to: string;
  date: ISODate;
  depart: string;
  arrive: string;
  /** +1 when it lands the next day (local time) */
  dayOffset: number;
  durationMin: number;
  fare: number;
  leg: Leg;
};

const DEPARTURES = [7 * 60 + 5, 8 * 60 + 40, 10 * 60 + 15, 12 * 60 + 50, 14 * 60 + 25, 16 * 60 + 55, 18 * 60 + 30, 20 * 60 + 10];

/**
 * Flights for one leg on one date. Outbound flights leave the UK; return flights fly back to it.
 * Each airline on the route has three departures that day.
 */
export function searchFlights(opts: { destination: string; leg: Leg; date: ISODate; ukAirport?: string | null; destAirport?: string | null }): Flight[] {
  const dest = opts.destination;
  const airlines = ROUTE_AIRLINES[dest];
  const times = ROUTE_TIMES[dest];
  if (!airlines || !times) return [];
  const uk = opts.ukAirport || DEFAULT_AIRPORT.GB;
  const there = opts.destAirport || DEFAULT_AIRPORT[dest];
  const [from, to] = opts.leg === "OUTBOUND" ? [uk, there] : [there, uk];
  const tz = opts.leg === "OUTBOUND" ? times.tz : -times.tz;
  const flights: Flight[] = [];
  for (const code of airlines) {
    const seed = hash(`${code}${from}${to}${opts.date}`);
    const picks = new Set<number>();
    for (let i = 0; picks.size < 3 && i < 12; i++) picks.add(DEPARTURES[(seed + i * 3) % DEPARTURES.length]);
    for (const dep of [...picks].sort((a, b) => a - b)) {
      const arriveAbs = dep + times.minutes + tz * 60;
      const number = `${code}${100 + ((seed + dep) % 800)}`;
      flights.push({
        id: `${number}-${opts.date}-${from}${to}`,
        airline: code,
        flightNumber: number,
        from,
        to,
        date: opts.date,
        depart: clock(dep),
        arrive: clock(arriveAbs),
        dayOffset: arriveAbs >= 1440 ? 1 : 0,
        durationMin: times.minutes,
        fare: BASE_FARE[dest] + ((seed + dep) % 9) * 7,
        leg: opts.leg,
      });
    }
  }
  return flights.sort((a, b) => a.depart.localeCompare(b.depart));
}

export function durationLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}` : `${m}m`;
}

/* ---------- Pet eligibility ---------- */

const SNUB_NOSED = [
  "pug", "bulldog", "boxer", "boston terrier", "shih tzu", "pekingese", "lhasa apso", "cavalier king charles", "chow chow",
  "dogue de bordeaux", "shar pei", "mastiff", "persian", "himalayan", "exotic shorthair", "brussels griffon", "japanese chin",
];

export function isSnubNosed(breed: string | null | undefined) {
  if (!breed) return false;
  const b = breed.toLowerCase();
  return SNUB_NOSED.some((s) => b.includes(s));
}

/** A soft-sided cabin bag weighs about this much; airline cabin limits include it */
export const CARRIER_KG = 1.5;

export type Placement = "CABIN" | "HOLD" | "CARGO";

export type PetForFlight = { name: string; species: string; breed: string | null; weightKg: number | null };

export type PetEligibility = {
  name: string;
  placement: Placement | null;
  cabin: { ok: boolean; reason: string };
  hold: { ok: boolean; reason: string };
  /** One sentence for the flight card */
  summary: string;
};

/**
 * Where a pet can travel on this airline and leg. Pets flying into Great Britain must travel as
 * cargo on an approved route, whatever the airline allows elsewhere.
 */
export function petEligibility(
  airline: Airline,
  pet: PetForFlight,
  opts: { intoGB: boolean; preference?: string },
): PetEligibility {
  const species = pet.species.toUpperCase();
  if (!airline.species.includes(species)) {
    const no = { ok: false, reason: `${airline.name} doesn't carry ${species.toLowerCase()}s.` };
    return { name: pet.name, placement: null, cabin: no, hold: no, summary: no.reason };
  }

  let cabin: { ok: boolean; reason: string };
  if (opts.intoGB) cabin = { ok: false, reason: "Pets can't fly into Great Britain in the cabin." };
  else if (airline.cabinMaxKg === null) cabin = { ok: false, reason: `${airline.name} doesn't take pets in the cabin.` };
  else if (pet.weightKg === null) cabin = { ok: false, reason: `Add ${pet.name}'s weight to check the ${airline.cabinMaxKg} kg cabin limit.` };
  else if (pet.weightKg + CARRIER_KG > airline.cabinMaxKg) {
    cabin = { ok: false, reason: `${pet.name} plus a bag is about ${pet.weightKg + CARRIER_KG} kg, over the ${airline.cabinMaxKg} kg cabin limit.` };
  } else cabin = { ok: true, reason: `Fits the ${airline.cabinMaxKg} kg cabin limit with a bag.` };

  let hold: { ok: boolean; reason: string };
  if (airline.refusesSnubNosedInHold && isSnubNosed(pet.breed)) {
    hold = { ok: false, reason: `${airline.name} doesn't accept snub-nosed breeds like ${pet.breed} in the hold.` };
  } else if (pet.weightKg !== null && pet.weightKg > airline.holdMaxKg) {
    hold = { ok: false, reason: `Over the ${airline.holdMaxKg} kg hold limit.` };
  } else {
    hold = { ok: true, reason: opts.intoGB || airline.holdViaCargo ? "In the hold, booked as cargo." : "In the hold, checked in with you." };
  }

  const cargo = opts.intoGB || airline.holdViaCargo;
  let placement: Placement | null = null;
  if (cabin.ok && opts.preference !== "HOLD") placement = "CABIN";
  else if (hold.ok) placement = cargo ? "CARGO" : "HOLD";
  else if (cabin.ok) placement = "CABIN";

  const summary =
    placement === "CABIN"
      ? `${pet.name} can fly in the cabin with you.`
      : placement
        ? `${pet.name} flies in the hold${placement === "CARGO" ? " as cargo" : ""}.${
            /* Say why not the cabin when this airline does carry pets there */
            !cabin.ok && airline.cabinMaxKg !== null && !opts.intoGB ? ` ${cabin.reason}` : ""
          }`
        : `${pet.name} can't fly on this flight. ${hold.reason}`;
  return { name: pet.name, placement, cabin, hold, summary };
}

export type FlightEligibility = { ok: boolean; placement: Placement | null; pets: PetEligibility[]; price: number };

const RANK: Record<Placement, number> = { CABIN: 0, HOLD: 1, CARGO: 2 };

/** A flight works when every pet has a place on it. The price includes each pet's fee. */
export function flightEligibility(flight: Flight, pets: PetForFlight[], preference?: string): FlightEligibility {
  const airline = AIRLINES[flight.airline];
  const intoGB = flight.leg === "RETURN";
  const checks = pets.map((p) => petEligibility(airline, p, { intoGB, preference }));
  const ok = checks.length > 0 && checks.every((c) => c.placement);
  const placement = ok ? checks.map((c) => c.placement!).sort((a, b) => RANK[b] - RANK[a])[0] : null;
  const price = flight.fare + checks.reduce((n, c) => n + (c.placement ? PET_FEE[c.placement] : 0), 0);
  return { ok, placement, pets: checks, price };
}

export const PLACEMENT_LABEL: Record<Placement, string> = { CABIN: "In the cabin", HOLD: "In the hold", CARGO: "Hold, as cargo" };

/* ---------- Plans ---------- */

export type PlanId = "EXPLORE" | "PLAN" | "COMPLETE";

/** Booking flights is part of the Complete plan. */
export function canBookFlights(plan: string) {
  return plan === "COMPLETE";
}
