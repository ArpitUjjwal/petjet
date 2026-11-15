// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { matchProviders, proposeSlots, slotLabel, titreOutcome } from "@/lib/vets/core";
import {
  canProviderOpenDocument,
  findTask,
  getProviderAppointment,
  labOrdersForOwner,
  orderLabTest,
  postLabResult,
  recordVetService,
  requestAppointment,
  respondToAppointment,
} from "@/lib/vets/repository";
import { getTrip } from "@/lib/trips/repository";

const TODAY = "2026-11-16"; // a Monday

describe("simulated slots", () => {
  it("offers three working-day slots inside the window, from tomorrow", () => {
    const slots = proposeSlots("vet-1", { from: "2026-11-10", to: "2026-11-27" }, TODAY);
    expect(slots).toHaveLength(3);
    for (const s of slots) {
      const d = s.slice(0, 10);
      expect(d > TODAY && d <= "2026-11-27").toBe(true);
      expect([0, 6]).not.toContain(new Date(`${d}T00:00:00Z`).getUTCDay());
    }
    expect(slots[0].slice(0, 10)).toBe("2026-11-17");
    expect(slots[2].slice(0, 10)).toBe("2026-11-27");
  });

  it("starts when a future window opens, and is the same every time", () => {
    const a = proposeSlots("vet-1", { from: "2026-12-01", to: "2026-12-10" }, TODAY);
    expect(a[0] >= "2026-12-01").toBe(true);
    expect(proposeSlots("vet-1", { from: "2026-12-01", to: "2026-12-10" }, TODAY)).toEqual(a);
    expect(proposeSlots("vet-2", { from: "2026-12-01", to: "2026-12-10" }, TODAY)).not.toEqual(a);
  });

  it("offers nothing once the window has closed", () => {
    expect(proposeSlots("vet-1", { to: "2026-11-16" }, TODAY)).toEqual([]);
  });

  it("labels slots readably", () => {
    expect(slotLabel("2026-11-18T10:15")).toBe("Wed 18 Nov, 10:15");
  });
});

describe("matching practices to a step", () => {
  const p = (name: string, official: boolean, services: string[], type = "VET") => ({
    id: name,
    name,
    type,
    officialVet: official,
    services: JSON.stringify(services),
  });
  const all = [
    p("Camden", false, ["MICROCHIP", "RABIES_VACCINATION"]),
    p("Riverside", true, ["ANIMAL_HEALTH_CERTIFICATE", "MICROCHIP"]),
    p("Abbey", true, ["ANIMAL_HEALTH_CERTIFICATE"]),
    p("Northgate Lab", false, ["RABIES_TITRE"], "LAB"),
  ];
  it("lists practices offering the service, official vets first", () => {
    expect(matchProviders(all, "MICROCHIP").map((x) => x.name)).toEqual(["Riverside", "Camden"]);
    expect(matchProviders(all, "ANIMAL_HEALTH_CERTIFICATE", true).map((x) => x.name)).toEqual(["Abbey", "Riverside"]);
    expect(matchProviders(all, null).map((x) => x.name)).toEqual(["Abbey", "Riverside", "Camden"]);
  });
});

it("a titre of 0.5 IU/mL or more passes", () => {
  expect(titreOutcome(0.5)).toBe("PASS");
  expect(titreOutcome(0.49)).toBe("FAIL");
});

/* ---------- Against prisma/unit.db ---------- */

let owner: string;
let other: string;
let petId: string;
let tripId: string;
let vet: string;
let otherVet: string;
let lab: string;
let sharedDoc: string;
let privateDoc: string;

async function provider(type: "VET" | "LAB", name: string, services: string[], officialVet = true) {
  const user = await db.user.create({ data: { email: `${name}-${Date.now()}@t.test`, name, passwordHash: "!", role: type } });
  return (
    await db.provider.create({
      data: { userId: user.id, type, name, registrationNumber: "X", city: "London", postcode: "SE1", verified: true, officialVet, services: JSON.stringify(services) },
    })
  ).id;
}

