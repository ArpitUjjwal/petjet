"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { bookFlight, bookRecommended, upgradePlan, type FlightResult } from "@/lib/flights/repository";

export async function bookFlightAction(input: { tripId: string; leg: string; flightId: string }): Promise<FlightResult> {
  const user = await requireOwner();
  const result = await bookFlight(user.id, input);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect(`/app/flights/${result.bookingId}?booked=1`);
}

/** Books the recommended flight each way in one go. */
export async function bookRecommendedAction(tripId: string): Promise<FlightResult> {
  const user = await requireOwner();
  const result = await bookRecommended(user.id, tripId);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect(`/app/flights?trip=${tripId}&booked=1`);
}

/** Simulated checkout: no payment details are collected or charged. */
export async function upgradeAction(plan: string, next?: string): Promise<FlightResult> {
  const user = await requireOwner();
  const result = await upgradePlan(user.id, plan);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  const safe = next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app/upgrade";
  redirect(`${safe}${safe.includes("?") ? "&" : "?"}upgraded=1`);
}
