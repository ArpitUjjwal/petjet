import "server-only";
import { db } from "@/lib/db";
import { insuranceOffers } from "./offers";

export type InsuranceResult = { ok: true } | { ok: false; message: string };

/** Saves the sample cover chosen for a trip. Nothing is bought; it only marks the step done. */
export async function chooseInsurance(ownerId: string, tripId: string, offerId: string): Promise<InsuranceResult> {
  const trip = await db.trip.findFirst({
    where: { id: tripId, ownerId },
    select: { id: true, destination: true, pets: { select: { pet: { select: { species: true } } } } },
  });
  if (!trip) return { ok: false, message: "We couldn't find that trip." };
  const species = trip.pets.map((p) => p.pet.species);
  if (!insuranceOffers(trip.destination, species).some((o) => o.id === offerId)) {
    return { ok: false, message: "Choose one of the offers." };
  }
  await db.trip.update({ where: { id: trip.id }, data: { insuranceOffer: offerId, insuranceChosenAt: new Date() } });
  return { ok: true };
}

export async function clearInsurance(ownerId: string, tripId: string): Promise<InsuranceResult> {
  const res = await db.trip.updateMany({ where: { id: tripId, ownerId }, data: { insuranceOffer: null, insuranceChosenAt: null } });
  return res.count ? { ok: true } : { ok: false, message: "We couldn't find that trip." };
}
