import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/repository";
import { formatDate } from "@/lib/rules/dates";
import { getTrip } from "@/lib/trips/repository";
import { AIRLINES, canBookFlights, flightEligibility, searchFlights, type Flight, type Leg, type PlanId } from "./core";

/*
 * Simulated booking. The server works out the schedule and the pets' eligibility again, so a
 * booking can't be made for a flight that doesn't exist or that a pet can't take.
 */

export type FlightResult<T = object> = ({ ok: true } & T) | { ok: false; message: string; upgrade?: boolean };

type TripForFlights = NonNullable<Awaited<ReturnType<typeof getTrip>>>;

export function flightsForTrip(trip: Pick<TripForFlights, "destination" | "arrivalDate" | "returnDate" | "departureAirport" | "arrivalAirport">, leg: Leg): Flight[] {
  const date = leg === "OUTBOUND" ? trip.arrivalDate : trip.returnDate;
  if (!date) return [];
  return searchFlights({ destination: trip.destination, leg, date, ukAirport: trip.departureAirport, destAirport: trip.arrivalAirport });
}

export function petsForFlights(trip: TripForFlights) {
  return trip.pets.map(({ pet }) => ({ name: pet.name, species: pet.species, breed: pet.breed, weightKg: pet.weightKg }));
}

const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function reference() {
  return Array.from({ length: 6 }, () => REF_CHARS[randomInt(REF_CHARS.length)]).join("");
}

export async function bookFlight(
  ownerId: string,
  input: { tripId: string; leg: string; flightId: string },
): Promise<FlightResult<{ bookingId: string }>> {
  const user = await db.user.findUnique({ where: { id: ownerId }, select: { plan: true } });
  if (!user || !canBookFlights(user.plan)) {
    return { ok: false, upgrade: true, message: "Booking flights is part of the Complete plan." };
  }
  const leg: Leg | null = input.leg === "OUTBOUND" || input.leg === "RETURN" ? input.leg : null;
  if (!leg) return { ok: false, message: "Choose the journey out or home." };
  const trip = await getTrip(ownerId, input.tripId);
  if (!trip) return { ok: false, message: "We couldn't find that trip." };
  const flight = flightsForTrip(trip, leg).find((f) => f.id === input.flightId);
  if (!flight) return { ok: false, message: "That flight isn't available any more." };
  const check = flightEligibility(flight, petsForFlights(trip), trip.petPlacement);
  if (!check.ok || !check.placement) return { ok: false, message: "Not every pet on this trip can take this flight." };
  if (await db.booking.findUnique({ where: { tripId_leg: { tripId: trip.id, leg } } })) {
    return { ok: false, message: `You've already booked the journey ${leg === "OUTBOUND" ? "out" : "home"} for this trip.` };
  }

  const airline = AIRLINES[flight.airline];
  const booking = await db.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        ownerId,
        tripId: trip.id,
        leg,
        airline: flight.airline,
        flightNumber: flight.flightNumber,
        fromCode: flight.from,
        toCode: flight.to,
        departDate: flight.date,
        departTime: flight.depart,
        arriveTime: flight.arrive,
        durationMin: flight.durationMin,
        placement: check.placement!,
        priceGbp: check.price,
        reference: reference(),
      },
      select: { id: true, reference: true },
    });
    const pets = trip.pets.map((p) => p.pet.name);
    await notify(tx, {
      userId: ownerId,
      kind: "FLIGHT_BOOKED",
      title: `Booked: ${airline.name} ${flight.flightNumber}, ${flight.from} to ${flight.to}`,
      body: `${formatDate(flight.date)} at ${flight.depart}. ${pets.join(" and ")} ${pets.length === 1 ? "flies" : "fly"} ${check.placement === "CABIN" ? "in the cabin" : check.placement === "HOLD" ? "in the hold" : "as cargo"}. Reference ${created.reference} (simulated).`,
      href: `/app/flights/${created.id}`,
    });
    if (leg === "OUTBOUND") {
      /* The airports now come from the booking, which also settles Ireland's point-of-entry step */
      await tx.trip.update({
        where: { id: trip.id },
        data: { departureAirport: flight.from, arrivalAirport: flight.to, petPlacement: check.placement === "CABIN" ? "CABIN" : "HOLD" },
      });
    } else if (check.placement === "CARGO") {
      /* Flying home as cargo with an approved airline completes the approved-route step */
      for (const { petId } of trip.pets) {
        await tx.taskRecord.upsert({
          where: { tripId_petId_key: { tripId: trip.id, petId, key: "approvedRouteBooked" } },
          create: { tripId: trip.id, petId, key: "approvedRouteBooked", doneOn: new Date().toISOString().slice(0, 10), source: "BOOKING", issuedBy: airline.name },
          update: { source: "BOOKING", issuedBy: airline.name, documentId: null },
        });
      }
    }
    return created;
  });
  return { ok: true, bookingId: booking.id };
}

export function listBookings(ownerId: string, tripId?: string) {
  return db.booking.findMany({
    where: { ownerId, ...(tripId ? { tripId } : {}) },
    orderBy: [{ departDate: "asc" }, { departTime: "asc" }],
  });
}

