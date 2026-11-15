import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDate, isAfter, isISODate, type ISODate } from "@/lib/rules/dates";
import { routeTitle } from "@/lib/trips/plan";
import {
  CONFIDENT,
  DOC_TYPE_LABEL,
  FIELD_SPECS,
  TRIP_TYPES,
  checkFields,
  classify,
  extractFields,
  isDocType,
  reviewState,
  type DocType,
  type FieldIssue,
  type FieldKey,
} from "./extract";
import { readPdfText } from "./pdf-text";
import { MAX_UPLOAD_BYTES, cleanFileName, removeUpload, saveUpload, sha256, sniff } from "./storage";

/*
 * The document vault. Every function takes the owner's id and only touches that owner's rows.
 * Extracted details never change a pet or a plan until the owner confirms them.
 */

export type DocResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; message?: string; errors?: Record<string, string> };

export type ReadMode = "TEXT" | "NO_TEXT" | "IMAGE";
export type DocStatus = "READY" | "NEEDS_REVIEW" | "CONFIRMED" | "STORED";

const PAGE_BREAK = "\f";

/* ---------- Status ---------- */

type PetForChecks = {
  name: string;
  species: string;
  microchipNumber: string | null;
  microchipDate: string | null;
  birthYear: number;
  birthMonth: number;
  birthDay: number | null;
};

type FieldRow = { key: string; value: string | null; confidence: number; origin: string };

/** Issues for a stored document; edited or typed-in values count as certain. */
export function issuesFor(
  doc: { type: string; typeConfidence: number; readMode: string; fields: FieldRow[] },
  pet: PetForChecks,
  today: ISODate,
): FieldIssue[] {
  const type = isDocType(doc.type) ? doc.type : "OTHER";
  if (type === "OTHER") return [];
  const fields = doc.fields.map((f) => ({
    key: f.key as FieldKey,
    value: f.value,
    confidence: f.origin === "EXTRACTED" ? f.confidence : 1,
  }));
  return checkFields(type, fields, pet, today, {
    typeConfidence: doc.readMode === "TEXT" ? doc.typeConfidence : undefined,
    readable: doc.readMode === "TEXT",
  });
}

function statusFor(type: DocType, readMode: ReadMode, issues: FieldIssue[]): DocStatus {
  /* A photo or scan with no type chosen yet still needs the owner */
  if (type === "OTHER" && readMode !== "TEXT") return "NEEDS_REVIEW";
  return reviewState(type, issues);
}

/* ---------- Upload ---------- */

async function defaultTrip(ownerId: string, petId: string, today: ISODate) {
  const trips = await db.trip.findMany({
    where: { ownerId, pets: { some: { petId } } },
    orderBy: { arrivalDate: "asc" },
    select: { id: true, arrivalDate: true },
  });
  return (trips.find((t) => t.arrivalDate >= today) ?? trips.at(-1))?.id ?? null;
}

function fieldRows(type: DocType, pages: string[], readable: boolean) {
  const extracted = readable ? extractFields(type, pages) : FIELD_SPECS[type].map((s) => ({ key: s.key, value: null, raw: null, confidence: 0, evidence: null, page: null }));
  return extracted.map((f) => ({ ...f, origin: "EXTRACTED" }));
}

