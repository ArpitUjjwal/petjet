import { expect, test } from "@playwright/test";
import { formatDate, todayISO } from "../../src/lib/rules/dates";
import { readiness } from "../../src/lib/trips/dashboard";
import { openWindow, windowLabel } from "../../src/lib/trips/format";
import { planTrip, type PetRecord, type TripRecord } from "../../src/lib/trips/plan";
import { day, expectNoHorizontalScroll, planTripAs, shot, signUpNewOwner, trackErrors, type NewPet } from "./helpers";

/* Module 5: dashboard, checklist, timeline and changing dates. */

const TODAY = todayISO();

/** The same pet as the questionnaire saves it, for checking pages against the rules engine. */
function petRecord(p: NewPet, id = "p1"): PetRecord {
  const vaccinated = p.vaccinatedDaysAgo !== undefined;
  return {
    id,
    name: p.name,
    species: p.species.toUpperCase(),
    breed: p.breed ?? null,
    birthYear: Number(p.year),
    birthMonth: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(p.month) + 1,
    birthDay: null,
    hasPedigree: null,
    microchipStatus: "YES",
    microchipDate: null,
    rabiesStatus: vaccinated ? "VACCINATED" : "NONE",
    rabiesLastDose: vaccinated ? day(-p.vaccinatedDaysAgo!) : null,
    rabiesDoseKind: vaccinated ? "PRIMARY" : null,
    rabiesValidUntil: null,
  };
}

const MILO: NewPet = { name: "Milo", species: "Cat", breed: "British Shorthair", month: "March", year: "2023", vaccinatedDaysAgo: 60 };
const BELLA: NewPet = { name: "Bella", species: "Dog", breed: "Cockapoo", month: "January", year: "2022" };

