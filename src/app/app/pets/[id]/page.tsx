import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PetEditor } from "@/components/pets/pet-editor";
import { PageHeader } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { getPet } from "@/lib/trips/repository";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit pet" };

export default async function EditPetPage({ params }: PageProps<"/app/pets/[id]">) {
  const user = await requireOwner();
  const { id } = await params;
  const pet = await getPet(user.id, id);
  if (!pet) notFound();
  const tripCount = await db.tripPet.count({ where: { petId: pet.id } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={pet.name} description="Changes here update the plans for every trip this pet is on." />
      <PetEditor pet={pet} today={todayISO()} tripCount={tripCount} />
    </div>
  );
}
