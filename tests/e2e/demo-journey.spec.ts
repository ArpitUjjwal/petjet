import { expect, test, type Page } from "@playwright/test";
import { microchipCertificate } from "../../src/lib/documents/sample-pdf";
import { day, login, planTripAs, shot, signUpNewOwner, trackErrors, type NewPet } from "./helpers";

/*
 * Batch C: the whole presentation journey, a week before the trip.
 * Desktop and mobile run at the same time against the same demo vet and lab, so each run has
 * its own owner and pet name, and never touches the demo owner's data.
 */

async function bell(page: Page) {
  return page.getByRole("link", { name: /^Notifications/ }).last();
}

test("the demo journey: owner → vet → lab → flights, ready to fly with only the return dose left", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  const owner = `Journey ${info.project.name}`;
  const name = info.project.name === "mobile" ? "Bree" : "Bella";
  const BELLA: NewPet = { name, species: "Dog", breed: "Cockapoo", month: "January", year: "2022", weightKg: "9", vaccinatedDaysAgo: 60 };
  await signUpNewOwner(page, owner, `bc-${info.project.name}`);
  const tripUrl = await planTripAs(page, { pet: BELLA, to: "France", arrive: day(8), back: day(15), landing: "CDG" });

  // 1. The owner checks and confirms the microchip certificate
  await page.goto("/app/documents/upload");
  await page.getByLabel("Document file").setInputFiles({
    name: "bella-microchip.pdf",
    mimeType: "application/pdf",
    buffer: microchipCertificate(
      { name, species: "Dog", breed: "Cockapoo", microchip: "956000012345678", dob: "2022-01-14" },
      { implantedOn: "2022-04-02" },
    ),
  });
  await page.getByRole("button", { name: "Upload and read" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Microchip");
  await page.getByRole("button", { name: "Looks right, confirm" }).click();
  await expect(page.getByTestId("document-status")).toHaveAttribute("data-status", "CONFIRMED");

  // 2. Requests an official vet for the health certificate and shares the record
  await page.goto(tripUrl);
  const plan = page.getByTestId(`plan-${name}`);
  await plan.getByTestId("task-ahc").getByRole("link", { name: "Find a vet" }).click();
  const riverside = page.getByTestId("vet-card").filter({ hasText: "Riverside Veterinary Centre" });
  await riverside.getByRole("button", { name: "Choose a time" }).click();
  const dialog = page.getByRole("dialog", { name: "Book Riverside Veterinary Centre" });
  await dialog.getByRole("radio").first().click();
  await dialog.getByText(/^Share \d+ documents? with Riverside Veterinary Centre/).click();
  await dialog.getByRole("button", { name: "Request appointment" }).click();
  await page.waitForURL(/\/app\/vets\?requested=/);

  // 3. The vet is told, accepts, issues the certificate dated today and orders a titre test
  const vetCtx = await browser.newContext({ ...(info.project.use ?? {}) });
  const vet = await vetCtx.newPage();
  await login(vet, "vet");
  await vet.goto("/provider/notifications");
  await expect(vet.getByTestId("notification").filter({ hasText: `New request: Animal health certificate for ${name}` }).first()).toBeVisible();
  await vet.goto("/provider");
  await vet.getByTestId("request-row").filter({ hasText: owner }).first().click();
  await vet.getByRole("button", { name: "Accept" }).click();
  await expect(vet.getByTestId("appointment-status")).toHaveAttribute("data-status", "ACCEPTED");
  await vet.getByRole("button", { name: "Issue demo certificate" }).click();
  await expect(vet.getByTestId("appointment-status")).toHaveAttribute("data-status", "COMPLETED");
  await vet.getByRole("button", { name: "Order test" }).click();
  await expect(vet.getByTestId("vet-lab-order")).toContainText("With Northgate Pathology Laboratory");

  // 4. The lab posts the result
  const labCtx = await browser.newContext({ ...(info.project.use ?? {}) });
  const lab = await labCtx.newPage();
  await login(lab, "lab");
  await lab.getByTestId("lab-order-row").filter({ hasText: name }).filter({ hasText: "Awaiting result" }).first().click();
  await lab.getByLabel("Titre result").fill("0.8");
  await lab.getByRole("button", { name: "Post result" }).click();
  await expect(lab.getByTestId("lab-order-status")).toHaveAttribute("data-status", "RESULTED");

  // 5. Back to the owner: the bell has news, and the result is on the trip
  await page.goto("/app");
  await expect(await bell(page)).toHaveAccessibleName(/Notifications, [4-9] unread/);
  await (await bell(page)).click();
  await page.waitForURL("**/app/notifications");
  const updates = page.getByTestId("notification");
  await expect(updates.filter({ hasText: "Riverside Veterinary Centre confirmed" })).toHaveCount(1);
  await expect(updates.filter({ hasText: "Animal health certificate issued" })).toHaveCount(1);
  await expect(updates.filter({ hasText: `Rabies antibody titre test result for ${name}` })).toContainText("0.8 IU/mL, pass");
  await shot(page, info.outputPath("notifications.png"));
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.locator('[data-testid="notification"][data-unread]')).toHaveCount(0);
  await expect(await bell(page)).toHaveAccessibleName("Notifications");
  await page.goto(tripUrl);
  await expect(plan.getByTestId("task-ahc")).toHaveAttribute("data-status", "DONE");
  await expect(page.getByTestId("trip-lab-result")).toContainText("0.8 IU/mL · Pass");

  // 6. Upgrades, then books the recommended hold flight out and cargo flight home in one go
  await page.goto("/app/flights");
  await page.getByTestId("upgrade-banner").getByRole("link", { name: "Upgrade to book" }).click();
  await page.getByTestId("tier-COMPLETE").getByRole("button", { name: "Pay £39 (simulated)" }).click();
  await page.waitForURL(/\/app\/flights\?.*upgraded=1/);
  await expect(page.getByTestId("recommended-flights")).toContainText("In the hold");
  await expect(page.getByTestId("recommended-flights")).toContainText("Hold, as cargo");
  await page.getByRole("button", { name: "Book both flights" }).click();
  await expect(page.getByTestId("flights-booked")).toContainText("Both flights booked.");

  // 7. Insurance is the last step on the journey; choosing cover makes the trip ready to fly
  await page.goto("/app");
  await expect(page.getByTestId("readiness")).toContainText("6 of 7 steps");
  await expect(page.locator('[data-testid="journey-step"][data-step="insurance"]')).toHaveAttribute("data-state", "current");
  await page.getByTestId("journey-current").getByRole("link", { name: "Compare cover" }).click();
  await expect(page.getByTestId("insurance-offer")).toHaveCount(4);
  await page.getByRole("button", { name: "Choose this cover" }).click();
  await expect(page.getByTestId("insurance-policy")).toContainText("Sample, not a real policy");
  await page.goto("/app");
  await expect(page.getByTestId("ready-to-fly")).toContainText("While you're away");
  await expect(page.getByTestId("ready-to-fly")).toContainText("tapeworm");
  await expect(page.getByTestId("dashboard-booking")).toHaveCount(2);
  await expect(page.getByTestId("dashboard-insurance")).toBeVisible();
  await shot(page, info.outputPath("ready-to-fly.png"));
  await page.goto(tripUrl);
  const open = plan.locator('[data-testid^="task-"][data-status="TODO"]');
  await expect(open).toHaveCount(1);
  await expect(open).toHaveAttribute("data-testid", "task-tapeworm-return");

  await vetCtx.close();
  await labCtx.close();
  expect(errors).toEqual([]);
});

