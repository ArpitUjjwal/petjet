"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { deletePet as removePet, savePet as storePet, type Result } from "@/lib/trips/repository";

export async function savePet(
  input: { profile: unknown; health: unknown },
  petId?: string,
): Promise<Result<{ petId: string }>> {
  const user = await requireOwner();
  const result = await storePet(user.id, input, todayISO(), petId);
  if (result.ok) {
    revalidatePath("/app", "layout");
    redirect(`/app/pets?saved=${result.petId}`);
  }
  return result;
}

export async function deletePet(petId: string) {
  const user = await requireOwner();
  await removePet(user.id, petId);
  revalidatePath("/app", "layout");
  redirect("/app/pets");
}
