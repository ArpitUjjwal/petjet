import { expect, test } from "@playwright/test";
import { day, planTripAs, shot, signUpNewOwner, trackErrors, type NewPet } from "./helpers";

/* Batch B: flight search with pet eligibility, simulated upgrade, booking, e-ticket, insurance. */

const BELLA: NewPet = { name: "Bella", species: "Dog", breed: "Cockapoo", month: "January", year: "2022", weightKg: "9", vaccinatedDaysAgo: 60 };

test("search is free; upgrading unlocks booking, the boarding pass and the approved route home", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await signUpNewOwner(page, "Flight Owner", `bb-${info.project.name}`);
  const tripUrl = await planTripAs(page, { pet: BELLA, to: "France", arrive: day(30), back: day(44), landing: "CDG" });

  // Every flight explains where Bella can travel
  await page.goto("/app/flights");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Flights: Great Britain to France");
  await expect(page.getByTestId("upgrade-banner")).toBeVisible();
  const airFrance = page.locator('[data-testid="flight"][data-airline="AF"]').first();
  await expect(airFrance.getByTestId("pet-eligibility")).toContainText("In the hold.");
  await expect(airFrance.getByTestId("pet-eligibility")).toContainText("over the 8 kg cabin limit");
  await expect(page.locator('[data-testid="flight"][data-airline="BA"]').first().getByTestId("pet-eligibility")).toContainText("Hold, as cargo.");
  await expect(airFrance.getByRole("img", { name: "Air France" })).toBeVisible();
  await shot(page, info.outputPath("search.png"));

  // Simulated checkout, then straight back to the search
  await airFrance.getByRole("link", { name: "Upgrade to book" }).click();
  await page.waitForURL(/\/app\/upgrade\?next=/);
  await expect(page.getByTestId("tier-PLAN")).toBeVisible();
  await shot(page, info.outputPath("upgrade.png"));
  await page.getByTestId("tier-COMPLETE").getByRole("button", { name: "Pay £39 (simulated)" }).click();
  await page.waitForURL(/\/app\/flights\?.*upgraded=1/);
  await expect(page.getByText("You're on the Complete plan")).toBeVisible();
  await expect(page.getByTestId("upgrade-banner")).toHaveCount(0);

  await page.locator('[data-testid="flight"][data-airline="AF"]').first().getByRole("button", { name: /^Book / }).click();
  await page.waitForURL(/\/app\/flights\/[^/]+\?booked=1$/);
  const ticket = page.getByTestId("e-ticket");
  await expect(ticket).toContainText("Air France");
  await expect(ticket).toContainText("Bella");
  await expect(ticket).toContainText("In the hold");
  await expect(ticket).toContainText("Sample ticket");
  await shot(page, info.outputPath("ticket.png"));

  // Home to Great Britain: cargo only, and booking it ticks off the approved route
  await page.getByRole("link", { name: "Book the journey home" }).click();
  const home = page.getByTestId("flight").first();
  await expect(home.getByTestId("pet-eligibility")).toContainText("Hold, as cargo.");
  await home.getByRole("button", { name: /^Book / }).click();
  await page.waitForURL(/\/app\/flights\/[^/]+\?booked=1$/);
  await expect(page.getByText("Your approved route home is now ticked off.")).toBeVisible();

  await page.goto(tripUrl);
  const route = page.getByTestId("plan-Bella").getByTestId("task-return-approved-route");
  await expect(route).toHaveAttribute("data-status", "DONE");
  await expect(route.getByTestId("task-recorded-by")).toContainText("Booked with");

  await page.goto("/app");
  await expect(page.getByTestId("dashboard-booking")).toHaveCount(2);
  await shot(page, info.outputPath("dashboard.png"));

  await page.goto("/app/insurance");
  await expect(page.getByTestId("insurance-offer")).toHaveCount(3);
  await expect(page.getByTestId("insurance-offer").first()).toContainText("Sample");
  await shot(page, info.outputPath("insurance.png"));
  expect(errors).toEqual([]);
});
