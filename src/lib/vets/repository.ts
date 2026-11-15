import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, addMonths, formatDate, isAfter, isISODate, type ISODate } from "@/lib/rules/dates";
import type { PlanTask, Rule } from "@/lib/rules/types";
import { windowLabel } from "@/lib/trips/format";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { getTrip, type TripWithPets } from "@/lib/trips/repository";
import { notify, providerUserId } from "@/lib/notifications/repository";
import {
  LAB_TESTS,
  SERVICE_LABEL,
  isLabTest,
  isSlot,
  isVetService,
  parseServices,
  proposeSlots,
  slotDate,
  slotLabel,
  titreOutcome,
} from "./core";

const serviceLabel = (s: string) => SERVICE_LABEL[s as keyof typeof SERVICE_LABEL] ?? s;

/*
 * The vet network. Owners only touch their own appointments; providers only the appointments
 * made with them; labs only their own orders. A vet sees a document only if the owner shared it
 * for one of that vet's appointments.
 */

export type VetResult<T = object> = ({ ok: true } & T) | { ok: false; message?: string; errors?: Record<string, string> };

/* ---------- Directory ---------- */

export function listVets() {
  return db.provider.findMany({ where: { type: "VET", verified: true }, orderBy: { name: "asc" } });
}

/** The plan step an appointment is for, worked out from the live plan. */
export function findTask(trip: TripWithPets, petId: string, taskId: string, today: ISODate, rules?: Rule[]): PlanTask | undefined {
  const entry = planStoredTrip(trip, today, rules).pets.find((p) => p.pet.id === petId);
  return entry?.plan.supported ? entry.plan.tasks.find((t) => t.id === taskId) : undefined;
}

/* ---------- Owner: requesting ---------- */

export type AppointmentRequest = {
  providerId: string;
  petId: string;
  tripId?: string | null;
  taskId?: string | null;
  service: string;
  slot: string;
  documentIds: string[];
  consent: boolean;
  ownerNote?: string;
};

export async function requestAppointment(
  ownerId: string,
  input: AppointmentRequest,
  today: ISODate,
  rules?: Rule[],
): Promise<VetResult<{ appointmentId: string }>> {
  if (!isVetService(input.service)) return { ok: false, message: "Choose what the appointment is for." };
  const pet = await db.pet.findFirst({ where: { id: input.petId, ownerId } });
  if (!pet) return { ok: false, message: "We couldn't find that pet." };
  const provider = await db.provider.findFirst({ where: { id: input.providerId, type: "VET", verified: true } });
  if (!provider || !parseServices(provider.services).includes(input.service)) {
    return { ok: false, message: "That practice doesn't offer this service." };
  }

  let task: PlanTask | undefined;
  if (input.tripId) {
    const trip = await getTrip(ownerId, input.tripId);
    if (!trip || !trip.pets.some((p) => p.petId === pet.id)) return { ok: false, message: "We couldn't find that trip." };
    if (input.taskId) {
      task = findTask(trip, pet.id, input.taskId, today, rules);
      if (!task) return { ok: false, message: "That step isn't part of this pet's plan." };
    }
  }
  if (task?.officialVet && !provider.officialVet) {
    return { ok: false, message: "This step needs an official vet. Choose a practice with one." };
  }

  if (!isSlot(input.slot) || !isAfter(slotDate(input.slot), today)) return { ok: false, errors: { slot: "Choose a time." } };
  if (task && !proposeSlots(provider.id, task.window, today).includes(input.slot)) {
    return { ok: false, errors: { slot: "That time isn't available any more. Choose another." } };
  }

  const documentIds = [...new Set(input.documentIds)];
  if (documentIds.length) {
    if (!input.consent) return { ok: false, errors: { consent: "Tick to agree to share these documents with the practice." } };
    const owned = await db.document.count({ where: { id: { in: documentIds }, ownerId, petId: pet.id } });
    if (owned !== documentIds.length) return { ok: false, message: "We couldn't find one of those documents." };
  }

  const open = await db.appointment.findFirst({
    where: {
      ownerId,
      petId: pet.id,
      tripId: input.tripId ?? null,
      service: input.service,
      status: { in: ["REQUESTED", "ACCEPTED"] },
    },
  });
  if (open) return { ok: false, message: "You already have an appointment for this. Check Your appointments." };

  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { name: true } });
  const appt = await db.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        ownerId,
        petId: pet.id,
        tripId: input.tripId ?? null,
        providerId: provider.id,
        service: input.service,
        taskId: input.taskId ?? null,
        slot: input.slot,
        ownerNote: input.ownerNote?.trim().slice(0, 500) || null,
        documents: { create: documentIds.map((documentId) => ({ documentId })) },
      },
      select: { id: true },
    });
    await notify(tx, {
      userId: provider.userId,
      kind: "APPOINTMENT_REQUESTED",
      title: `New request: ${serviceLabel(input.service)} for ${pet.name}`,
      body: `${owner?.name ?? "A pet owner"} asked for ${slotLabel(input.slot)}${documentIds.length ? ` and shared ${documentIds.length} document${documentIds.length === 1 ? "" : "s"}` : ""}.`,
      href: `/provider/appointments/${created.id}`,
    });
    return created;
  });
  return { ok: true, appointmentId: appt.id };
}

