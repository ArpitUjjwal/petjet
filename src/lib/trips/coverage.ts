import { evaluateTrip } from "@/lib/rules/engine";
import type { Rule } from "@/lib/rules/types";

/*
 * "Is this a trip PetJet can plan?" Uses the rules engine's own support checks, plus the
 * questionnaire-only stopover answer, so the questionnaire and the engine never disagree.
 */

export type CoverageIssue = {
  code: string;
  message: string;
};

export type CoverageTrip = {
  origin: string;
  destination: string;
  arrivalDate: string;
  transit: "NONE" | "AIRSIDE" | "LEAVES_AIRPORT";
  purpose: "PERSONAL" | "COMMERCIAL";
  accompaniment: "OWNER" | "AUTHORISED_PERSON" | "UNACCOMPANIED";
};

export function checkCoverage(
  pets: { name: string; species: string }[],
  trip: CoverageTrip,
  today: string,
  rules?: Rule[],
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const seen = new Set<string>();
  const add = (i: CoverageIssue) => {
    const key = `${i.code}:${i.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(i);
    }
  };

  for (const pet of pets) {
    const result = evaluateTrip(
      {
        name: pet.name,
        species: pet.species,
        microchip: { status: "UNKNOWN" },
        rabies: { status: "UNKNOWN" },
      },
      {
        origin: trip.origin,
        destination: trip.destination,
        arrivalDate: trip.arrivalDate,
        petCount: pets.length,
        purpose: trip.purpose,
        accompaniment: trip.accompaniment,
      },
      { today, rules },
    );
    if (!result.supported) {
      for (const r of result.reasons) {
        add({
          code: r.code,
          message: r.code === "SPECIES_NOT_SUPPORTED" ? `${pet.name}: ${r.message}` : r.message,
        });
      }
    }
  }

  if (trip.transit === "LEAVES_AIRPORT") {
    add({
      code: "TRANSIT_ENTRY",
      message:
        "If your pet leaves the airport during a stopover, it enters that country and its rules apply too. PetJet only plans direct trips or stopovers where your pet stays airside.",
    });
  }
  return issues;
}