export function getBooking(ownerId: string, id: string) {
  return db.booking.findFirst({
    where: { id, ownerId },
    include: {
      owner: { select: { name: true } },
      trip: { include: { pets: { include: { pet: { select: { name: true, species: true } } } } } },
    },
  });
}

/** Simulated checkout: no payment details are taken. */
export async function upgradePlan(userId: string, plan: string): Promise<FlightResult> {
  if (plan !== "PLAN" && plan !== "COMPLETE") return { ok: false, message: "Choose a plan." };
  const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } });
  if (!user || user.role !== "OWNER") return { ok: false, message: "Only pet owner accounts have plans." };
  const order: PlanId[] = ["EXPLORE", "PLAN", "COMPLETE"];
  if (order.indexOf(plan) <= order.indexOf(user.plan as PlanId)) return { ok: false, message: "You're already on this plan or a higher one." };
  await db.user.update({ where: { id: userId }, data: { plan, planPaidAt: new Date() } });
  return { ok: true };
}

/* ---------- Recommended pair (the demo's one-tap booking) ---------- */

type Pick1 = { flight: Flight; check: ReturnType<typeof flightEligibility> };

function firstEligible(trip: TripForFlights, leg: Leg, airports?: { from: string; to: string }): Pick1 | null {
  const t = airports ? { ...trip, departureAirport: airports.from, arrivalAirport: airports.to } : trip;
  const pets = petsForFlights(trip);
  for (const flight of flightsForTrip(t, leg)) {
    const check = flightEligibility(flight, pets, trip.petPlacement);
    if (check.ok) return { flight, check };
  }
  return null;
}

/**
 * The first flight each way that every pet can take. The way home uses the airports of the
 * way out (booked or recommended), as booking does.
 */
export function recommendFlights(trip: TripForFlights, booked: { leg: string; fromCode: string; toCode: string }[]) {
  const outBooked = booked.find((b) => b.leg === "OUTBOUND");
  const out = outBooked ? null : firstEligible(trip, "OUTBOUND");
  const airports = outBooked ? { from: outBooked.fromCode, to: outBooked.toCode } : out ? { from: out.flight.from, to: out.flight.to } : undefined;
  const home = trip.returnDate && !booked.some((b) => b.leg === "RETURN") ? firstEligible(trip, "RETURN", airports) : null;
  return { out, home };
}

/** Books the recommended flight for each leg not booked yet. Stops at the first failure. */
export async function bookRecommended(ownerId: string, tripId: string): Promise<FlightResult<{ booked: number }>> {
  let count = 0;
  for (const leg of ["OUTBOUND", "RETURN"] as const) {
    const trip = await getTrip(ownerId, tripId);
    if (!trip) return { ok: false, message: "We couldn't find that trip." };
    const bookings = await db.booking.findMany({ where: { tripId: trip.id }, select: { leg: true, fromCode: true, toCode: true } });
    const rec = recommendFlights(trip, bookings);
    const pick = leg === "OUTBOUND" ? rec.out : rec.home;
    if (!pick) continue;
    const r = await bookFlight(ownerId, { tripId: trip.id, leg, flightId: pick.flight.id });
    if (!r.ok) return r;
    count++;
  }
  return count ? { ok: true, booked: count } : { ok: false, message: "There's nothing left to book for this trip." };
}

/** Average price, pet fees included, of the flights on a leg that every pet can take. */
function averageEligible(trip: TripForFlights, leg: Leg, airports?: { from: string; to: string }) {
  const t = airports ? { ...trip, departureAirport: airports.from, arrivalAirport: airports.to } : trip;
  const pets = petsForFlights(trip);
  const prices = flightsForTrip(t, leg)
    .map((f) => flightEligibility(f, pets, trip.petPlacement))
    .filter((c) => c.ok)
    .map((c) => c.price);
  return prices.length ? Math.round(prices.reduce((n, p) => n + p, 0) / prices.length) : null;
}

/**
 * Each leg's price, booked or recommended, against the average flight that would also take the pets.
 * For the cost summary.
 */
export function legPrices(trip: TripForFlights, booked: { leg: string; fromCode: string; toCode: string; priceGbp: number; airline: string; flightNumber: string }[]) {
  const rec = recommendFlights(trip, booked);
  const out = booked.find((b) => b.leg === "OUTBOUND");
  const airports = out ? { from: out.fromCode, to: out.toCode } : rec.out ? { from: rec.out.flight.from, to: rec.out.flight.to } : undefined;
  const legs: Leg[] = trip.returnDate ? ["OUTBOUND", "RETURN"] : ["OUTBOUND"];
  return legs.flatMap((leg) => {
    const b = booked.find((x) => x.leg === leg);
    const pick = leg === "OUTBOUND" ? rec.out : rec.home;
    const average = averageEligible(trip, leg, leg === "RETURN" ? airports : out ? airports : undefined);
    if (b) return [{ leg, amount: b.priceGbp, average: average ?? b.priceGbp, booked: true, flight: `${AIRLINES[b.airline as keyof typeof AIRLINES]?.name ?? b.airline} ${b.flightNumber}` }];
    if (pick) return [{ leg, amount: pick.check.price, average: average ?? pick.check.price, booked: false, flight: `${AIRLINES[pick.flight.airline].name} ${pick.flight.flightNumber}` }];
    return [];
  });
}
