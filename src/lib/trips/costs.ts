/*
 * What a trip costs with PetJet, and what it would typically cost otherwise.
 * Every figure is a sample estimate for the demo, labelled as such wherever it's shown.
 */
import type { VetService } from "@/lib/rules/types";

/** PetJet partner prices against a typical high-street price, in whole pounds. Sample figures. */
export const VET_PRICES: Record<VetService, { petjet: number; typical: number }> = {
  ANIMAL_HEALTH_CERTIFICATE: { petjet: 149, typical: 185 },
  GB_PET_HEALTH_CERTIFICATE: { petjet: 149, typical: 185 },
  TAPEWORM_TREATMENT: { petjet: 35, typical: 45 },
  RABIES_VACCINATION: { petjet: 55, typical: 70 },
  RABIES_BOOSTER: { petjet: 55, typical: 70 },
  MICROCHIP: { petjet: 20, typical: 30 },
};

/** Partner insurance rates are this much below buying the same cover direct. Sample figure. */
export const INSURANCE_PARTNER_DISCOUNT = 0.15;

export function insuranceDirectPrice(price: number) {
  return Math.round(price / (1 - INSURANCE_PARTNER_DISCOUNT));
}

/** A pet relocation agency's typical service fee on top of the same bookings, by destination. Sample figures. */
export const AGENCY_FEE: Record<string, number> = { FR: 650, IE: 600, US: 1250 };

export type CostLineId = "vet" | "flight-out" | "flight-home" | "insurance" | "plan";

export type CostLine = {
  id: CostLineId;
  label: string;
  detail: string;
  /** What the customer pays with PetJet */
  amount: number;
  /** What the same thing typically costs arranged alone */
  typical: number;
  /** Booked or chosen already, rather than our estimate */
  booked: boolean;
};

export type TripCosts = {
  lines: CostLine[];
  total: number;
  typicalTotal: number;
  /** Saved against arranging each part yourself, after PetJet's own fee */
  saved: number;
  agencyTotal: number;
  /** Saved against a relocation agency doing it all */
  savedVsAgency: number;
  allBooked: boolean;
};

export function summariseCosts(lines: CostLine[], destination: string): TripCosts {
  const total = lines.reduce((n, l) => n + l.amount, 0);
  const typicalParts = lines.filter((l) => l.id !== "plan").reduce((n, l) => n + l.typical, 0);
  const agencyTotal = typicalParts + (AGENCY_FEE[destination] ?? AGENCY_FEE.FR);
  return {
    lines,
    total,
    typicalTotal: typicalParts,
    saved: typicalParts - total,
    agencyTotal,
    savedVsAgency: agencyTotal - total,
    allBooked: lines.every((l) => l.booked),
  };
}

export const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
