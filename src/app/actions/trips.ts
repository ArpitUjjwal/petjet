"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import {
  clearOwnerStep,
  createTripFromDraft,
  deleteTrip as removeTrip,
  recordOwnerStep,
  updateTripDates,
  type Result,
  type StepRef,
} from "@/lib/trips/repository";

export async function createTrip(draft: unknown): Promise<Result<{ tripId: string }>> {
  const user = await requireOwner();
  const result = await createTripFromDraft(user.id, draft, todayISO());
  if (result.ok) {
    revalidatePath("/app", "layout");
    redirect(`/app/trips/${result.tripId}?new=1`);
  }
  return result;
}

export async function deleteTrip(tripId: string) {
  const user = await requireOwner();
  await removeTrip(user.id, tripId);
  revalidatePath("/app", "layout");
  redirect("/app/trips");
}

export async function changeTripDates(tripId: string, input: unknown): Promise<Result<object>> {
  const user = await requireOwner();
  const result = await updateTripDates(user.id, tripId, input, todayISO());
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}

/** Confirms an owner step for one or more pets on the trip, stopping at the first problem. */
export async function markStepDone(
  ref: Omit<StepRef, "petId"> & { petIds: string[]; doneOn: string },
): Promise<Result<object>> {
  const user = await requireOwner();
  const { rules } = await loadRules();
  const today = todayISO();
  let result: Result<object> = { ok: false, message: "Choose a pet." };
  for (const petId of ref.petIds) {
    result = await recordOwnerStep(user.id, { tripId: ref.tripId, taskId: ref.taskId, doneOn: ref.doneOn, petId }, today, rules);
    if (!result.ok) break;
  }
  revalidatePath("/app", "layout");
  return result;
}

export async function undoStepDone(ref: Omit<StepRef, "petId"> & { petIds: string[] }): Promise<Result<object>> {
  const user = await requireOwner();
  let result: Result<object> = { ok: false, message: "Choose a pet." };
  for (const petId of ref.petIds) {
    result = await clearOwnerStep(user.id, { tripId: ref.tripId, taskId: ref.taskId, petId });
    if (!result.ok) break;
  }
  revalidatePath("/app", "layout");
  return result;
}