beforeAll(async () => {
  const stamp = Date.now();
  owner = (await db.user.create({ data: { email: `m7a-${stamp}@t.test`, name: "A", passwordHash: "x" } })).id;
  other = (await db.user.create({ data: { email: `m7b-${stamp}@t.test`, name: "B", passwordHash: "x" } })).id;
  petId = (
    await db.pet.create({
      data: {
        ownerId: owner,
        name: "Bella",
        species: "DOG",
        birthYear: 2021,
        birthMonth: 1,
        microchipStatus: "YES",
        microchipNumber: "956000012345678",
        microchipDate: "2021-04-01",
        rabiesStatus: "VACCINATED",
        rabiesLastDose: "2026-09-01",
        rabiesDoseKind: "PRIMARY",
        rabiesValidUntil: "2027-08-31",
      },
    })
  ).id;
  tripId = (
    await db.trip.create({
      data: { ownerId: owner, origin: "GB", destination: "FR", arrivalDate: "2026-11-24", returnDate: "2026-12-08", pets: { create: [{ petId }] } },
    })
  ).id;
  vet = await provider("VET", "Riverside", ["ANIMAL_HEALTH_CERTIFICATE", "RABIES_BOOSTER"]);
  otherVet = await provider("VET", "Camden", ["MICROCHIP", "ANIMAL_HEALTH_CERTIFICATE"], false);
  lab = await provider("LAB", "Northgate", ["RABIES_TITRE", "HEALTH_SCREEN"]);
  const doc = (name: string) =>
    db.document.create({
      data: { ownerId: owner, petId, type: "RABIES", detectedType: "RABIES", fileName: name, storedName: `${owner}/${name}-${Math.random()}`, mimeType: "application/pdf", size: 1, sha256: "x", readMode: "TEXT", status: "CONFIRMED" },
    });
  sharedDoc = (await doc("shared.pdf")).id;
  privateDoc = (await doc("private.pdf")).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("owner → vet → lab", () => {
  let apptId: string;
  let slot: string;

  it("an owner requests a vet for the health certificate, sharing one document", async () => {
    const trip = (await getTrip(owner, tripId))!;
    const task = findTask(trip, petId, "ahc", TODAY)!;
    slot = proposeSlots(vet, task.window, TODAY)[0];
    const base = { providerId: vet, petId, tripId, taskId: "ahc", service: "ANIMAL_HEALTH_CERTIFICATE", slot, documentIds: [sharedDoc], consent: true };

    expect(await requestAppointment(owner, { ...base, consent: false }, TODAY)).toMatchObject({ ok: false, errors: { consent: expect.any(String) } });
    expect(await requestAppointment(owner, { ...base, providerId: otherVet, slot: proposeSlots(otherVet, task.window, TODAY)[0] }, TODAY)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/official vet/),
    });
    expect(await requestAppointment(owner, { ...base, slot: "2026-11-17T03:00" }, TODAY)).toMatchObject({ errors: { slot: expect.any(String) } });
    expect(await requestAppointment(other, base, TODAY)).toMatchObject({ ok: false });
    expect(await requestAppointment(owner, { ...base, documentIds: [sharedDoc, "someone-elses"] }, TODAY)).toMatchObject({ ok: false });

    const res = await requestAppointment(owner, base, TODAY);
    expect(res.ok).toBe(true);
    if (res.ok) apptId = res.appointmentId;
    expect(await requestAppointment(owner, base, TODAY)).toMatchObject({ ok: false, message: expect.stringMatching(/already have/) });
  });

  it("the vet sees only what was shared, and only for their own appointments", async () => {
    expect(await canProviderOpenDocument(vet, sharedDoc)).toBe(true);
    expect(await canProviderOpenDocument(vet, privateDoc)).toBe(false);
    expect(await canProviderOpenDocument(otherVet, sharedDoc)).toBe(false);
    expect(await getProviderAppointment(otherVet, apptId)).toBeNull();
    const appt = (await getProviderAppointment(vet, apptId))!;
    expect(appt.documents.map((d) => d.document.fileName)).toEqual(["shared.pdf"]);
    expect(appt.trip?.pets.map((p) => p.pet.name)).toEqual(["Bella"]);
  });

  it("the vet accepts, then issues the certificate, which completes the owner's step", async () => {
    expect(await recordVetService(vet, apptId, { date: TODAY }, TODAY)).toMatchObject({ ok: false, message: "Accept the appointment first." });
    expect(await respondToAppointment(otherVet, apptId, "ACCEPTED")).toMatchObject({ ok: false });
    expect(await respondToAppointment(vet, apptId, "ACCEPTED")).toEqual({ ok: true });
    expect(await respondToAppointment(vet, apptId, "DECLINED")).toMatchObject({ ok: false });

    // Too early: the certificate window opens 10 days before arrival on 24 Nov
    expect(await recordVetService(vet, apptId, { date: "2026-11-10" }, TODAY)).toMatchObject({
      ok: false,
      errors: { date: expect.stringMatching(/doesn't count/) },
    });
    const res = await recordVetService(vet, apptId, { date: TODAY }, TODAY);
    expect(res).toEqual({ ok: true, summary: "Animal health certificate issued 16 Nov 2026 by Riverside, for Great Britain to France." });
    const trip = (await getTrip(owner, tripId))!;
    expect(findTask(trip, petId, "ahc", TODAY)?.status).toBe("DONE");
    expect(await db.taskRecord.findFirst({ where: { tripId, key: "ahcIssuedOn" } })).toMatchObject({ source: "VET", issuedBy: "Riverside" });
    expect((await db.appointment.findUnique({ where: { id: apptId } }))!.status).toBe("COMPLETED");
  });

  it("the vet orders a titre test; the lab posts a result the owner can see", async () => {
    expect(await orderLabTest(otherVet, apptId, "RABIES_TITRE")).toMatchObject({ ok: false });
    const order = await orderLabTest(vet, apptId, "RABIES_TITRE");
    expect(order.ok).toBe(true);
    if (!order.ok) return;
    expect(order).toMatchObject({ ok: true });
    expect(await orderLabTest(vet, apptId, "RABIES_TITRE")).toMatchObject({ ok: false, message: "This test is already ordered." });
    expect((await db.labOrder.findUnique({ where: { id: order.orderId } }))!.labId).toBe(lab);

    expect(await postLabResult(lab, order.orderId, { value: "abc" }, TODAY)).toMatchObject({ errors: { value: expect.any(String) } });
    expect(await postLabResult(vet, order.orderId, { value: "2.4" }, TODAY)).toMatchObject({ ok: false });
    expect(await postLabResult(lab, order.orderId, { value: "2.4", note: "Sample result" }, TODAY)).toEqual({
      ok: true,
      summary: "Rabies antibody titre test for Bella: 2.4 IU/mL, pass.",
    });
    expect(await postLabResult(lab, order.orderId, { value: "3" }, TODAY)).toMatchObject({ ok: false });
    const results = await labOrdersForOwner(owner, [petId]);
    expect(results[0]).toMatchObject({ status: "RESULTED", resultValue: 2.4, outcome: "PASS" });
    expect(await labOrdersForOwner(other)).toEqual([]);
  });

  it("a declined appointment stops sharing", async () => {
    const trip = (await getTrip(owner, tripId))!;
    const task = findTask(trip, petId, "rabies", TODAY);
    expect(task?.status).toBe("DONE");
    const res = await requestAppointment(
      owner,
      { providerId: vet, petId, tripId, service: "RABIES_BOOSTER", slot: "2026-11-20T10:00", documentIds: [privateDoc], consent: true },
      TODAY,
    );
    if (!res.ok) throw new Error(JSON.stringify(res));
    expect(await canProviderOpenDocument(vet, privateDoc)).toBe(true);
    await respondToAppointment(vet, res.appointmentId, "DECLINED");
    expect(await canProviderOpenDocument(vet, privateDoc)).toBe(false);
  });
});

describe("notifications from the owner → vet → lab flow", () => {
  const userOf = async (providerId: string) => (await db.provider.findUniqueOrThrow({ where: { id: providerId } })).userId;
  const kinds = async (userId: string) =>
    (await db.notification.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })).map((n) => n.kind);

  it("tells each side what happened, and nobody else", async () => {
    expect(await kinds(await userOf(vet))).toEqual(["APPOINTMENT_REQUESTED", "LAB_RESULT", "APPOINTMENT_REQUESTED"]);
    expect(await kinds(await userOf(lab))).toEqual(["LAB_ORDERED"]);
    expect(await kinds(owner)).toEqual(["APPOINTMENT_ACCEPTED", "VET_RECORDED", "LAB_ORDERED", "LAB_RESULT", "APPOINTMENT_DECLINED"]);
    expect(await kinds(other)).toEqual([]);
    expect(await kinds(await userOf(otherVet))).toEqual([]);
  });

  it("links each one to the page that shows it", async () => {
    const vetUser = await userOf(vet);
    const request = await db.notification.findFirstOrThrow({ where: { userId: vetUser, kind: "APPOINTMENT_REQUESTED" } });
    expect(request).toMatchObject({ title: "New request: Animal health certificate for Bella", href: expect.stringMatching(/^\/provider\/appointments\//) });
    expect(request.body).toMatch(/shared 1 document\./);
    const result = await db.notification.findFirstOrThrow({ where: { userId: owner, kind: "LAB_RESULT" } });
    expect(result).toMatchObject({ href: `/app/trips/${tripId}` });
    expect(result.body).toMatch(/2\.4 IU\/mL, pass\. Sample result/);
    const cert = await db.notification.findFirstOrThrow({ where: { userId: owner, kind: "VET_RECORDED" } });
    expect(cert).toMatchObject({ href: `/app/trips/${tripId}`, body: expect.stringMatching(/^Animal health certificate issued/) });
  });
});
