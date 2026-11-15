// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { isNotificationKind } from "@/lib/notifications/core";
import { deadlineReminders } from "@/lib/notifications/deadlines";
import { listNotifications, markAllRead, notify, unreadCount } from "@/lib/notifications/repository";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { getTrip } from "@/lib/trips/repository";

const TODAY = "2026-11-16";

let a: string;
let b: string;

beforeAll(async () => {
  const stamp = Date.now();
  a = (await db.user.create({ data: { email: `nt-a-${stamp}@t.test`, name: "A", passwordHash: "x" } })).id;
  b = (await db.user.create({ data: { email: `nt-b-${stamp}@t.test`, name: "B", passwordHash: "x" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("stored notifications", () => {
  it("only accepts known kinds", async () => {
    expect(isNotificationKind("LAB_RESULT")).toBe(true);
    expect(isNotificationKind("SPAM")).toBe(false);
    await notify(db, { userId: a, kind: "SPAM" as never, title: "x", body: "x" });
    expect(await unreadCount(a)).toBe(0);
  });

  it("counts unread per user, newest first, and mark-all-read only touches that user", async () => {
    await notify(db, { userId: a, kind: "FLIGHT_BOOKED", title: "First", body: "1" });
    await notify(db, { userId: a, kind: "LAB_RESULT", title: "Second", body: "2", href: "/app/vets" });
    await notify(db, { userId: b, kind: "LAB_RESULT", title: "B's", body: "3" });
    expect(await unreadCount(a)).toBe(2);
    expect(await unreadCount(b)).toBe(1);
    expect((await listNotifications(a)).map((n) => n.title)).toEqual(["Second", "First"]);

    expect(await markAllRead(a)).toBe(2);
    expect(await unreadCount(a)).toBe(0);
    expect(await unreadCount(b)).toBe(1);
    expect(await markAllRead(a)).toBe(0);
    expect((await listNotifications(a)).every((n) => n.readAt)).toBe(true);
  });
});

describe("deadline reminders", () => {
  async function tripFor(arrivalDate: string, vaccinated: boolean) {
    const pet = await db.pet.create({
      data: {
        ownerId: a,
        name: vaccinated ? "Bella" : "Rex",
        species: "DOG",
        birthYear: 2021,
        birthMonth: 1,
        microchipStatus: "YES",
        microchipNumber: "956000012345678",
        microchipDate: "2021-04-01",
        rabiesStatus: vaccinated ? "VACCINATED" : "NONE",
        ...(vaccinated ? { rabiesLastDose: "2026-01-10", rabiesDoseKind: "BOOSTER", rabiesValidUntil: "2029-01-09" } : {}),
      },
    });
    const trip = await db.trip.create({
      data: { ownerId: a, origin: "GB", destination: "FR", arrivalDate, pets: { create: [{ petId: pet.id }] } },
    });
    return { petId: pet.id, tripId: trip.id };
  }

  async function remindersFor(tripIds: string[], within?: number) {
    const trips = await Promise.all(tripIds.map((id) => getTrip(a, id)));
    return deadlineReminders(
      trips.map((t) => ({ id: t!.id, title: routeTitle(t!), plans: planStoredTrip(t!, TODAY).pets })),
      TODAY,
      within,
    );
  }

  it("includes steps due within 7 days, not 8", async () => {
    const in7 = await tripFor("2026-11-23", true);
    const in8 = await tripFor("2026-11-24", true);
    const r = await remindersFor([in7.tripId, in8.tripId]);
    expect(r.map((x) => [x.tripId, x.title, x.daysLeft])).toEqual([[in7.tripId, "Animal health certificate", 7]]);
    expect(r[0]).toMatchObject({ overdue: false, body: "Due in 7 days, by 23 Nov 2026.", href: `/app/trips/${in7.tripId}#task-${in7.petId}-ahc` });
    expect((await remindersFor([in8.tripId], 8)).map((x) => x.daysLeft)).toEqual([8]);
  });

  it("flags overdue steps and leaves out done ones", async () => {
    /* The certificate had to be issued by the arrival date, two days ago */
    const late = await tripFor("2026-11-14", true);
    expect(await remindersFor([late.tripId])).toContainEqual(
      expect.objectContaining({ title: "Animal health certificate is overdue", body: "It was due by 14 Nov 2026.", overdue: true, daysLeft: -2 }),
    );

    const done = await tripFor("2026-11-22", true);
    expect((await remindersFor([done.tripId])).map((x) => x.title)).toContain("Animal health certificate");
    await db.taskRecord.create({ data: { tripId: done.tripId, petId: done.petId, key: "ahcIssuedOn", doneOn: TODAY, source: "VET" } });
    expect((await remindersFor([done.tripId])).map((x) => x.title)).not.toContain("Animal health certificate");
  });
});
