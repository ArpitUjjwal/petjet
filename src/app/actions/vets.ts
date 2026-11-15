"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireProvider } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import {
  orderLabTest,
  postLabResult,
  recordVetService,
  requestAppointment,
  respondToAppointment,
  type AppointmentRequest,
  type VetResult,
} from "@/lib/vets/repository";

/* ---------- Owner ---------- */

export async function requestAppointmentAction(input: AppointmentRequest): Promise<VetResult> {
  const user = await requireOwner();
  const { rules } = await loadRules();
  const result = await requestAppointment(user.id, input, todayISO(), rules);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect(`/app/vets?requested=${result.appointmentId}`);
}

/* ---------- Vet ---------- */

async function requireVet() {
  const user = await requireProvider();
  if (user.role !== "VET") throw new Error("Only vets can do this.");
  return user;
}

async function requireLab() {
  const user = await requireProvider();
  if (user.role !== "LAB") throw new Error("Only labs can do this.");
  return user;
}

export async function respondToAppointmentAction(id: string, decision: "ACCEPTED" | "DECLINED"): Promise<VetResult> {
  const user = await requireVet();
  const result = await respondToAppointment(user.provider.id, id, decision === "DECLINED" ? "DECLINED" : "ACCEPTED");
  if (result.ok) revalidatePath("/provider", "layout");
  return result;
}

export async function recordVetServiceAction(
  id: string,
  input: { date: string; microchipNumber?: string },
): Promise<VetResult<{ summary: string }>> {
  const user = await requireVet();
  const { rules } = await loadRules();
  const result = await recordVetService(user.provider.id, id, input, todayISO(), rules);
  if (result.ok) revalidatePath("/provider", "layout");
  return result;
}

export async function orderLabTestAction(appointmentId: string, test: string): Promise<VetResult> {
  const user = await requireVet();
  const result = await orderLabTest(user.provider.id, appointmentId, test);
  if (result.ok) revalidatePath("/provider", "layout");
  return result;
}

/* ---------- Lab ---------- */

export async function postLabResultAction(
  id: string,
  input: { value?: string; outcome?: string; note?: string },
): Promise<VetResult<{ summary: string }>> {
  const user = await requireLab();
  const result = await postLabResult(user.provider.id, id, input, todayISO());
  if (result.ok) revalidatePath("/provider", "layout");
  return result;
}
