import type { Metadata } from "next";
import { PetEditor } from "@/components/pets/pet-editor";
import { PageHeader } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";

export const metadata: Metadata = { title: "Add a pet" };

export default async function NewPetPage() {
  await requireOwner();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a pet" description="Tell us about your pet once and reuse it on every trip." />
      <PetEditor today={todayISO()} />
    </div>
  );
}