export async function uploadDocument(
  ownerId: string,
  input: { petId: string; type?: string; file: { name: string; bytes: Uint8Array } },
  today: ISODate,
): Promise<DocResult<{ documentId: string }>> {
  const { bytes } = input.file;
  if (!input.petId) return { ok: false, errors: { petId: "Choose which pet this document is for." } };
  if (!bytes.length) return { ok: false, errors: { file: "Choose a file to upload." } };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, errors: { file: "Files can be up to 10 MB." } };
  const kind = sniff(bytes);
  if (!kind) return { ok: false, errors: { file: "Upload a PDF, JPG or PNG file." } };

  const pet = await db.pet.findFirst({ where: { id: input.petId, ownerId } });
  if (!pet) return { ok: false, errors: { petId: "Choose which pet this document is for." } };

  let pages: string[] = [];
  let readMode: ReadMode = "IMAGE";
  if (!kind.image) {
    try {
      pages = (await readPdfText(bytes)).pages;
    } catch {
      return {
        ok: false,
        errors: { file: "We couldn't open this PDF. It may be damaged or password-protected. Try saving it again, or upload a photo instead." },
      };
    }
    readMode = pages.some((p) => p.trim()) ? "TEXT" : "NO_TEXT";
  }

  const readable = readMode === "TEXT";
  const detected = readable ? classify(pages) : { type: "OTHER" as DocType, confidence: 0 };
  const hint = isDocType(input.type) ? input.type : null;
  const type: DocType = hint ?? detected.type;
  const fields = fieldRows(type, pages, readable);
  const issues = checkFields(type, fields, pet, today, { typeConfidence: hint ? undefined : detected.confidence, readable });
  const status = statusFor(type, readMode, issues);
  const tripId = TRIP_TYPES.includes(type) ? await defaultTrip(ownerId, pet.id, today) : null;

  const storedName = await saveUpload(ownerId, bytes, kind.ext);
  try {
    const doc = await db.document.create({
      data: {
        ownerId,
        petId: pet.id,
        tripId,
        type,
        detectedType: detected.type,
        /* An owner's own choice of type is certain */
        typeConfidence: hint ? 1 : detected.confidence,
        fileName: cleanFileName(input.file.name, kind.ext),
        storedName,
        mimeType: kind.mime,
        size: bytes.length,
        sha256: sha256(bytes),
        readMode,
        text: pages.join(PAGE_BREAK),
        status,
        fields: { create: fields.map(({ key, value, raw, confidence, evidence, page, origin }) => ({ key, value, raw, confidence, evidence, page, origin })) },
      },
      select: { id: true },
    });
    return { ok: true, documentId: doc.id };
  } catch (e) {
    await removeUpload(storedName);
    throw e;
  }
}

/* ---------- Reading ---------- */

const docInclude = {
  pet: true,
  trip: { select: { id: true, origin: true, destination: true, arrivalDate: true, returnDate: true } },
  fields: true,
} satisfies Prisma.DocumentInclude;

export function listDocuments(ownerId: string) {
  return db.document.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      pet: { select: { id: true, name: true, species: true } },
      trip: { select: { id: true, origin: true, destination: true, arrivalDate: true } },
    },
  });
}

export function getDocument(ownerId: string, id: string) {
  return db.document.findFirst({ where: { id, ownerId }, include: docInclude });
}

export type DocumentWithDetails = NonNullable<Awaited<ReturnType<typeof getDocument>>>;

/** Trips the document's pet is on, for choosing which trip a certificate belongs to. */
export function tripsForPet(ownerId: string, petId: string) {
  return db.trip.findMany({
    where: { ownerId, pets: { some: { petId } } },
    orderBy: { arrivalDate: "asc" },
    select: { id: true, origin: true, destination: true, arrivalDate: true, returnDate: true },
  });
}

export async function countToReview(ownerId: string) {
  return db.document.count({ where: { ownerId, status: { in: ["NEEDS_REVIEW", "READY"] } } });
}

/** Confirmed documents for these pets, newest first, for linking plan steps to their evidence. */
export function confirmedDocuments(ownerId: string, petIds: string[]) {
  return db.document.findMany({
    where: { ownerId, petId: { in: petIds }, status: "CONFIRMED" },
    orderBy: { confirmedAt: "desc" },
    select: {
      id: true,
      petId: true,
      tripId: true,
      type: true,
      fileName: true,
      fields: { where: { key: { in: ["vaccinationDate", "microchipNumber"] } }, select: { key: true, value: true } },
    },
  });
}

/* ---------- Changing the type ---------- */

