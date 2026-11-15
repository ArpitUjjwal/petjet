import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAfter, isISODate } from "@/lib/rules/dates";
import type { Rule } from "@/lib/rules/types";
import { checkCoverage, type CoverageIssue } from "./coverage";
import { planStoredTrip } from "./plan";
import { OWNER_STEPS, ownerStep } from "./records";
import {
  draftSchema,
  issuesToErrors,
  petHealthSchema,
  petProfileSchema,
  tripDatesSchema,
  type PetHealth,
  type PetProfile,
} from "./schemas";

/*
 * Data access for pets and trips. Every function takes the owner's id and only ever
 * reads or writes that owner's rows, so one owner can never see or change another's.
 */

export type Result<T> =
  | ({ ok: true } & T)
  | { ok: false; errors?: Record<string, string>; issues?: CoverageIssue[]; message?: string };

function profileData(p: PetProfile) {
  return {
    name: p.name,
    species: p.species,
    breed: p.breed ?? null,
    birthYear: p.birthYear,
    birthMonth: p.birthMonth,
    birthDay: p.birthDay ?? null,
    weightKg: p.weightKg ?? null,
    hasPedigree: p.hasPedigree ?? null,
  };
}

function healthData(h: PetHealth) {
  const chipped = h.microchip.status === "YES";
  const vaccinated = h.rabies.status === "VACCINATED";
  return {
    microchipStatus: h.microchip.status,
    microchipNumber: chipped ? (h.microchip.number ?? null) : null,
    microchipDate: chipped ? (h.microchip.implantedOn ?? null) : null,
    rabiesStatus: h.rabies.status,
    rabiesLastDose: vaccinated ? (h.rabies.lastDoseOn ?? null) : null,
    rabiesDoseKind:
      vaccinated && (h.rabies.lastDoseKind === "PRIMARY" || h.rabies.lastDoseKind === "BOOSTER")
        ? h.rabies.lastDoseKind
        : null,
    rabiesValidUntil: vaccinated ? (h.rabies.validUntil ?? null) : null,
  };
}

/* ---------- Pets ---------- */

export function listPets(ownerId: string) {
  return db.pet.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { trips: true } } },
  });
}

export function getPet(ownerId: string, petId: string) {
  return db.pet.findFirst({ where: { id: petId, ownerId } });
}

export async function savePet(
  ownerId: string,
  input: { profile: unknown; health: unknown },
  today: string,
  petId?: string,
): Promise<Result<{ petId: string }>> {
  const profile = petProfileSchema(today).safeParse(input.profile);
  const health = petHealthSchema(today).safeParse(input.health);
  if (!profile.success || !health.success) {
    return {
      ok: false,
      errors: {
        ...(profile.success ? {} : prefix("profile", issuesToErrors(profile.error))),
        ...(health.success ? {} : prefix("health", issuesToErrors(health.error))),
      },
    };
  }
  const data = { ...profileData(profile.data), ...healthData(health.data) };
  if (petId) {
    const updated = await db.pet.updateMany({ where: { id: petId, ownerId }, data });
    if (updated.count === 0) return { ok: false, message: "We couldn't find that pet." };
    return { ok: true, petId };
  }
  const created = await db.pet.create({ data: { ...data, ownerId }, select: { id: true } });
  return { ok: true, petId: created.id };
}

export async function deletePet(ownerId: string, petId: string): Promise<Result<object>> {
  return db.$transaction(async (tx) => {
    const pet = await tx.pet.findFirst({ where: { id: petId, ownerId }, select: { id: true } });
    if (!pet) return { ok: false, message: "We couldn't find that pet." };
    const tripIds = (await tx.tripPet.findMany({ where: { petId }, select: { tripId: true } })).map(
      (t) => t.tripId,
    );
    await tx.pet.delete({ where: { id: petId } });
    /* A trip with no pets left has nothing to plan */
    if (tripIds.length) {
      await tx.trip.deleteMany({ where: { id: { in: tripIds }, ownerId, pets: { none: {} } } });
    }
    return { ok: true };
  });
}

/* ---------- Trips ---------- */

const tripInclude = {
  pets: { include: { pet: true }, orderBy: { pet: { createdAt: "asc" } } },
  taskRecords: { select: { petId: true, key: true, doneOn: true, source: true, documentId: true, issuedBy: true } },
} satisfies Prisma.TripInclude;

export function listTrips(ownerId: string) {
  return db.trip.findMany({ where: { ownerId }, orderBy: { arrivalDate: "asc" }, include: tripInclude });
}

export function getTrip(ownerId: string, tripId: string) {
  return db.trip.findFirst({ where: { id: tripId, ownerId }, include: tripInclude });
}

export async function deleteTrip(ownerId: string, tripId: string): Promise<Result<object>> {
  const res = await db.trip.deleteMany({ where: { id: tripId, ownerId } });
  return res.count ? { ok: true } : { ok: false, message: "We couldn't find that trip." };
}

/**
 * Saves a finished questionnaire: creates new pets, updates the health answers of
 * existing ones, and creates the trip. Validation and the coverage check run again here,
 * whatever the browser already checked.
 */