test.describe("Module 5: dashboard and checklist", () => {

  test("the dashboard and checklist match the rules engine's plan", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Dash Owner", `m5-dash-${info.project.name}`);
    const tripUrl = await planTripAs(page, { pet: MILO, to: "France", arrive: day(120), back: day(134), landing: "CDG" });

    const trip: TripRecord = {
      id: "t",
      origin: "GB",
      destination: "FR",
      arrivalDate: day(120),
      returnDate: day(134),
      accompaniment: "OWNER",
      arrivalAirport: "CDG",
    };
    const engine = planTrip(trip, [petRecord(MILO)], TODAY);
    const plan = engine.pets[0].plan;
    if (!plan.supported) throw new Error("expected a supported plan");
    const ready = readiness(engine.pets);

    await page.goto("/app");
    const dash = page.getByTestId("dashboard");
    await expect(dash.getByTestId("tile-hero")).toContainText("Great Britain to France");
    await expect(dash.getByTestId("countdown")).toContainText("120");
    await expect(dash.getByTestId("trip-status")).toContainText("In progress");
    await expect(dash.getByTestId("readiness-count")).toHaveText(`${ready.done} of ${ready.total} steps`);
    /* Home is the guided journey: one current step, and no problem panel when nothing blocks the plan */
    await expect(dash.getByTestId("journey-current")).toBeVisible();
    await expect(dash.getByTestId("tile-attention")).toHaveCount(0);
    await expect(dash.getByTestId("tile-hero")).toContainText("Milo");
    await expectNoHorizontalScroll(page);
    await shot(page, info.outputPath("dashboard.png"));

    // Every task in the checklist has the engine's status, with its official source one click away
    await page.goto(tripUrl);
    const checklist = page.getByTestId("plan-Milo");
    for (const task of plan.tasks) {
      await expect(checklist.getByTestId(`task-${task.id}`), task.id).toHaveAttribute("data-status", task.status);
    }
    await expect(checklist.locator("[data-testid^='task-']")).toHaveCount(plan.tasks.length);
    const ahc = plan.tasks.find((t) => t.id === "ahc")!;
    await expect(checklist.getByTestId("task-ahc")).toContainText(windowLabel(openWindow(ahc.window, TODAY))!);
    await checklist.getByTestId("task-ahc").getByText("Details", { exact: true }).click();
    await checklist.getByTestId("task-ahc").getByText("Why is this needed?").click();
    await expect(checklist.getByTestId("task-ahc").getByRole("link", { name: /GOV.UK/ }).first()).toHaveAttribute("href", /gov\.uk/);
    // Vet steps can't be ticked off by the owner
    await expect(checklist.getByTestId("task-ahc").getByRole("button", { name: /Mark as done/ })).toHaveCount(0);
    await shot(page, info.outputPath("checklist.png"));

    // Timeline view: dated steps and the flights, in order
    await page.getByRole("link", { name: "Timeline" }).click();
    await expect(page).toHaveURL(/view=timeline/);
    const timeline = page.getByTestId("trip-timeline");
    await expect(timeline).toContainText("Arrive in France");
    await expect(timeline).toContainText("Back in Great Britain");
    await expect(timeline).toContainText("Animal health certificate");
    await expect(timeline.locator('li[data-state="travel"]')).toHaveCount(2);
    const titles = await timeline.locator("li p.text-sm").allTextContents();
    expect(titles.indexOf("Animal health certificate")).toBeLessThan(titles.indexOf("Arrive in France"));
    await expectNoHorizontalScroll(page);
    await shot(page, info.outputPath("timeline.png"));
    expect(errors).toEqual([]);
  });

  test("a date conflict is flagged, and the suggested dates fix the plan", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Conflict Owner", `m5-conflict-${info.project.name}`);
    await planTripAs(page, { pet: BELLA, to: "Ireland", arrive: day(10), back: day(20), landing: "DUB" });

    await page.goto("/app");
    await expect(page.getByTestId("trip-status")).toContainText("Not ready for this date");
    const conflict = page.getByTestId("attention-conflict");
    await expect(conflict).toContainText("Your dates don't work yet");
    await expect(conflict).toContainText("21 full days");
    await shot(page, info.outputPath("conflict.png"));

    // The fix: the earliest arrival after the 21-day wait, keeping the 10-day trip
    await conflict.getByRole("button", { name: `Move to ${formatDate(day(22))}` }).click();
    const dialog = page.getByRole("dialog", { name: "Change your travel dates" });
    await expect(dialog.getByLabel("Date your pet arrives")).toHaveValue(day(22));
    await expect(dialog.getByLabel("Date you come home")).toHaveValue(day(32));
    await expect(dialog.getByTestId("preview-status")).toHaveAttribute("data-status", "IN_PROGRESS");
    await expect(dialog.getByTestId("preview-changes")).toContainText("Rabies vaccination");
    await expect(dialog.getByTestId("preview-changes").locator('[data-kind="unblocked"]')).toHaveCount(1);
    await shot(page, info.outputPath("preview.png"), false);
    await dialog.getByRole("button", { name: "Save new dates" }).click();

    await expect(page.getByText("Dates updated")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("attention-conflict")).toHaveCount(0);
    await expect(page.getByTestId("trip-status")).toContainText("In progress");
    await expect(page.getByTestId("countdown")).toContainText("22");
    await expect(page.getByTestId("journey")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("changing dates on the trip page previews and recalculates every deadline", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Dates Owner", `m5-dates-${info.project.name}`);
    const tripUrl = await planTripAs(page, { pet: MILO, to: "France", arrive: day(120), back: day(134), landing: "CDG" });
    await page.goto(tripUrl);

    const moved: TripRecord = {
      id: "t",
      origin: "GB",
      destination: "FR",
      arrivalDate: day(150),
      returnDate: day(164),
      accompaniment: "OWNER",
      arrivalAirport: "CDG",
    };
    const after = planTrip(moved, [petRecord(MILO)], TODAY).pets[0].plan;
    if (!after.supported) throw new Error("expected a supported plan");
    const newAhc = windowLabel(openWindow(after.tasks.find((t) => t.id === "ahc")!.window, TODAY))!;

    await page.getByRole("button", { name: "Edit dates" }).click();
    const dialog = page.getByRole("dialog", { name: "Change your travel dates" });
    await expect(dialog.getByTestId("dates-preview")).toContainText("These are your current dates.");
    await expect(dialog.getByRole("button", { name: "Save new dates" })).toBeDisabled();

    // A return before arrival is caught before saving
    await dialog.getByLabel("Date you come home").fill(day(100));
    await expect(dialog.getByText("The return date must be after the arrival date.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save new dates" })).toBeDisabled();

    await dialog.getByLabel("Date your pet arrives").fill(day(150));
    await dialog.getByLabel("Date you come home").fill(day(164));
    const ahcChange = dialog.getByTestId("preview-changes").locator("li", { hasText: /^Animal health certificate/ });
    await expect(ahcChange).toContainText(newAhc);
    await expect(dialog.getByTestId("preview-status")).toHaveAttribute("data-status", "IN_PROGRESS");
    await expectNoHorizontalScroll(page);
    await shot(page, info.outputPath("edit-dates.png"), false);
    await dialog.getByRole("button", { name: "Save new dates" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("trip-arrival")).toHaveText(`Arrives ${formatDate(day(150))}`);
    await expect(page.getByTestId("trip-return")).toHaveText(`Home ${formatDate(day(164))}`);
    await expect(page.getByTestId("plan-Milo").getByTestId("task-ahc")).toContainText(newAhc);
    await page.getByRole("link", { name: "Timeline" }).click();
    await expect(page.getByTestId("trip-timeline").locator('li[data-state="travel"]').first()).toContainText(
      formatDate(day(150)),
    );

    // Not knowing the return date drops the journey home from the plan
    await page.getByRole("button", { name: "Edit dates" }).click();
    await dialog.getByText("I don't know my return date yet").click();
    await expect(dialog.getByTestId("preview-changes").locator('[data-kind="removed"]').first()).toBeVisible();
    await dialog.getByRole("button", { name: "Save new dates" }).click();
    await expect(page.getByTestId("trip-return")).toHaveText("Return date not set");
    await expect(page.getByTestId("trip-timeline")).not.toContainText("Back in Great Britain");
    expect(errors).toEqual([]);
  });

  test("owners tick off their own steps, never a vet's", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Tick Owner", `m5-tick-${info.project.name}`);
    const rex: NewPet = { name: "Rex", species: "Dog", breed: "Labrador", month: "April", year: "2021", vaccinatedDaysAgo: 60 };
    const tripUrl = await planTripAs(page, { pet: rex, to: "United States", arrive: day(60), back: day(74), landing: "JFK" });

    await page.goto("/app");
    const before = await page.getByTestId("readiness-count").textContent();
    const doneBefore = Number(before!.split(" ")[0]);

    // From the checklist
    await page.goto(tripUrl);
    await page.getByTestId("plan-Rex").getByRole("button", { name: "Mark as done: CDC Dog Import Form for Rex" }).click();
    const dialog = page.getByRole("dialog", { name: "Have you submitted the CDC Dog Import Form?" });
    await expect(dialog.getByLabel("Date on the receipt")).toHaveValue(TODAY);
    await dialog.getByRole("button", { name: "Yes, it's done" }).click();
    await expect(page.getByText("Step done")).toBeVisible();
    await page.goto("/app");
    await expect(page.getByTestId("readiness-count")).toHaveText(new RegExp(`^${doneBefore + 1} of`));

    // The checklist shows who confirmed it, and it can be undone
    await page.goto(tripUrl);
    const cdc = page.getByTestId("plan-Rex").getByTestId("task-cdc-form");
    await expect(cdc).toHaveAttribute("data-status", "DONE");
    await expect(cdc).toContainText(`Submitted ${formatDate(TODAY)} · confirmed by you`);
    await expect(page.getByTestId("plan-Rex").getByTestId("task-microchip").getByRole("button", { name: /Mark as done/ })).toHaveCount(0);
    await expect(page.getByTestId("plan-Rex").getByTestId("task-rabies").getByRole("button", { name: /Mark as done/ })).toHaveCount(0);
    await shot(page, info.outputPath("ticked.png"));
    await cdc.getByRole("button", { name: "Undo: CDC Dog Import Form for Rex" }).click();
    await expect(cdc).toHaveAttribute("data-status", "TODO");

    // Booking the approved route home is the owner's job too
    const route = page.getByTestId("plan-Rex").getByTestId("task-return-approved-route");
    await route.getByRole("button", { name: /Mark as done/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, it's done" }).click();
    await expect(route).toHaveAttribute("data-status", "DONE");
    expect(errors).toEqual([]);
  });

  test("the trip switcher shows the next trip first and switches between trips", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Switch Owner", `m5-switch-${info.project.name}`);
    await planTripAs(page, { pet: MILO, to: "France", arrive: day(120), back: day(134), landing: "CDG" });
    await planTripAs(page, { pet: { existing: "Milo" }, to: "Ireland", arrive: day(40), back: day(50), landing: "DUB" });

    await page.goto("/app");
    await expect(page.getByTestId("tile-hero")).toContainText("Great Britain to Ireland");
    const switcher = page.getByRole("button", { name: /Switch trip/ });
    await switcher.click();
    const menu = page.getByRole("list", { name: "Your trips" });
    await expect(menu.getByRole("link")).toHaveCount(2);
    await expect(menu.getByRole("link", { name: /Great Britain to Ireland/ })).toHaveAttribute("aria-current", "true");
    await expectNoHorizontalScroll(page);
    await shot(page, info.outputPath("switcher.png"), false);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await switcher.click();
    await menu.getByRole("link", { name: /Great Britain to France/ }).click();
    await expect(page).toHaveURL(/\/app\?trip=/);
    await expect(page.getByTestId("tile-hero")).toContainText("Great Britain to France");
    await expect(page.getByTestId("countdown")).toContainText("120");
    expect(errors).toEqual([]);
  });
});
