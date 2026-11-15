/*
 * The mid-journey demo for the presentation (`npm run db:demo`). It resets the demo owner and
 * sets them up a week before a trip, with dates relative to today:
 *
 *   - Bella, a Cockapoo of about 9 kg (too heavy for the cabin, so the hold story shows)
 *   - Great Britain to France in 8 days, home a week later
 *   - a rabies certificate uploaded and confirmed; a microchip certificate waiting for review
 *   - the Travel Plan, so the upgrade to Complete (and flight booking) can be shown
 *   - no appointments, lab orders, bookings or notifications
 *
 * Only the demo owner's data, and the demo vet's and lab's notifications, are touched.
 * The pet and documents go through the same repositories as the app, so the extraction is real.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { confirmDocument, uploadDocument } from "@/lib/documents/repository";
import { rabiesCertificate } from "@/lib/documents/sample-pdf";
import { removeUpload } from "@/lib/documents/storage";
import { addDays, addMonths, type ISODate } from "@/lib/rules/dates";
import { savePet } from "@/lib/trips/repository";
import { DEMO_ACCOUNTS, DEMO_PET } from "./demo-accounts";

export const DEMO_TRIP_DAYS = { out: 8, back: 15 } as const;

export type DemoJourney = { ownerId: string; petId: string; tripId: string; reviewDocumentId: string };

function fail(step: string, r: { ok: false; message?: string; errors?: Record<string, string> }): never {
  throw new Error(`Demo seed: ${step} failed. ${r.message ?? JSON.stringify(r.errors ?? {})}`);
}

export async function resetDemoOwner() {
  const owner = await db.user.findUnique({ where: { email: DEMO_ACCOUNTS.owner.email }, select: { id: true } });
  if (!owner) throw new Error("The demo accounts aren't set up. Run `npm run db:seed` first.");
  const docs = await db.document.findMany({ where: { ownerId: owner.id }, select: { storedName: true } });
  const providers = await db.user.findMany({
    where: { email: { in: [DEMO_ACCOUNTS.vet.email, DEMO_ACCOUNTS.lab.email] } },
    select: { id: true },
  });
  await db.$transaction([
    /* Appointments and lab orders go with the pets; bookings and records with the trips */
    db.trip.deleteMany({ where: { ownerId: owner.id } }),
    db.pet.deleteMany({ where: { ownerId: owner.id } }),
    db.document.deleteMany({ where: { ownerId: owner.id } }),
    db.notification.deleteMany({ where: { userId: { in: [owner.id, ...providers.map((p) => p.id)] } } }),
    db.user.update({ where: { id: owner.id }, data: { plan: "PLAN", planPaidAt: new Date() } }),
  ]);
  for (const d of docs) await removeUpload(d.storedName);
  return owner.id;
}

export async function seedDemoJourney(today: ISODate): Promise<DemoJourney> {
  const ownerId = await resetDemoOwner();
  const [year, month, day] = DEMO_PET.dob.split("-").map(Number);
  const rabiesOn = addMonths(today, -11);
  const rabiesUntil = addDays(addMonths(rabiesOn, 36), -1);

  const pet = await savePet(
    ownerId,
    {
      profile: {
        name: DEMO_PET.name,
        species: DEMO_PET.species,
        breed: DEMO_PET.breed,
        birthYear: year,
        birthMonth: month,
        birthDay: day,
        weightKg: DEMO_PET.weightKg,
        hasPedigree: null,
      },
      health: {
        microchip: { status: "YES", number: DEMO_PET.microchip, implantedOn: DEMO_PET.microchipImplantedOn },
        rabies: { status: "VACCINATED", lastDoseOn: rabiesOn, lastDoseKind: "BOOSTER", validUntil: rabiesUntil },
      },
    },
    today,
  );
  if (!pet.ok) fail("creating Bella", pet);

  /* The questionnaire's own checks have nothing to add for a single supported pet, so the trip is written directly */
  const trip = await db.trip.create({
    data: {
      ownerId,
      origin: "GB",
      destination: "FR",
      arrivalDate: addDays(today, DEMO_TRIP_DAYS.out),
      returnDate: addDays(today, DEMO_TRIP_DAYS.back),
      transit: "NONE",
      accompaniment: "OWNER",
      petPlacement: "NO_PREFERENCE",
      recordsAvailable: "YES",
      pets: { create: [{ petId: pet.petId }] },
    },
    select: { id: true },
  });

  const samplePet = { name: DEMO_PET.name, species: "Dog" as const, breed: DEMO_PET.breed, microchip: DEMO_PET.microchip, dob: DEMO_PET.dob };
  const rabies = await uploadDocument(
    ownerId,
    {
      petId: pet.petId,
      type: "RABIES",
      file: { name: "rabies-vaccination-bella.pdf", bytes: rabiesCertificate(samplePet, { vaccinatedOn: rabiesOn, validUntil: rabiesUntil, booster: true }) },
    },
    today,
  );
  if (!rabies.ok) fail("uploading the rabies certificate", rabies);
  const confirmed = await confirmDocument(ownerId, rabies.documentId, { fields: {}, acknowledged: true }, today);
  if (!confirmed.ok) fail("confirming the rabies certificate", confirmed);

  const chipBytes = await readFile(path.join(process.cwd(), "public", "samples", "microchip-certificate-bella.pdf"));
  const chip = await uploadDocument(
    ownerId,
    { petId: pet.petId, file: { name: "microchip-certificate-bella.pdf", bytes: new Uint8Array(chipBytes) } },
    today,
  );
  if (!chip.ok) fail("uploading the microchip certificate", chip);

  return { ownerId, petId: pet.petId, tripId: trip.id, reviewDocumentId: chip.documentId };
}
