/* Form state for pet details, as strings straight from the inputs. Validation happens in
   src/lib/trips/schemas.ts on both the client and the server. */

export type ProfileForm = {
  name: string;
  species: string;
  breed: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  weightKg: string;
  hasPedigree: boolean | null;
};

export type HealthForm = {
  microchipStatus: string;
  microchipNumber: string;
  microchipDate: string;
  rabiesStatus: string;
  rabiesLastDose: string;
  rabiesDoseKind: string;
  rabiesValidUntil: string;
};

export const emptyProfile = (): ProfileForm => ({
  name: "",
  species: "",
  breed: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  weightKg: "",
  hasPedigree: null,
});

export const emptyHealth = (): HealthForm => ({
  microchipStatus: "",
  microchipNumber: "",
  microchipDate: "",
  rabiesStatus: "",
  rabiesLastDose: "",
  rabiesDoseKind: "",
  rabiesValidUntil: "",
});

/** Pet fields as stored, for pre-filling forms */
export type StoredPet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthYear: number;
  birthMonth: number;
  birthDay: number | null;
  weightKg: number | null;
  hasPedigree: boolean | null;
  microchipStatus: string;
  microchipNumber: string | null;
  microchipDate: string | null;
  rabiesStatus: string;
  rabiesLastDose: string | null;
  rabiesDoseKind: string | null;
  rabiesValidUntil: string | null;
};

export function profileFromStored(p: StoredPet): ProfileForm {
  return {
    name: p.name,
    species: p.species,
    breed: p.breed ?? "",
    birthYear: String(p.birthYear),
    birthMonth: String(p.birthMonth),
    birthDay: p.birthDay ? String(p.birthDay) : "",
    weightKg: p.weightKg ? String(p.weightKg) : "",
    hasPedigree: p.hasPedigree,
  };
}

export function healthFromStored(p: StoredPet): HealthForm {
  return {
    microchipStatus: p.microchipStatus,
    microchipNumber: p.microchipNumber ?? "",
    microchipDate: p.microchipDate ?? "",
    rabiesStatus: p.rabiesStatus,
    rabiesLastDose: p.rabiesLastDose ?? "",
    rabiesDoseKind: p.rabiesDoseKind ?? (p.rabiesStatus === "VACCINATED" && p.rabiesLastDose ? "UNKNOWN" : ""),
    rabiesValidUntil: p.rabiesValidUntil ?? "",
  };
}

/** Shapes form strings into the input the schemas expect */
export function profileInput(p: ProfileForm) {
  return {
    name: p.name,
    species: p.species,
    breed: p.breed,
    birthYear: p.birthYear,
    birthMonth: p.birthMonth,
    birthDay: p.birthDay,
    weightKg: p.weightKg,
    hasPedigree: p.hasPedigree,
  };
}

export function healthInput(h: HealthForm) {
  return {
    microchip: {
      status: h.microchipStatus,
      number: h.microchipStatus === "YES" ? h.microchipNumber : "",
      implantedOn: h.microchipStatus === "YES" ? h.microchipDate : "",
    },
    rabies: {
      status: h.rabiesStatus,
      lastDoseOn: h.rabiesStatus === "VACCINATED" ? h.rabiesLastDose : "",
      lastDoseKind: h.rabiesStatus === "VACCINATED" && h.rabiesDoseKind ? h.rabiesDoseKind : undefined,
      validUntil: h.rabiesStatus === "VACCINATED" ? h.rabiesValidUntil : "",
    },
  };
}
