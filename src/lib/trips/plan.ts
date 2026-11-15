import { evaluateTrip } from "@/lib/rules/engine";
import { isAfter, type ISODate } from "@/lib/rules/dates";
import type { PetInput, Plan, PlanStatus, Rule, TaskRecords, TripInput } from "@/lib/rules/types";
import { countryLabel } from "./options";
import { recordsByPet, type StoredRecord } from "./records";

/* Converts stored pets and trips into rules-engine inputs, and builds plans per pet. */

export type PetRecord = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthYear: number;
  birthMonth: number;
  birthDay: number | null;
  hasPedigree: boolean | null;
  microchipStatus: string;
  microchipDate: string | null;
  rabiesStatus: string;
  rabiesLastDose: string | null;
  rabiesDoseKind: string | null;
  rabiesValidUntil: string | null;
};

export type TripRecord = {
  id: string;
  origin: string;
  destination: string;
  arrivalDate: string;
  returnDate: string | null;
  accompaniment: string;
  arrivalAirport: string | null;
};

/**
 * Date of birth from its parts. With no day, use the last day of the month: treating the
 * pet as slightly younger is the cautious choice for minimum-age rules. Never after today.
 */
export function dateOfBirth(year: number, month: number, day: number | null | undefined, today: ISODate) {
  const mm = String(month).padStart(2, "0");
  let date: ISODate;
  let assumed = false;
  if (day) {
    date = `${year}-${mm}-${String(day).padStart(2, "0")}`;
  } else {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    date = `${year}-${mm}-${String(last).padStart(2, "0")}`;
    assumed = true;
  }
  if (isAfter(date, today)) date = today;
  return { date, assumed };
}

export function toPetInput(pet: PetRecord, today: ISODate): { input: PetInput; dobAssumed: boolean } {
  const dob = dateOfBirth(pet.birthYear, pet.birthMonth, pet.birthDay, today);
  const microchip = pet.microchipStatus as PetInput["microchip"]["status"];
  const rabies = pet.rabiesStatus as PetInput["rabies"]["status"];
  return {
    dobAssumed: dob.assumed,
    input: {
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? undefined,
      hasPedigree: pet.hasPedigree ?? undefined,
      dateOfBirth: dob.date,
      microchip: { status: microchip, implantedOn: pet.microchipDate ?? undefined },
      rabies: {
        status: rabies,
        lastDoseOn: pet.rabiesLastDose ?? undefined,
        lastDoseKind:
          pet.rabiesDoseKind === "PRIMARY" || pet.rabiesDoseKind === "BOOSTER" ? pet.rabiesDoseKind : undefined,
        validUntil: pet.rabiesValidUntil ?? undefined,
      },
    },
  };
}

export function toTripInput(trip: TripRecord, petCount: number): TripInput {
  return {
    origin: trip.origin,
    destination: trip.destination,
    arrivalDate: trip.arrivalDate,
    returnDate: trip.returnDate ?? undefined,
    petCount,
    purpose: "PERSONAL",
    accompaniment: trip.accompaniment === "AUTHORISED_PERSON" ? "AUTHORISED_PERSON" : "OWNER",
    arrivalAirport: trip.arrivalAirport ?? undefined,
  };
}

export type PetPlan = { pet: PetRecord; plan: Plan; dobAssumed: boolean };
export type TripStatus = PlanStatus | "UNSUPPORTED";

const SEVERITY: Record<TripStatus, number> = {
  READY: 0,
  IN_PROGRESS: 1,
  NEEDS_INFO: 2,
  NOT_FEASIBLE: 3,
  UNSUPPORTED: 4,
};

export function planTrip(
  trip: TripRecord,
  pets: PetRecord[],
  today: ISODate,
  opts: { rules?: Rule[]; records?: (petId: string) => TaskRecords | undefined } = {},
): { pets: PetPlan[]; status: TripStatus } {
  const tripInput = toTripInput(trip, pets.length);
  const results = pets.map((pet) => {
    const { input, dobAssumed } = toPetInput(pet, today);
    const plan = evaluateTrip(input, tripInput, { today, rules: opts.rules, records: opts.records?.(pet.id) });
    if (plan.supported && dobAssumed) {
      plan.warnings.push(
        `We only know ${pet.name}'s month of birth, so we've assumed the last day of that month. Add the exact date if an age rule is close.`,
      );
    }
    return { pet, plan, dobAssumed };
  });
  const status = results.reduce<TripStatus>((worst, r) => {
    const s: TripStatus = r.plan.supported ? r.plan.status : "UNSUPPORTED";
    return SEVERITY[s] > SEVERITY[worst] ? s : worst;
  }, "READY");
  return { pets: results, status };
}

export function routeTitle(trip: { origin: string; destination: string }) {
  return `${countryLabel(trip.origin)} to ${countryLabel(trip.destination)}`;
}

/** A trip as loaded from the database, with its pets and the steps recorded as done. */
export type StoredTrip = TripRecord & {
  pets: { pet: PetRecord }[];
  taskRecords?: (StoredRecord & { petId: string })[];
};

/** Plans a stored trip, feeding each pet's recorded steps to the engine. */
export function planStoredTrip(trip: StoredTrip, today: ISODate, rules?: Rule[]) {
  return planTrip(
    trip,
    trip.pets.map((p) => p.pet),
    today,
    { rules, records: recordsByPet(trip.taskRecords ?? []) },
  );
}