export async function createTripFromDraft(
  ownerId: string,
  rawDraft: unknown,
  today: string,
): Promise<Result<{ tripId: string }>> {
  const parsed = draftSchema(today).safeParse(rawDraft);
  if (!parsed.success) return { ok: false, errors: issuesToErrors(parsed.error) };
  const draft = parsed.data;

  const issues = checkCoverage(
    draft.pets.map((p) => ({ name: p.profile.name, species: p.profile.species })),
    draft.trip,
    today,
  );
  if (issues.length) return { ok: false, issues };

  const existingIds = draft.pets.map((p) => p.existingId).filter((id): id is string => !!id);
  if (new Set(existingIds).size !== existingIds.length) {
    return { ok: false, message: "The same pet was added twice." };
  }

  return db.$transaction(async (tx) => {
    if (existingIds.length) {
      const owned = await tx.pet.count({ where: { id: { in: existingIds }, ownerId } });
      if (owned !== existingIds.length) return { ok: false, message: "We couldn't find one of those pets." };
    }
    const petIds: string[] = [];
    for (const p of draft.pets) {
      const data = { ...profileData(p.profile), ...healthData(p.health) };
      if (p.existingId) {
        await tx.pet.update({ where: { id: p.existingId }, data });
        petIds.push(p.existingId);
      } else {
        const created = await tx.pet.create({ data: { ...data, ownerId }, select: { id: true } });
        petIds.push(created.id);
      }
    }
    const t = draft.trip;
    const trip = await tx.trip.create({
      data: {
        ownerId,
        origin: t.origin,
        destination: t.destination,
        arrivalDate: t.arrivalDate,
        returnDate: t.noReturnYet ? null : (t.returnDate ?? null),
        transit: t.transit === "AIRSIDE" ? "AIRSIDE" : "NONE",
        accompaniment: t.accompaniment === "AUTHORISED_PERSON" ? "AUTHORISED_PERSON" : "OWNER",
        departureAirport: t.departureAirport ?? null,
        arrivalAirport: t.arrivalAirport ?? null,
        petPlacement: t.petPlacement,
        recordsAvailable: draft.recordsAvailable,
        pets: { create: petIds.map((petId) => ({ petId })) },
      },
      select: { id: true },
    });
    return { ok: true, tripId: trip.id };
  });
}

/** Changes a trip's dates. The plan is never stored, so it recalculates on the next read. */
export async function updateTripDates(
  ownerId: string,
  tripId: string,
  input: unknown,
  today: string,
): Promise<Result<object>> {
  const parsed = tripDatesSchema(today).safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesToErrors(parsed.error) };
  const d = parsed.data;
  const res = await db.trip.updateMany({
    where: { id: tripId, ownerId },
    data: { arrivalDate: d.arrivalDate, returnDate: d.noReturnYet ? null : (d.returnDate ?? null) },
  });
  return res.count ? { ok: true } : { ok: false, message: "We couldn't find that trip." };
}

/* ---------- Steps owners confirm themselves ---------- */

export type StepRef = { tripId: string; petId: string; taskId: string };

/**
 * Records that the owner has done one of their own steps. Only steps listed in OWNER_STEPS
 * qualify, and the date must make the engine treat the step as done (a CDC form submitted
 * too early doesn't count), so a tick never says more than the rules allow.
 */
export async function recordOwnerStep(
  ownerId: string,
  ref: StepRef & { doneOn: string },
  today: string,
  rules?: Rule[],
): Promise<Result<object>> {
  const step = OWNER_STEPS[ref.taskId];
  if (!step) return { ok: false, message: "Your vet or your documents complete this step." };
  if (!isISODate(ref.doneOn)) return { ok: false, errors: { doneOn: "Enter a valid date." } };
  if (isAfter(ref.doneOn, today)) return { ok: false, errors: { doneOn: "The date can't be in the future." } };

  const trip = await getTrip(ownerId, ref.tripId);
  if (!trip || !trip.pets.some((p) => p.petId === ref.petId)) {
    return { ok: false, message: "We couldn't find that trip." };
  }
  const findTask = (t: typeof trip) => {
    const entry = planStoredTrip(t, today, rules).pets.find((p) => p.pet.id === ref.petId);
    return entry?.plan.supported ? entry.plan.tasks.find((x) => x.id === ref.taskId) : undefined;
  };
  const task = findTask(trip);
  if (!task || !ownerStep(task)) return { ok: false, message: "This step isn't part of this pet's plan." };

  const candidate = {
    ...trip,
    taskRecords: [
      ...trip.taskRecords.filter((r) => !(r.petId === ref.petId && r.key === step.key)),
      { petId: ref.petId, key: step.key, doneOn: ref.doneOn, source: "OWNER", documentId: null, issuedBy: null },
    ],
  };
  if (findTask(candidate)?.status !== "DONE") {
    return { ok: false, errors: { doneOn: "That date doesn't count for this step. Check the dates in the step." } };
  }

  await db.taskRecord.upsert({
    where: { tripId_petId_key: { tripId: ref.tripId, petId: ref.petId, key: step.key } },
    create: { tripId: ref.tripId, petId: ref.petId, key: step.key, doneOn: ref.doneOn, source: "OWNER" },
    update: { doneOn: ref.doneOn, source: "OWNER" },
  });
  return { ok: true };
}

/** Undoes an owner's own tick. Records from documents or vets can't be removed this way. */
export async function clearOwnerStep(ownerId: string, ref: StepRef): Promise<Result<object>> {
  const step = OWNER_STEPS[ref.taskId];
  if (!step) return { ok: false, message: "Your vet or your documents complete this step." };
  const res = await db.taskRecord.deleteMany({
    where: { tripId: ref.tripId, petId: ref.petId, key: step.key, source: "OWNER", trip: { ownerId } },
  });
  return res.count ? { ok: true } : { ok: false, message: "There was nothing to undo." };
}

function prefix(p: string, errors: Record<string, string>) {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${p}.${k}`, v]));
}

export type TripWithPets = NonNullable<Awaited<ReturnType<typeof getTrip>>>;