export async function changeDocumentType(ownerId: string, id: string, rawType: string, today: ISODate): Promise<DocResult> {
  if (!isDocType(rawType)) return { ok: false, message: "Choose a document type." };
  const doc = await getDocument(ownerId, id);
  if (!doc) return { ok: false, message: "We couldn't find that document." };
  if (doc.status === "CONFIRMED") return { ok: false, message: "This document is already confirmed." };
  const type = rawType;
  const readable = doc.readMode === "TEXT";
  const fields = fieldRows(type, doc.text.split(PAGE_BREAK), readable);
  const tripId = TRIP_TYPES.includes(type) ? (doc.tripId ?? (await defaultTrip(ownerId, doc.petId, today))) : null;
  const issues = checkFields(type, fields, doc.pet, today, { readable });
  await db.$transaction([
    db.documentField.deleteMany({ where: { documentId: id } }),
    db.document.update({
      where: { id },
      data: {
        type,
        typeConfidence: 1,
        tripId,
        status: statusFor(type, doc.readMode as ReadMode, issues),
        fields: { create: fields.map(({ key, value, raw, confidence, evidence, page, origin }) => ({ key, value, raw, confidence, evidence, page, origin })) },
      },
    }),
  ]);
  return { ok: true };
}

/* ---------- Confirming ---------- */

function normalise(kind: string, value: string) {
  const v = value.trim();
  if (!v) return null;
  if (kind === "chip") return v.replace(/\s/g, "").toUpperCase();
  return v;
}

export type ConfirmInput = {
  fields: Record<string, string>;
  tripId?: string | null;
  /** The owner ticked that they've checked everything flagged */
  acknowledged?: boolean;
};

/**
 * Saves the owner's checked details and applies them: a rabies record or microchip certificate
 * updates the pet's profile; a certificate, treatment or receipt completes that step on a trip.
 * The engine then recalculates the plan from these facts on the next read.
 */
