"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { chooseInsurance, clearInsurance, type InsuranceResult } from "@/lib/insurance/repository";

export async function chooseInsuranceAction(tripId: string, offerId: string): Promise<InsuranceResult> {
  const user = await requireOwner();
  const result = await chooseInsurance(user.id, tripId, offerId);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect(`/app/insurance?trip=${tripId}&chosen=1`);
}

export async function changeInsuranceAction(tripId: string): Promise<InsuranceResult> {
  const user = await requireOwner();
  const result = await clearInsurance(user.id, tripId);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect(`/app/insurance?trip=${tripId}`);
}
