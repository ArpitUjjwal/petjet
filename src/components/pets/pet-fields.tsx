"use client";

import { Cat, Dog, ExternalLink, Info, PawPrint, Rabbit } from "lucide-react";
import { Callout } from "@/components/ui/feedback";
import { ChoiceGroup } from "@/components/ui/choice";
import { Input, Select } from "@/components/ui/field";
import { franceRestrictedBreed } from "@/lib/rules/engine";
import { MONTHS } from "@/lib/trips/options";
import type { HealthForm, ProfileForm } from "./pet-form-state";

type Errors = Record<string, string | undefined>;

const SPECIES = [
  { value: "DOG", label: "Dog", icon: <Dog className="size-4" /> },
  { value: "CAT", label: "Cat", icon: <Cat className="size-4" /> },
  { value: "FERRET", label: "Ferret", icon: <PawPrint className="size-4" /> },
  { value: "OTHER", label: "Other", icon: <Rabbit className="size-4" /> },
];

/** Shown instead of the rest of the form when the animal isn't a dog, cat or ferret. */
export function UnsupportedSpecies() {
  return (
    <div
      data-testid="unsupported-species"
      className="rounded-card border border-tan-200 bg-tan-100 p-5"
    >
      <p className="text-base font-semibold text-forest-900">PetJet plans trips for dogs, cats and ferrets</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">
        Rabbits, birds, reptiles and other animals follow different rules, often with import
        licences and longer lead times. We haven&apos;t verified those, so we won&apos;t guess.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink-700">
        <li>· Check the GOV.UK guidance for your animal and destination.</li>
        <li>· Ask your vet, who can contact the Animal and Plant Health Agency (APHA).</li>
      </ul>
      <a
        href="https://www.gov.uk/taking-your-pet-abroad"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-800 underline-offset-4 hover:underline"
      >
        GOV.UK: Taking your pet abroad <ExternalLink className="size-3.5" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}

export function PetProfileFields({
  value,
  onChange,
  errors = {},
  today,
  askPedigree = false,
}: {
  value: ProfileForm;
  onChange: (next: ProfileForm) => void;
  errors?: Errors;
  today: string;
  /** Ask about a pedigree when the breed is one France restricts */
  askPedigree?: boolean;
}) {
  const set = <K extends keyof ProfileForm>(key: K, v: ProfileForm[K]) => onChange({ ...value, [key]: v });
  const year = Number(today.slice(0, 4));
  const years = Array.from({ length: 26 }, (_, i) => String(year - i));
  const restricted = value.species === "DOG" ? franceRestrictedBreed(value.breed) : null;

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Pet's name"
        placeholder="e.g. Milo"
        value={value.name}
        onChange={(e) => set("name", e.target.value)}
        error={errors["profile.name"]}
        autoComplete="off"
      />
      <ChoiceGroup
        legend="Species"
        name="species"
        columns={4}
        size="sm"
        options={SPECIES}
        value={value.species}
        onChange={(v) => set("species", v)}
        error={errors["profile.species"]}
      />
      {value.species === "OTHER" ? (
        <UnsupportedSpecies />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Breed"
              optional
              placeholder={value.species === "CAT" ? "e.g. British Shorthair" : "e.g. Cockapoo"}
              value={value.breed}
              onChange={(e) => set("breed", e.target.value)}
              error={errors["profile.breed"]}
            />
            <Input
              label="Weight"
              optional
              placeholder="e.g. 4.5"
              suffix="kg"
              inputMode="decimal"
              value={value.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
              error={errors["profile.weightKg"]}
            />
          </div>
          <fieldset>
            <legend className="text-[13px] font-medium text-ink-900">Date of birth</legend>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Month and year are enough. Add the day if you know it, especially for young pets.
            </p>
            <div className="mt-2 grid grid-cols-[1.4fr_1fr_0.8fr] gap-3">
              <Select
                label="Month"
                value={value.birthMonth}
                onChange={(e) => set("birthMonth", e.target.value)}
                error={errors["profile.birthMonth"]}
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select
                label="Year"
                value={value.birthYear}
                onChange={(e) => set("birthYear", e.target.value)}
                error={errors["profile.birthYear"]}
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <Input
                label="Day"
                optional
                inputMode="numeric"
                placeholder="DD"
                maxLength={2}
                value={value.birthDay}
                onChange={(e) => set("birthDay", e.target.value.replace(/\D/g, ""))}
                error={errors["profile.birthDay"]}
              />
            </div>
          </fieldset>
          {restricted && askPedigree && (
            <div className="flex flex-col gap-3">
              <Callout tone="info" icon={<Info className="size-4.5" />} title="France restricts this type of dog">
                Staffordshire terrier, American Staffordshire terrier, Boerboel and Tosa types can only
                enter France with a pedigree recognised by the French authorities.
              </Callout>
              <ChoiceGroup
                legend={`Does ${value.name || "your dog"} have a recognised pedigree?`}
                name="pedigree"
                columns={3}
                size="sm"
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "unknown", label: "Not sure" },
                ]}
                value={value.hasPedigree === true ? "yes" : value.hasPedigree === false ? "no" : "unknown"}
                onChange={(v) => set("hasPedigree", v === "yes" ? true : v === "no" ? false : null)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PetHealthFields({
  petName,
  value,
  onChange,
  errors = {},
  today,
}: {
  petName: string;
  value: HealthForm;
  onChange: (next: HealthForm) => void;
  errors?: Errors;
  today: string;
}) {
  const set = <K extends keyof HealthForm>(key: K, v: HealthForm[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ChoiceGroup
          legend={`Is ${petName} microchipped?`}
          name={`microchip-${petName}`}
          columns={3}
          size="sm"
          options={[
            { value: "YES", label: "Yes" },
            { value: "NO", label: "No" },
            { value: "UNKNOWN", label: "Not sure" },
          ]}
          value={value.microchipStatus}
          onChange={(v) => set("microchipStatus", v)}
          error={errors["health.microchip.status"]}
        />
        {value.microchipStatus === "YES" && (
          <div className="grid gap-4 rounded-control bg-cream-50 p-4 sm:grid-cols-2">
            <Input
              label="Microchip number"
              optional
              inputMode="numeric"
              placeholder="15 digits"
              value={value.microchipNumber}
              onChange={(e) => set("microchipNumber", e.target.value)}
              error={errors["health.microchip.number"]}
            />
            <Input
              label="Date implanted"
              optional
              type="date"
              max={today}
              value={value.microchipDate}
              onChange={(e) => set("microchipDate", e.target.value)}
              error={errors["health.microchip.implantedOn"]}
              hint="Lets us check it came before the rabies vaccination."
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <ChoiceGroup
          legend={`Is ${petName} vaccinated against rabies?`}
          name={`rabies-${petName}`}
          columns={3}
          size="sm"
          options={[
            { value: "VACCINATED", label: "Yes" },
            { value: "NONE", label: "No" },
            { value: "UNKNOWN", label: "Not sure" },
          ]}
          value={value.rabiesStatus}
          onChange={(v) => set("rabiesStatus", v)}
          error={errors["health.rabies.status"]}
        />
        {value.rabiesStatus === "VACCINATED" && (
          <div className="flex flex-col gap-4 rounded-control bg-cream-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Date of the last dose"
                type="date"
                max={today}
                value={value.rabiesLastDose}
                onChange={(e) => set("rabiesLastDose", e.target.value)}
                error={errors["health.rabies.lastDoseOn"]}
                hint="Without it we'll ask you to check the record."
              />
              <Input
                label="Valid until"
                optional
                type="date"
                value={value.rabiesValidUntil}
                onChange={(e) => set("rabiesValidUntil", e.target.value)}
                error={errors["health.rabies.validUntil"]}
              />
            </div>
            <ChoiceGroup
              legend="Was that dose…"
              name={`dose-${petName}`}
              columns={3}
              size="sm"
              options={[
                { value: "PRIMARY", label: "A first vaccination", description: "A 21-day wait applies" },
                { value: "BOOSTER", label: "A booster on time", description: "No break in cover" },
                { value: "UNKNOWN", label: "Not sure", description: "We'll assume a first dose" },
              ]}
              value={value.rabiesDoseKind}
              onChange={(v) => set("rabiesDoseKind", v)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
