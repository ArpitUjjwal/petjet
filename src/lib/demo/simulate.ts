import "server-only";
import { isDemoEmail } from "@/lib/auth/demo";
import { db } from "@/lib/db";
import type { ISODate } from "@/lib/rules/dates";
import type { Rule } from "@/lib/rules/types";
import { recordVetService, respondToAppointment } from "@/lib/vets/repository";

export type SimulatedVet = { accepted: boolean; recorded: boolean; summary?: string };

/** True when the owner is a demo account and demo mode is on. Real accounts never get simulated replies. */
export function simulationOn(ownerEmail: string) {
  return process.env.DEMO_MODE !== "false" && isDemoEmail(ownerEmail);
}

/**
 * The demo's happy path: the practice accepts the request at once and, for steps a vet records
 * (the health certificate, tapeworm treatment), records it today. Goes through the same
 * repository functions as the vet portal, so the records and notifications are the real ones.
 */
export async function simulateVetResponse(appointmentId: string, today: ISODate, rules?: Rule[]): Promise<SimulatedVet> {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, select: { providerId: true } });
  if (!appt) return { accepted: false, recorded: false };
  const accepted = await respondToAppointment(appt.providerId, appointmentId, "ACCEPTED");
  if (!accepted.ok) return { accepted: false, recorded: false };
  const recorded = await recordVetService(appt.providerId, appointmentId, { date: today }, today, rules);
  return recorded.ok ? { accepted: true, recorded: true, summary: recorded.summary } : { accepted: true, recorded: false };
}
