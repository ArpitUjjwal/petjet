import { CheckCircle2, HelpCircle, PawPrint, Plus, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SpeciesIcon } from "@/components/pets/species-icon";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { SPECIES_NAME, ageLabel } from "@/lib/trips/format";
import { listPets } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "My pets" };

function Status({ label, status, yes }: { label: string; status: string; yes: string }) {
  if (status === yes)
    return (
      <Badge tone="ok" icon={<CheckCircle2 className="size-3.5" />}>
        {label}
      </Badge>
    );
  if (status === "UNKNOWN")
    return (
      <Badge tone="warn" icon={<HelpCircle className="size-3.5" />}>
        {label}: not sure
      </Badge>
    );
  return (
    <Badge tone="neutral" icon={<XCircle className="size-3.5" />}>
      No {label.toLowerCase()}
    </Badge>
  );
}

export default async function PetsPage() {
  const user = await requireOwner();
  const pets = await listPets(user.id);
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="My pets"
        description="Pets you travel with. Each one gets its own checklist on a trip."
        action={
          pets.length > 0 ? (
            <ButtonLink href="/app/pets/new" iconLeft={<Plus className="size-4" />}>
              Add a pet
            </ButtonLink>
          ) : undefined
        }
      />
      {pets.length === 0 ? (
        <EmptyState
          icon={<PawPrint className="size-5" />}
          title="No pets yet"
          description="Add your first pet, or plan a trip and add them as you go."
          action={
            <ButtonLink href="/app/pets/new" iconLeft={<Plus className="size-4" />}>
              Add a pet
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <li key={pet.id}>
              <Link
                href={`/app/pets/${pet.id}`}
                data-testid="pet-card"
                className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-tan-100 text-tan-700">
                    <SpeciesIcon species={pet.species} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold group-hover:text-forest-800">{pet.name}</p>
                    <p className="truncate text-[13px] text-ink-500">
                      {SPECIES_NAME[pet.species]}
                      {pet.breed ? ` · ${pet.breed}` : ""} · {ageLabel(pet.birthYear, pet.birthMonth, today)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Status label="Microchip" status={pet.microchipStatus} yes="YES" />
                  <Status label="Rabies vaccine" status={pet.rabiesStatus} yes="VACCINATED" />
                </div>
                <p className="mt-4 border-t border-line pt-3 text-xs text-ink-500">
                  {pet._count.trips === 0 ? "No trips yet" : `On ${pet._count.trips} trip${pet._count.trips === 1 ? "" : "s"}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
