// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  changeDocumentType,
  confirmDocument,
  deleteDocument,
  getDocument,
  issuesFor,
  uploadDocument,
} from "@/lib/documents/repository";
import {
  animalHealthCertificate,
  microchipCertificate,
  rabiesCertificate,
  scannedRecord,
  type SamplePet,
} from "@/lib/documents/sample-pdf";
import { uploadDir } from "@/lib/documents/storage";
import { planStoredTrip } from "@/lib/trips/plan";
import { getTrip } from "@/lib/trips/repository";

/* Module 6: the document vault, against prisma/unit.db and storage/unit-uploads */

const TODAY = "2026-11-15";
const MILO: SamplePet = { name: "Milo", species: "Cat", breed: "British Shorthair", microchip: "956000012345678", dob: "2023-03-04" };
let owner: string;
let other: string;
let petId: string;
let tripId: string;

const pdf = (bytes: Buffer, name = "record.pdf") => ({ name, bytes: new Uint8Array(bytes) });

beforeAll(async () => {
  const stamp = Date.now();
  owner = (await db.user.create({ data: { email: `m6a-${stamp}@t.test`, name: "A", passwordHash: "x" } })).id;
  other = (await db.user.create({ data: { email: `m6b-${stamp}@t.test`, name: "B", passwordHash: "x" } })).id;
  const pet = await db.pet.create({
    data: {
      ownerId: owner,
      name: "Milo",
      species: "CAT",
      birthYear: 2023,
      birthMonth: 3,
      birthDay: 4,
      microchipStatus: "YES",
      microchipNumber: "956000012345678",
      microchipDate: "2023-06-01",
      rabiesStatus: "UNKNOWN",
    },
  });
  petId = pet.id;
  tripId = (
    await db.trip.create({
      data: { ownerId: owner, origin: "GB", destination: "FR", arrivalDate: "2026-11-18", returnDate: "2026-11-30", pets: { create: [{ petId }] } },
    })
  ).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("uploading", () => {
  it("reads a clean rabies record and waits for the owner to confirm", async () => {
    const res = await uploadDocument(owner, { petId, file: pdf(rabiesCertificate(MILO, { vaccinatedOn: "2026-09-12", validUntil: "2029-09-11" }), "Milo rabies.pdf") }, TODAY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const doc = (await getDocument(owner, res.documentId))!;
    expect(doc).toMatchObject({ type: "RABIES", detectedType: "RABIES", readMode: "TEXT", status: "READY", fileName: "Milo rabies.pdf", mimeType: "application/pdf" });
    expect(doc.fields.find((f) => f.key === "vaccinationDate")).toMatchObject({ value: "2026-09-12", evidence: "Date of vaccination: 12/09/2026" });
    expect(existsSync(path.join(uploadDir(), doc.storedName))).toBe(true);
    // Nothing changes until it's confirmed
    expect((await db.pet.findUnique({ where: { id: petId } }))!.rabiesStatus).toBe("UNKNOWN");
  });

  it("rejects files that aren't PDFs or photos, damaged PDFs, empty and oversized files", async () => {
    const text = new TextEncoder().encode("hello, not a pdf");
    expect(await uploadDocument(owner, { petId, file: { name: "x.pdf", bytes: text } }, TODAY)).toEqual({
      ok: false,
      errors: { file: "Upload a PDF, JPG or PNG file." },
    });
    const broken = new TextEncoder().encode("%PDF-1.4\nthis is not really a pdf");
    expect(await uploadDocument(owner, { petId, file: { name: "broken.pdf", bytes: broken } }, TODAY)).toMatchObject({
      ok: false,
      errors: { file: expect.stringContaining("couldn't open this PDF") },
    });
    expect(await uploadDocument(owner, { petId, file: { name: "e.pdf", bytes: new Uint8Array() } }, TODAY)).toMatchObject({ errors: { file: "Choose a file to upload." } });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(await uploadDocument(owner, { petId, file: { name: "big.pdf", bytes: big } }, TODAY)).toMatchObject({ errors: { file: "Files can be up to 10 MB." } });
  });

  it("only accepts the owner's own pets", async () => {
    const res = await uploadDocument(other, { petId, file: pdf(scannedRecord()) }, TODAY);
    expect(res).toMatchObject({ ok: false, errors: { petId: expect.any(String) } });
  });

  it("stores a photo, and a scan without text, for the owner to type in", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const photo = await uploadDocument(owner, { petId, file: { name: "photo.png", bytes: png } }, TODAY);
    if (!photo.ok) throw new Error("upload failed");
    expect(await getDocument(owner, photo.documentId)).toMatchObject({ readMode: "IMAGE", type: "OTHER", status: "NEEDS_REVIEW", mimeType: "image/png" });

    const scan = await uploadDocument(owner, { petId, file: pdf(scannedRecord(), "scan.pdf") }, TODAY);
    if (!scan.ok) throw new Error("upload failed");
    expect(await getDocument(owner, scan.documentId)).toMatchObject({ readMode: "NO_TEXT", type: "OTHER", status: "NEEDS_REVIEW" });
  });
});

describe("confirming", () => {
  it("a confirmed rabies record updates the pet, and the plan follows", async () => {
    const up = await uploadDocument(owner, { petId, file: pdf(rabiesCertificate(MILO, { vaccinatedOn: "2026-09-12", validUntil: "2029-09-11" })) }, TODAY);
    if (!up.ok) throw new Error("upload failed");
    const res = await confirmDocument(owner, up.documentId, { fields: {} }, TODAY);
    expect(res).toEqual({ ok: true, applied: ["Milo's rabies vaccination: 12 Sept 2026, valid until 11 Sept 2029."] });
    const pet = (await db.pet.findUnique({ where: { id: petId } }))!;
    expect(pet).toMatchObject({ rabiesStatus: "VACCINATED", rabiesLastDose: "2026-09-12", rabiesValidUntil: "2029-09-11", rabiesDoseKind: "PRIMARY" });
    const plan = planStoredTrip((await getTrip(owner, tripId))!, TODAY).pets[0].plan;
    expect(plan.supported && plan.tasks.find((t) => t.id === "rabies")?.status).toBe("DONE");
    expect(await confirmDocument(owner, up.documentId, { fields: {} }, TODAY)).toMatchObject({ ok: false, message: "This document is already confirmed." });
  });

  it("an older record never replaces a more recent dose", async () => {
    const up = await uploadDocument(owner, { petId, file: pdf(rabiesCertificate(MILO, { vaccinatedOn: "2025-09-01", validUntil: "2026-12-01" })) }, TODAY);
    if (!up.ok) throw new Error("upload failed");
    const res = await confirmDocument(owner, up.documentId, { fields: {} }, TODAY);
    expect(res.ok && res.applied[0]).toMatch(/Kept Milo's more recent vaccination on file/);
    expect((await db.pet.findUnique({ where: { id: petId } }))!.rabiesLastDose).toBe("2026-09-12");
  });

  it("flagged details need the owner's tick, and impossible ones must be fixed", async () => {
    const max = { ...MILO, name: "Max", microchip: "985112003456789" };
    const up = await uploadDocument(owner, { petId, file: pdf(microchipCertificate(max, { implantedOn: "2023-06-01" })) }, TODAY);
    if (!up.ok) throw new Error("upload failed");
    const doc = (await getDocument(owner, up.documentId))!;
    expect(doc.status).toBe("NEEDS_REVIEW");
    expect(issuesFor(doc, doc.pet, TODAY).map((i) => i.key)).toEqual(expect.arrayContaining(["microchipNumber", "petName"]));

    expect(await confirmDocument(owner, up.documentId, { fields: {} }, TODAY)).toMatchObject({
      ok: false,
      errors: { acknowledged: expect.any(String) },
    });
    expect(await confirmDocument(owner, up.documentId, { fields: { implantDate: "2027-01-01" }, acknowledged: true }, TODAY)).toMatchObject({
      ok: false,
      errors: { implantDate: expect.stringMatching(/future/) },
    });
    // The owner corrects the number to the one on Milo's collar tag and confirms
    const ok = await confirmDocument(owner, up.documentId, { fields: { microchipNumber: "956 000 012 345 678" }, acknowledged: true }, TODAY);
    expect(ok.ok).toBe(true);
    const saved = (await getDocument(owner, up.documentId))!;
    expect(saved.fields.find((f) => f.key === "microchipNumber")).toMatchObject({ value: "956000012345678", origin: "EDITED", confidence: 1 });
  });

  it("an animal health certificate completes that step on the trip; deleting it undoes that", async () => {
    const up = await uploadDocument(owner, { petId, file: pdf(animalHealthCertificate(MILO, { issuedOn: "2026-11-12", destination: "France" })) }, TODAY);
    if (!up.ok) throw new Error("upload failed");
    const doc = (await getDocument(owner, up.documentId))!;
    expect(doc.tripId).toBe(tripId);
    const res = await confirmDocument(owner, up.documentId, { fields: {} }, TODAY);
    expect(res.ok && res.applied[0]).toBe("Animal health certificate issued 12 Nov 2026, for Great Britain to France.");
    const record = await db.taskRecord.findFirst({ where: { tripId, petId, key: "ahcIssuedOn" } });
    expect(record).toMatchObject({ doneOn: "2026-11-12", source: "DOCUMENT", documentId: up.documentId });
    const plan = planStoredTrip((await getTrip(owner, tripId))!, TODAY).pets[0].plan;
    expect(plan.supported && plan.tasks.find((t) => t.id === "ahc")?.status).toBe("DONE");

    expect(await deleteDocument(other, up.documentId)).toMatchObject({ ok: false });
    expect(await deleteDocument(owner, up.documentId)).toEqual({ ok: true });
    expect(await db.taskRecord.count({ where: { tripId, key: "ahcIssuedOn" } })).toBe(0);
    expect(existsSync(path.join(uploadDir(), doc.storedName))).toBe(false);
  });

  it("a scan becomes useful once the owner picks its type and types the details", async () => {
    const up = await uploadDocument(owner, { petId, file: pdf(scannedRecord(), "scan.pdf") }, TODAY);
    if (!up.ok) throw new Error("upload failed");
    expect(await confirmDocument(owner, up.documentId, { fields: {} }, TODAY)).toMatchObject({ ok: false, message: expect.stringMatching(/kind of document/) });
    expect(await changeDocumentType(owner, up.documentId, "AHC", TODAY)).toEqual({ ok: true });
    const doc = (await getDocument(owner, up.documentId))!;
    expect(doc).toMatchObject({ type: "AHC", tripId, status: "NEEDS_REVIEW" });
    expect(doc.fields.every((f) => f.value === null)).toBe(true);
    const res = await confirmDocument(owner, up.documentId, { fields: { issuedOn: "2026-11-13" }, acknowledged: true }, TODAY);
    expect(res.ok).toBe(true);
    expect((await getDocument(owner, up.documentId))!.fields.find((f) => f.key === "issuedOn")?.origin).toBe("MANUAL");
  });

  it("other owners can't read, retype or confirm a document", async () => {
    const up = await uploadDocument(owner, { petId, file: pdf(scannedRecord()) }, TODAY);
    if (!up.ok) throw new Error("upload failed");
    expect(await getDocument(other, up.documentId)).toBeNull();
    expect(await changeDocumentType(other, up.documentId, "RABIES", TODAY)).toMatchObject({ ok: false });
    expect(await confirmDocument(other, up.documentId, { fields: {} }, TODAY)).toMatchObject({ ok: false });
  });
});
