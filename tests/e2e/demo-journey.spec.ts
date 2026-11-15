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
  await page.getByRole("button", { name: "Confirm and update plan" }).click();
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

  // 6. Upgrades, books the hold flight out and the cargo flight home, and gets the e-ticket
  await page.goto("/app/flights");
  await page.locator('[data-testid="flight"][data-airline="AF"]').first().getByRole("link", { name: "Upgrade to book" }).click();
  await page.getByTestId("tier-COMPLETE").getByRole("button", { name: "Pay £39 (simulated)" }).click();
  await page.waitForURL(/\/app\/flights\?.*upgraded=1/);
  await page.locator('[data-testid="flight"][data-airline="AF"]').first().getByRole("button", { name: /^Book / }).click();
  await page.waitForURL(/\/app\/flights\/[^/]+\?booked=1$/);
  await expect(page.getByTestId("e-ticket")).toContainText("In the hold");
  await page.getByRole("link", { name: "Book the journey home" }).click();
  await page.getByTestId("flight").first().getByRole("button", { name: /^Book / }).click();
  await page.waitForURL(/\/app\/flights\/[^/]+\?booked=1$/);
  await expect(page.getByText("Your approved route home is now ticked off.")).toBeVisible();

  // 7. Ready to fly: everything for the trip out is done; only the return tapeworm dose is left
  await page.goto("/app");
  await expect(page.getByTestId("readiness-count")).toHaveText("6 of 7 steps");
  await expect(page.getByTestId("tile-next")).toContainText("Tapeworm treatment before coming home");
  await expect(page.getByTestId("dashboard-booking")).toHaveCount(2);
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
  await expect(bar.getByRole("button", { name: "Pet owner" })).toHaveAttribute("aria-pressed", "true");

  /* Signed-in users are sent away from the sign-up page, so start a fresh session */
  await page.context().clearCookies();
  await signUpNewOwner(page, "Real Owner", `bc-bar-${info.project.name}`);
  await expect(page.getByRole("region", { name: "Demo switcher" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