test("the demo bar switches between the demo accounts, and real accounts never see it", async ({ page }, info) => {
  const errors = trackErrors(page);
  await login(page, "vet");
  const bar = page.getByRole("region", { name: "Demo switcher" });
  await expect(bar.getByRole("button", { name: "Vet" })).toHaveAttribute("aria-pressed", "true");
  await shot(page, info.outputPath("demo-bar.png"), false);

  await bar.getByRole("button", { name: "Switch to lab" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Test orders");
  await expect(bar.getByRole("button", { name: "Lab" })).toHaveAttribute("aria-pressed", "true");

  await bar.getByRole("button", { name: "Switch to pet owner" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  /* The owner side has no switching, just a way to restart the guided demo */
  await expect(page.getByRole("region", { name: "Demo", exact: true }).getByRole("button", { name: "Restart demo" })).toBeVisible();

  /* Signed-in users are sent away from the sign-up page, so start a fresh session */
  await page.context().clearCookies();
  await signUpNewOwner(page, "Real Owner", `bc-bar-${info.project.name}`);
  await expect(page.getByRole("region", { name: "Demo switcher" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Demo", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the guided demo: five steps from the prefilled trip to ready to fly, the vet replying by itself", async ({ page }, info) => {
  /* Uses the shared demo owner, so it runs once (desktop) rather than in parallel on both projects */
  test.skip(info.project.name !== "desktop", "Mutates the shared demo owner");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await login(page, "owner");
  await page.getByRole("button", { name: "Restart demo" }).click();
  await expect(page.getByTestId("journey")).toContainText("0 of 5 done");
  /* The cost and the savings are on Home from the start */
  await expect(page.getByTestId("cost-total")).toHaveText(/^£[\d,]+$/);
  await expect(page.getByTestId("cost-saved")).toHaveText(/^£[1-9][\d,]*$/);
  await expect(page.getByTestId("cost-saved-agency")).toContainText("less");
  const step = (id: string) => page.locator(`[data-testid="journey-step"][data-step="${id}"]`);
  const next = page.getByTestId("journey-current");

  // 1. Documents: the microchip certificate is already read
  await next.getByRole("link", { name: "Check details" }).click();
  await page.getByRole("button", { name: "Looks right, confirm" }).click();
  await page.getByRole("link", { name: "Back to your journey" }).click();
  await expect(step("documents")).toHaveAttribute("data-state", "done");

  // 2. Health certificate: one tap books the best match, which accepts and completes it
  await next.getByRole("link", { name: "Book a vet" }).click();
  await expect(page.getByTestId("vet-price")).toContainText("partner price, save");
  await page.getByTestId("vet-card").first().getByRole("button", { name: /^Book / }).click();
  await expect(page.getByTestId("vet-success")).toContainText("Appointment completed");
  await expect(page.getByTestId("owner-appointment").first()).toHaveAttribute("data-status", "COMPLETED");
  await page.getByRole("link", { name: "Back to your journey" }).click();
  await expect(step("certificate")).toHaveAttribute("data-state", "done");

  // 3. Flights
  await next.getByRole("link", { name: "See flights" }).click();
  await page.getByRole("button", { name: "Book both flights" }).click();
  await page.getByTestId("flights-booked").getByRole("link", { name: "Back to your journey" }).click();
  await expect(step("flights")).toHaveAttribute("data-state", "done");

  // 4. Insurance: four insurers with logos, a comparison, the recommended one preselected
  await next.getByRole("link", { name: "Compare cover" }).click();
  const offers = page.getByTestId("insurance-offer");
  await expect(offers).toHaveCount(4);
  await expect(offers.locator("img")).toHaveCount(4);
  await expect(page.getByTestId("insurance-saving")).toHaveCount(4);
  await expect(offers.filter({ hasText: "Recommended" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Compare all details" }).click();
  await expect(page.getByRole("table")).toContainText("Excess per claim");
  await page.getByRole("button", { name: "Choose this cover" }).click();
  await expect(page.getByTestId("insurance-policy")).toContainText("Abroad Plus");
  await expect(page.getByTestId("insurance-policy").getByRole("img", { name: "Meadow Mutual" })).toBeVisible();
  await page.getByRole("link", { name: "Back to your journey" }).click();

  // 5. Ready to fly
  await expect(page.getByTestId("ready-to-fly")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ready to fly");
  await shot(page, info.outputPath("guided-ready-to-fly.png"));
  await page.getByRole("link", { name: "See the breakdown" }).click();
  const breakdown = page.getByTestId("cost-breakdown");
  await expect(breakdown).toContainText("You save");
  await expect(breakdown.getByText("estimate", { exact: true })).toHaveCount(0);
  await page.goto("/app");

  await page.getByRole("button", { name: "Restart demo" }).click();
  await expect(page.getByTestId("journey")).toContainText("0 of 5 done");
  expect(errors).toEqual([]);
});