const ownerApptInclude = {
  provider: { select: { name: true, city: true, postcode: true, officialVet: true } },
  pet: { select: { id: true, name: true, species: true } },
  trip: { select: { id: true, origin: true, destination: true, arrivalDate: true } },
  labOrders: { include: { lab: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
  documents: { include: { document: { select: { id: true, fileName: true } } } },
} satisfies Prisma.AppointmentInclude;

export function listOwnerAppointments(ownerId: string) {
  return db.appointment.findMany({ where: { ownerId }, orderBy: { slot: "asc" }, include: ownerApptInclude });
}

export function ownerAppointmentsForTrip(ownerId: string, tripId: string) {
  return db.appointment.findMany({
    where: { ownerId, tripId, status: { not: "DECLINED" } },
    orderBy: { createdAt: "desc" },
    include: ownerApptInclude,
  });
}

/* ---------- Provider: inbox and appointment ---------- */

export function listProviderAppointments(providerId: string) {
  return db.appointment.findMany({
    where: { providerId },
    orderBy: [{ slot: "asc" }],
    include: {
      pet: { select: { name: true, species: true, breed: true } },
      owner: { select: { name: true } },
      trip: { select: { origin: true, destination: true, arrivalDate: true } },
      _count: { select: { documents: true } },
    },
  });
}

export async function getProviderAppointment(providerId: string, id: string) {
  const appt = await db.appointment.findFirst({
    where: { id, providerId },
    include: {
      pet: true,
      owner: { select: { name: true } },
      documents: {
        include: { document: { select: { id: true, type: true, fileName: true, status: true, mimeType: true, size: true } } },
      },
      labOrders: { include: { lab: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!appt) return null;
  /* The vet sees the trip plan for this pet only, never the owner's other pets */
  const trip = appt.tripId ? await getTrip(appt.ownerId, appt.tripId) : null;
  const scopedTrip = trip ? { ...trip, pets: trip.pets.filter((p) => p.petId === appt.petId), taskRecords: trip.taskRecords.filter((r) => r.petId === appt.petId) } : null;
  return { ...appt, trip: scopedTrip };
}

export type ProviderAppointment = NonNullable<Awaited<ReturnType<typeof getProviderAppointment>>>;

export async function respondToAppointment(providerId: string, id: string, decision: "ACCEPTED" | "DECLINED"): Promise<VetResult> {
  return db.$transaction(async (tx) => {
    const res = await tx.appointment.updateMany({ where: { id, providerId, status: "REQUESTED" }, data: { status: decision } });
    if (!res.count) return { ok: false, message: "This request has already been answered." };
    const appt = await tx.appointment.findUniqueOrThrow({
      where: { id },
      select: { ownerId: true, service: true, slot: true, pet: { select: { name: true } }, provider: { select: { name: true } } },
    });
    const accepted = decision === "ACCEPTED";
    await notify(tx, {
      userId: appt.ownerId,
      kind: accepted ? "APPOINTMENT_ACCEPTED" : "APPOINTMENT_DECLINED",
      title: accepted
        ? `${appt.provider.name} confirmed ${appt.pet.name}'s appointment`
        : `${appt.provider.name} couldn't take ${appt.pet.name}'s appointment`,
      body: accepted
        ? `${serviceLabel(appt.service)}, ${slotLabel(appt.slot)}.`
        : `${serviceLabel(appt.service)}, ${slotLabel(appt.slot)}. Choose another practice or time.`,
      href: "/app/vets",
    });
    return { ok: true } as const;
  });
}

/** True only when the owner shared this document for one of this provider's live appointments. */
export async function canProviderOpenDocument(providerId: string, documentId: string) {
  const share = await db.appointmentDocument.findFirst({
    where: { documentId, appointment: { providerId, status: { not: "DECLINED" } } },
    select: { documentId: true },
  });
  return !!share;
}

/* ---------- Provider: recording the work ---------- */

const RECORD_FOR: Partial<Record<string, string>> = {
  ANIMAL_HEALTH_CERTIFICATE: "ahcIssuedOn",
  TAPEWORM_TREATMENT: "tapeworm",
};

/**
 * Records what the vet did. A certificate or treatment completes the step on the owner's trip
 * (checked against the rules, so a certificate issued outside its window is refused); a
 * vaccination or microchip updates the pet. All of it is marked as recorded by the practice.
 */
export async function recordVetService(
  providerId: string,
  id: string,
  input: { date: string; microchipNumber?: string },
  today: ISODate,
  rules?: Rule[],
): Promise<VetResult<{ summary: string }>> {
  const appt = await db.appointment.findFirst({
    where: { id, providerId },
    include: { pet: true, provider: { select: { name: true } } },
  });
  if (!appt) return { ok: false, message: "We couldn't find that appointment." };
  if (appt.status !== "ACCEPTED") return { ok: false, message: "Accept the appointment first." };
  if (!isISODate(input.date)) return { ok: false, errors: { date: "Enter a valid date." } };
  if (isAfter(input.date, today)) return { ok: false, errors: { date: "The date can't be in the future." } };

  const pet = appt.pet;
  const by = appt.provider.name;
  let summary: string;
  let petUpdate: Prisma.PetUpdateInput | null = null;
  let record: { tripId: string; key: string } | null = null;

  const recordKey = RECORD_FOR[appt.service];
  if (recordKey) {
    const trip = appt.tripId ? await getTrip(appt.ownerId, appt.tripId) : null;
    if (!trip) return { ok: false, message: "This appointment isn't linked to a trip." };
    const key = recordKey === "tapeworm" ? (isAfter(input.date, trip.arrivalDate) ? "tapewormReturnOn" : "tapewormOutboundOn") : recordKey;
    const taskId = key === "ahcIssuedOn" ? "ahc" : key === "tapewormOutboundOn" ? "tapeworm-outbound" : "tapeworm-return";
    const before = findTask(trip, pet.id, taskId, today, rules);
    if (!before) return { ok: false, message: `${SERVICE_LABEL[appt.service as keyof typeof SERVICE_LABEL]} isn't part of ${pet.name}'s plan for this trip.` };
    const candidate = {
      ...trip,
      taskRecords: [
        ...trip.taskRecords.filter((r) => !(r.petId === pet.id && r.key === key)),
        { petId: pet.id, key, doneOn: input.date, source: "VET", documentId: null, issuedBy: by },
      ],
    };
    if (findTask(candidate, pet.id, taskId, today, rules)?.status !== "DONE") {
      const w = windowLabel(before.window);
      return { ok: false, errors: { date: `That date doesn't count for this trip${w ? `: it must fall ${before.window?.from ? "between" : "by"} ${w.replace(/^By /, "")}` : ""}.` } };
    }
    record = { tripId: trip.id, key };
    summary =
      key === "ahcIssuedOn"
        ? `Animal health certificate issued ${formatDate(input.date)} by ${by}, for ${routeTitle(trip)}.`
        : `Tapeworm treatment given ${formatDate(input.date)} by ${by}.`;
  } else if (appt.service === "RABIES_VACCINATION" || appt.service === "RABIES_BOOSTER") {
    const booster = appt.service === "RABIES_BOOSTER";
    petUpdate = {
      rabiesStatus: "VACCINATED",
      rabiesLastDose: input.date,
      rabiesDoseKind: booster ? "BOOSTER" : "PRIMARY",
      /* Sample validity: a first dose for a year, a booster for three */
      rabiesValidUntil: addDays(addMonths(input.date, booster ? 36 : 12), -1),
    };
    summary = `${booster ? "Rabies booster" : "Rabies vaccination"} given ${formatDate(input.date)} by ${by}.`;
  } else if (appt.service === "MICROCHIP") {
    const chip = (input.microchipNumber ?? "").replace(/\s/g, "");
    if (!/^\d{15}$/.test(chip)) return { ok: false, errors: { microchipNumber: "Enter the 15-digit microchip number." } };
    petUpdate = { microchipStatus: "YES", microchipNumber: chip, microchipDate: input.date };
    summary = `Microchip ${chip} implanted ${formatDate(input.date)} by ${by}.`;
  } else {
    return { ok: false, message: "This service can't be recorded here." };
  }

  await db.$transaction(async (tx) => {
    if (petUpdate) await tx.pet.update({ where: { id: pet.id }, data: petUpdate });
    if (record) {
      await tx.taskRecord.upsert({
        where: { tripId_petId_key: { tripId: record.tripId, petId: pet.id, key: record.key } },
        create: { tripId: record.tripId, petId: pet.id, key: record.key, doneOn: input.date, source: "VET", issuedBy: by },
        update: { doneOn: input.date, source: "VET", issuedBy: by, documentId: null },
      });
    }
    await tx.appointment.update({ where: { id }, data: { status: "COMPLETED" } });
    await notify(tx, {
      userId: appt.ownerId,
      kind: "VET_RECORDED",
      title: `${by}: ${serviceLabel(appt.service).toLowerCase()} recorded for ${pet.name}`,
      body: summary,
      href: record ? `/app/trips/${record.tripId}` : `/app/pets/${pet.id}`,
    });
  });
  return { ok: true, summary };
}

/* ---------- Lab orders ---------- */

export async function orderLabTest(providerId: string, appointmentId: string, test: string): Promise<VetResult<{ orderId: string }>> {
  if (!isLabTest(test)) return { ok: false, message: "Choose a test." };
  const appt = await db.appointment.findFirst({ where: { id: appointmentId, providerId, status: { in: ["ACCEPTED", "COMPLETED"] } } });
  if (!appt) return { ok: false, message: "Accept the appointment before ordering tests." };
  const labs = await db.provider.findMany({ where: { type: "LAB", verified: true }, orderBy: { createdAt: "asc" } });
  const lab = labs.find((l) => parseServices(l.services).includes(test));
  if (!lab) return { ok: false, message: "No partner lab offers this test." };
  const existing = await db.labOrder.findFirst({ where: { appointmentId, test, status: "ORDERED" } });
  if (existing) return { ok: false, message: "This test is already ordered." };
  const details = await db.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: { ownerId: true, pet: { select: { name: true } }, provider: { select: { name: true } } },
  });
  const label = LAB_TESTS[test].label;
  const order = await db.$transaction(async (tx) => {
    const created = await tx.labOrder.create({ data: { appointmentId, labId: lab.id, test }, select: { id: true } });
    await notify(
      tx,
      {
        userId: lab.userId,
        kind: "LAB_ORDERED",
        title: `New order: ${label} for ${details.pet.name}`,
        body: `Ordered by ${details.provider.name}.`,
        href: `/provider/lab-orders/${created.id}`,
      },
      {
        userId: details.ownerId,
        kind: "LAB_ORDERED",
        title: `${details.provider.name} ordered a ${label.toLowerCase()} for ${details.pet.name}`,
        body: `${lab.name} will post the result here.`,
        href: "/app/vets",
      },
    );
    return created;
  });
  return { ok: true, orderId: order.id };
}

const labInclude = {
  appointment: {
    select: {
      id: true,
      slot: true,
      ownerId: true,
      tripId: true,
      providerId: true,
      pet: { select: { name: true, species: true, breed: true, microchipNumber: true } },
      provider: { select: { name: true } },
    },
  },
} satisfies Prisma.LabOrderInclude;

export function listLabOrders(labId: string) {
  return db.labOrder.findMany({ where: { labId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], include: labInclude });
}

export function getLabOrder(labId: string, id: string) {
  return db.labOrder.findFirst({ where: { id, labId }, include: labInclude });
}

export async function postLabResult(
  labId: string,
  id: string,
  input: { value?: string; outcome?: string; note?: string },
  today: ISODate,
): Promise<VetResult<{ summary: string }>> {
  const order = await db.labOrder.findFirst({ where: { id, labId }, include: labInclude });
  if (!order) return { ok: false, message: "We couldn't find that order." };
  if (order.status !== "ORDERED") return { ok: false, message: "A result has already been posted." };
  const note = input.note?.trim().slice(0, 500) || null;
  let resultValue: number | null = null;
  let outcome: "PASS" | "FAIL";
  if (order.test === "RABIES_TITRE") {
    const v = Number(input.value);
    if (!input.value?.trim() || !Number.isFinite(v) || v < 0 || v > 100) {
      return { ok: false, errors: { value: "Enter the titre in IU/mL, for example 2.4." } };
    }
    resultValue = Math.round(v * 100) / 100;
    outcome = titreOutcome(resultValue);
  } else if (input.outcome === "PASS" || input.outcome === "FAIL") {
    outcome = input.outcome;
  } else {
    return { ok: false, errors: { outcome: "Choose the outcome." } };
  }
  const t = LAB_TESTS[order.test as keyof typeof LAB_TESTS];
  void today;
  const summary = `${t.label} for ${order.appointment.pet.name}: ${resultValue !== null ? `${resultValue} ${t.unit}, ` : ""}${outcome === "PASS" ? "pass" : "below the pass mark"}.`;
  const appt = order.appointment;
  await db.$transaction(async (tx) => {
    await tx.labOrder.update({ where: { id }, data: { status: "RESULTED", resultValue, outcome, resultNote: note, resultedAt: new Date() } });
    const vetUserId = await providerUserId(tx, appt.providerId);
    await notify(
      tx,
      {
        userId: appt.ownerId,
        kind: "LAB_RESULT",
        title: `${t.label} result for ${appt.pet.name}`,
        body: `${summary} Sample result for the demo.`,
        href: appt.tripId ? `/app/trips/${appt.tripId}` : "/app/vets",
      },
      ...(vetUserId
        ? [{ userId: vetUserId, kind: "LAB_RESULT" as const, title: `Result in: ${t.label} for ${appt.pet.name}`, body: summary, href: `/provider/appointments/${appt.id}` }]
        : []),
    );
  });
  return { ok: true, summary };
}

/** Results and pending tests for an owner's pets, newest first. */
export function labOrdersForOwner(ownerId: string, petIds?: string[]) {
  return db.labOrder.findMany({
    where: { appointment: { ownerId, ...(petIds ? { petId: { in: petIds } } : {}) } },
    orderBy: { createdAt: "desc" },
    include: { lab: { select: { name: true } }, appointment: { select: { petId: true, provider: { select: { name: true } } } } },
  });
}