export async function confirmDocument(
  ownerId: string,
  id: string,
  input: ConfirmInput,
  today: ISODate,
): Promise<DocResult<{ applied: string[] }>> {
  const doc = await getDocument(ownerId, id);
  if (!doc) return { ok: false, message: "We couldn't find that document." };
  if (doc.status === "CONFIRMED") return { ok: false, message: "This document is already confirmed." };
  const type = isDocType(doc.type) ? doc.type : "OTHER";
  if (type === "OTHER") return { ok: false, message: "Choose what kind of document this is first." };

  /* The owner's values replace what was read; changed ones are marked as edited */
  const specs = FIELD_SPECS[type];
  const next = specs.map((spec) => {
    const stored = doc.fields.find((f) => f.key === spec.key);
    const submitted = spec.key in input.fields ? normalise(spec.kind, input.fields[spec.key] ?? "") : (stored?.value ?? null);
    const changed = submitted !== (stored?.value ?? null);
    return {
      key: spec.key,
      value: submitted,
      confidence: changed ? 1 : (stored?.confidence ?? 0),
      origin: changed ? (stored?.value ? "EDITED" : "MANUAL") : (stored?.origin ?? "EXTRACTED"),
    };
  });

  const issues = issuesFor({ ...doc, fields: next }, doc.pet, today);
  const blocking = issues.filter((i) => i.level === "block");
  if (blocking.length) {
    return { ok: false, errors: Object.fromEntries(blocking.map((i) => [i.key, i.message])) };
  }
  if (issues.length && !input.acknowledged) {
    return { ok: false, errors: { acknowledged: "Tick the box to confirm you've checked the flagged details." } };
  }

  let trip: { id: string; origin: string; destination: string; arrivalDate: string } | null = null;
  if (TRIP_TYPES.includes(type)) {
    const tripId = input.tripId ?? doc.tripId;
    trip = tripId
      ? await db.trip.findFirst({
          where: { id: tripId, ownerId, pets: { some: { petId: doc.petId } } },
          select: { id: true, origin: true, destination: true, arrivalDate: true },
        })
      : null;
    if (!trip) return { ok: false, errors: { tripId: `Choose the trip this ${DOC_TYPE_LABEL[type].toLowerCase()} is for.` } };
  }

  const v = (k: FieldKey) => next.find((f) => f.key === k)?.value ?? null;
  const pet = doc.pet;
  const applied: string[] = [];
  const petUpdate: Prisma.PetUpdateInput = {};
  let record: { key: string; doneOn: string } | null = null;

  switch (type) {
    case "RABIES": {
      const date = v("vaccinationDate")!;
      const validUntil = v("validUntil");
      const dose = v("doseKind");
      /* An older record never replaces a more recent dose already on file */
      if (pet.rabiesStatus === "VACCINATED" && pet.rabiesLastDose && isAfter(pet.rabiesLastDose, date)) {
        applied.push(`Kept ${pet.name}'s more recent vaccination on file (${formatDate(pet.rabiesLastDose)}). This record is stored for reference.`);
      } else {
        petUpdate.rabiesStatus = "VACCINATED";
        petUpdate.rabiesLastDose = date;
        petUpdate.rabiesValidUntil = validUntil && isISODate(validUntil) ? validUntil : null;
        if (dose === "BOOSTER" || dose === "PRIMARY") petUpdate.rabiesDoseKind = dose;
        applied.push(
          `${pet.name}'s rabies vaccination: ${formatDate(date)}${validUntil && isISODate(validUntil) ? `, valid until ${formatDate(validUntil)}` : ""}.`,
        );
      }
      const chip = v("microchipNumber");
      if (chip && !pet.microchipNumber) {
        petUpdate.microchipStatus = "YES";
        petUpdate.microchipNumber = chip;
        applied.push(`${pet.name}'s microchip number: ${chip}.`);
      }
      break;
    }
    case "MICROCHIP": {
      const chip = v("microchipNumber")!;
      const implanted = v("implantDate");
      petUpdate.microchipStatus = "YES";
      petUpdate.microchipNumber = chip;
      if (implanted && isISODate(implanted)) petUpdate.microchipDate = implanted;
      applied.push(`${pet.name}'s microchip: ${chip}${implanted && isISODate(implanted) ? `, implanted ${formatDate(implanted)}` : ""}.`);
      break;
    }
    case "AHC":
      record = { key: "ahcIssuedOn", doneOn: v("issuedOn")! };
      applied.push(`Animal health certificate issued ${formatDate(record.doneOn)}, for ${routeTitle(trip!)}.`);
      break;
    case "TAPEWORM": {
      const on = v("treatedOn")!;
      const outbound = !isAfter(on, trip!.arrivalDate);
      record = { key: outbound ? "tapewormOutboundOn" : "tapewormReturnOn", doneOn: on };
      applied.push(`Tapeworm treatment on ${formatDate(on)}, for the journey ${outbound ? "out" : "home"} (${routeTitle(trip!)}).`);
      break;
    }
    case "CDC_RECEIPT":
      record = { key: "cdcFormSubmittedOn", doneOn: v("submittedOn")! };
      applied.push(`CDC Dog Import Form submitted ${formatDate(record.doneOn)}, for ${routeTitle(trip!)}.`);
      break;
  }

  await db.$transaction(async (tx) => {
    for (const f of next) {
      await tx.documentField.upsert({
        where: { documentId_key: { documentId: id, key: f.key } },
        create: { documentId: id, key: f.key, value: f.value, confidence: f.confidence, origin: f.origin },
        update: { value: f.value, confidence: f.confidence, origin: f.origin },
      });
    }
    if (Object.keys(petUpdate).length) await tx.pet.update({ where: { id: pet.id }, data: petUpdate });
    if (record && trip) {
      await tx.taskRecord.upsert({
        where: { tripId_petId_key: { tripId: trip.id, petId: pet.id, key: record.key } },
        create: { tripId: trip.id, petId: pet.id, key: record.key, doneOn: record.doneOn, source: "DOCUMENT", documentId: id },
        update: { doneOn: record.doneOn, source: "DOCUMENT", documentId: id },
      });
    }
    await tx.document.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date(), tripId: trip?.id ?? null, applied: JSON.stringify(applied) },
    });
  });
  return { ok: true, applied };
}

/* ---------- Deleting ---------- */

/**
 * Removes the document, its file and any trip step it completed. Pet profile details it
 * filled in stay, because the owner may have them from elsewhere; the dialog says so.
 */
export async function deleteDocument(ownerId: string, id: string): Promise<DocResult> {
  const doc = await db.document.findFirst({ where: { id, ownerId }, select: { id: true, storedName: true } });
  if (!doc) return { ok: false, message: "We couldn't find that document." };
  await db.document.delete({ where: { id } });
  await removeUpload(doc.storedName);
  return { ok: true };
}

export { CONFIDENT };
