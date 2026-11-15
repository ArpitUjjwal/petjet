import "server-only";
import { db } from "@/lib/db";
import { legPrices, listBookings } from "@/lib/flights/repository";
import { findOffer, insuranceOffers } from "@/lib/insurance/offers";
import { TIERS } from "@/lib/marketing/pricing";
import type { ISODate } from "@/lib/rules/dates";
import type { Rule } from "@/lib/rules/types";
import { SERVICE_LABEL, isVetService } from "@/lib/vets/core";
import { ownerAppointmentsForTrip } from "@/lib/vets/repository";
import { certificateTask } from "./journey";
import { planStoredTrip } from "./plan";
import type { getTrip } from "./repository";
import { VET_PRICES, insuranceDirectPrice, summariseCosts, type CostLine } from "./costs";

type Trip = NonNullable<Awaited<ReturnType<typeof getTrip>>>;

/** The trip's costs: booked prices where there are bookings, our picks otherwise. */
export async function tripCosts(ownerId: string, trip: Trip, today: ISODate, rules?: Rule[]) {
  const [bookings, appointments, user] = await Promise.all([
    listBookings(ownerId, trip.id),
    ownerAppointmentsForTrip(ownerId, trip.id),
    db.user.findUnique({ where: { id: ownerId }, select: { plan: true } }),
  ]);
  const lines: CostLine[] = [];
  const pets = trip.pets.length;

  /* The vet visit for the way out */
  const cert = certificateTask(planStoredTrip(trip, today, rules).pets);
  const service = cert?.task.service;
  if (service && isVetService(service)) {
    const price = VET_PRICES[service];
    const appt = appointments.find((a) => a.taskId === cert.task.id && a.status !== "DECLINED");
    lines.push({
      id: "vet",
      label: SERVICE_LABEL[service],
      detail: appt ? appt.provider.name : "PetJet partner vet",
      amount: price.petjet * pets,
      typical: price.typical * pets,
      booked: !!appt || cert.task.status === "DONE",
    });
  }

  for (const l of legPrices(trip, bookings)) {
    lines.push({
      id: l.leg === "OUTBOUND" ? "flight-out" : "flight-home",
      label: l.leg === "OUTBOUND" ? "Flight out" : "Flight home",
      detail: `${l.flight}, pet fees included`,
      amount: l.amount,
      typical: Math.max(l.average, l.amount),
      booked: l.booked,
    });
  }

  const species = [...new Set(trip.pets.map((p) => p.pet.species))];
  const offer = findOffer(trip.insuranceOffer, trip.destination, species) ?? insuranceOffers(trip.destination, species).find((o) => o.recommended);
  if (offer) {
    lines.push({
      id: "insurance",
      label: "Travel insurance",
      detail: `${offer.insurer}, ${offer.plan}`,
      amount: offer.price,
      typical: insuranceDirectPrice(offer.price),
      booked: !!trip.insuranceOffer,
    });
  }

  const tier = TIERS.find((t) => t.id === (user?.plan ?? "EXPLORE"));
  if (tier && tier.price > 0) {
    lines.push({ id: "plan", label: `PetJet ${tier.name}`, detail: "Your plan for this trip", amount: tier.price, typical: 0, booked: true });
  }

  return summariseCosts(lines, trip.destination);
}
