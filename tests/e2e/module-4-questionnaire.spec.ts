import { expect, test, type Page } from "@playwright/test";
import {
  choose,
  daysFromToday,
  expectNoHorizontalScroll,
  fillPetProfile,
  fillTrip,
  login,
  signUpNewOwner,
  trackErrors,
  uniqueEmail,
} from "./helpers";

const continueBtn = (page: Page) => page.getByRole("button", { name: "Continue" });

async function addNewPet(page: Page, pet: Parameters<typeof fillPetProfile>[1]) {
  await fillPetProfile(page, pet);
  await page.getByRole("button", { name: "Save pet" }).click();
  await expect(page.getByRole("list", { name: "Pets you've added" })).toContainText(pet.name);
}

test.describe("Module 4: questionnaire, guest to account", () => {
  test("a guest plans a trip, signs up and lands on a provisional plan", async ({ page, isMobile }, info) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await page.locator("section").first().getByRole("link", { name: "Plan my trip" }).click();
    await page.waitForURL("**/plan");

    // Step 1: pet details
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Who's travelling?");
    await expect(page.locator('li[aria-current="step"]')).toContainText("Pet details");
    await addNewPet(page, { name: "Milo", species: "Cat", breed: "British Shorthair", month: "March", year: "2023" });
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("step-1.png") });
    await continueBtn(page).click();

    // Step 2: travel plans
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where are you going?");
    await fillTrip(page, { to: "France", arrive: daysFromToday(120), back: daysFromToday(134) });
    await page.getByLabel(/Flying from/).selectOption("LHR");
    await page.getByLabel(/Landing at/).selectOption("CDG");
    await choose(page, "Where would you like your pet to travel?", "In the cabin with me");
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("step-2.png"), fullPage: true });
    await continueBtn(page).click();

    // Step 3: health & records
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Health & records");
    await choose(page, "Is Milo microchipped?", "Yes");
    await page.getByLabel(/Microchip number/).fill("956 000 012 345 678");
    await choose(page, "Is Milo vaccinated against rabies?", "Yes");
    await page.getByLabel("Date of the last dose").fill(daysFromToday(-60));
    await choose(page, "Was that dose…", "A first vaccination");
    await choose(page, "Do you have your pets' microchip and vaccination records?", "Some of them");
    await page.screenshot({ path: info.outputPath("step-3.png"), fullPage: true });
    await continueBtn(page).click();

    // Step 4: review
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your answers");
    await expect(page.getByTestId("review-Milo")).toContainText("British Shorthair");
    await expect(page.getByTestId("review-Milo")).toContainText("Microchip: Yes");
    await expect(page.getByText("Great Britain to France")).toBeVisible();
    await expect(page.getByText("LHR → CDG")).toBeVisible();
    await page.screenshot({ path: info.outputPath("step-4.png"), fullPage: true });
    await page.getByRole("button", { name: "Create account and build my plan" }).click();

    // Sign up, then the saved answers become a trip
    await page.waitForURL(/\/signup\?next=/);
    await page.getByLabel("Full name").fill("Guest Planner");
    await page.getByLabel("Email").fill(uniqueEmail(`guest-${info.project.name}`));
    await page.getByLabel("Password").fill("Travel-with-pets-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/app\/trips\/[^/]+\?new=1$/, { timeout: 20_000 });

    await expect(page.getByText("Your provisional plan is ready")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Great Britain to France");
    const plan = page.getByTestId("plan-Milo");
    await expect(plan.getByTestId("task-microchip")).toHaveAttribute("data-status", "DONE");
    await expect(plan.getByTestId("task-rabies")).toHaveAttribute("data-status", "DONE");
    await expect(plan.getByTestId("task-ahc")).toHaveAttribute("data-status", "TODO");
    await expect(plan.getByTestId("task-ahc")).toContainText("Official vet");
    await expect(plan.getByTestId("leg-return-Milo")).toContainText("Book an approved route home");
    await expect(plan).toContainText("last day of that month");

    // The rule behind a task, with its official source
    await plan.getByTestId("task-ahc").getByText("Details", { exact: true }).click();
    await plan.getByTestId("task-ahc").getByText("Why is this needed?").click();
    await expect(
      plan.getByTestId("task-ahc").getByRole("link", { name: /GOV.UK: Getting an animal health certificate/ }),
    ).toHaveAttribute("href", /gov\.uk\/taking-your-pet-abroad\/getting-an-animal-health-certificate/);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("trip-plan.png"), fullPage: true });

    // The draft is cleared, and the pet and trip are saved to the account
    expect(await page.evaluate(() => localStorage.getItem("petjet.plan-draft.v1"))).toBeNull();
    await page.goto("/app/pets");
    await expect(page.getByTestId("pet-card")).toContainText("Milo");
    /* "Trip plan" in the menu goes straight to the only trip */
    await page.goto("/app/trips");
    await page.waitForURL(/\/app\/trips\/[^/]+$/);
    await expect(page.getByTestId("plan-Milo")).toBeVisible();
    // Since Module 5 the dashboard shows the trip itself rather than a card
    await page.goto("/app");
    await expect(page.getByTestId("tile-hero")).toContainText("Great Britain to France");
    void isMobile;
    expect(errors).toEqual([]);
  });
});

test.describe("Module 4: flowchart branches", () => {
  test("unsupported species shows guidance and can't be added", async ({ page }) => {
    await page.goto("/plan");
    await page.getByLabel("Pet's name").fill("Thumper");
    await choose(page, "Species", "Other");
    await expect(page.getByTestId("unsupported-species")).toContainText("PetJet plans trips for dogs, cats and ferrets");
    await expect(page.getByRole("button", { name: "Save pet" })).toBeDisabled();
    await expect(page.getByLabel("Month")).toHaveCount(0);
  });

  test("missing travel details are requested before moving on", async ({ page }) => {
    await page.goto("/plan");
    await addNewPet(page, { name: "Milo", species: "Cat", month: "March", year: "2023" });
    await continueBtn(page).click();
    await continueBtn(page).click();
    await expect(page.getByText("Some travel details are missing or need checking.")).toBeVisible();
    await expect(page.getByText("Choose where you're going.")).toBeVisible();
    await expect(page.getByText("Enter the date your pet arrives.")).toBeVisible();
    await expect(page.getByText("Enter your return date, or tick that you don't know it yet.")).toBeVisible();
    await expect(page.getByText("Tell us about any stopovers.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where are you going?");

    await fillTrip(page, { to: "France", arrive: daysFromToday(60) });
    await continueBtn(page).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Health & records");
  });

  test("an unsupported route ends in guidance, and answers can be changed", async ({ page }) => {
    await page.goto("/plan");
    await addNewPet(page, { name: "Milo", species: "Cat", month: "March", year: "2023" });
    await continueBtn(page).click();
    await fillTrip(page, { to: "Spain", arrive: daysFromToday(60), back: daysFromToday(70) });
    await continueBtn(page).click();
    const guidance = page.getByTestId("coverage-guidance");
    await expect(guidance.getByRole("heading", { level: 1 })).toHaveText("We can't plan this trip yet");
    await expect(guidance.locator('[data-code="ROUTE_NOT_SUPPORTED"]')).toContainText("from Great Britain to");
    await guidance.getByRole("button", { name: "Change my answers" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where are you going?");
    await expect(page.getByLabel("Going to")).toHaveValue("ES");
  });

  test("a stopover outside the airport is not supported, airside is", async ({ page }) => {
    await page.goto("/plan");
    await addNewPet(page, { name: "Milo", species: "Cat", month: "March", year: "2023" });
    await continueBtn(page).click();
    await fillTrip(page, { to: "United States", arrive: daysFromToday(60), transit: "Yes, pet leaves the airport" });
    await continueBtn(page).click();
    await expect(page.getByTestId("coverage-guidance").locator('[data-code="TRANSIT_ENTRY"]')).toBeVisible();
    await page.getByRole("button", { name: "Change my answers" }).click();
    await choose(page, "Does the flight stop anywhere on the way?", "Yes, pet stays in the airport");
    await continueBtn(page).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Health & records");
  });

  test("ferrets to the USA and pets travelling alone are not supported", async ({ page }) => {
    await page.goto("/plan");
    await addNewPet(page, { name: "Bandit", species: "Ferret", month: "May", year: "2022" });
    await continueBtn(page).click();
    await fillTrip(page, { to: "United States", arrive: daysFromToday(60), with: "On its own" });
    await continueBtn(page).click();
    const guidance = page.getByTestId("coverage-guidance");
    await expect(guidance.locator('[data-code="SPECIES_NOT_SUPPORTED"]')).toContainText("Bandit:");
    await expect(guidance.locator('[data-code="COMMERCIAL_MOVEMENT"]')).toBeVisible();
  });

  test("answers are kept in the browser and can be cleared", async ({ page }) => {
    await page.goto("/plan");
    await addNewPet(page, { name: "Pickle", species: "Dog", month: "June", year: "2021" });
    await page.reload();
    await expect(page.getByText("We've kept your answers from last time.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Pets you've added" })).toContainText("Pickle");
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("list", { name: "Pets you've added" })).toHaveCount(0);
    await expect(page.getByLabel("Pet's name")).toHaveValue("");
  });

  test("a provider account is sent to its portal instead", async ({ page }) => {
    await login(page, "vet");
    await page.goto("/plan");
    await expect(page).toHaveURL(/\/provider$/);
  });
});

test.describe("Module 4: signed-in owner", () => {
  test("adds a pet in My pets, then reuses it for a trip that isn't feasible yet", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Dana Owner", `owner-${info.project.name}`);

    // My pets: add with validation
    await page.goto("/app/pets");
    await expect(page.getByText("No pets yet")).toBeVisible();
    await page.getByRole("link", { name: "Add a pet" }).first().click();
    await fillPetProfile(page, { name: "Bella", species: "Dog", breed: "Cockapoo", month: "January", year: "2022" });
    await choose(page, "Is Bella microchipped?", "Yes");
    await page.getByLabel(/Microchip number/).fill("12345");
    await choose(page, "Is Bella vaccinated against rabies?", "No");
    await page.getByRole("button", { name: "Add pet" }).click();
    await expect(page.getByText("A standard microchip number has 15 digits.")).toBeVisible();
    await page.getByLabel(/Microchip number/).fill("956000012345678");
    await page.getByRole("button", { name: "Add pet" }).click();
    await page.waitForURL(/\/app\/pets\?saved=/);
    await expect(page.getByTestId("pet-card")).toContainText("Bella");
    await expect(page.getByTestId("pet-card")).toContainText("No rabies vaccine");
    await page.screenshot({ path: info.outputPath("pets.png") });

    // Questionnaire: Bella is offered, health answers are pre-filled
    await page.goto("/plan");
    await page.getByText("Bella", { exact: true }).click();
    await continueBtn(page).click();
    await fillTrip(page, { to: "Ireland", arrive: daysFromToday(10) });
    await page.getByLabel(/Landing at/).selectOption("DUB");
    await continueBtn(page).click();
    await expect(page.getByRole("group", { name: "Is Bella vaccinated against rabies?" }).getByRole("radio", { name: "No", exact: true })).toBeChecked();
    await choose(page, "Do you have your pets' microchip and vaccination records?", "Not yet");
    await continueBtn(page).click();
    await page.getByRole("button", { name: "Build my plan" }).click();
    await page.waitForURL(/\/app\/trips\/[^/]+\?new=1$/);

    // Ten days is too soon for a first rabies vaccination: the plan says so and gives a date
    const plan = page.getByTestId("plan-Bella");
    await expect(plan.getByText("Bella isn't ready for these dates")).toBeVisible();
    await expect(plan.getByText(/Earliest arrival that works:/)).toBeVisible();
    await expect(plan.getByTestId("task-rabies")).toHaveAttribute("data-status", "BLOCKED");
    await expect(plan.getByTestId("task-tapeworm-outbound")).toBeVisible();
    await expect(plan.getByTestId("task-ireland-entry")).toHaveAttribute("data-status", "DONE");
    await page.screenshot({ path: info.outputPath("trip-not-feasible.png"), fullPage: true });

    // Edit the pet; then delete the trip
    const tripUrl = page.url().replace("?new=1", "");
    await page.goto("/app/pets");
    await page.getByTestId("pet-card").click();
    await page.getByLabel("Pet's name").fill("Bella Rose");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/app\/pets\?saved=/);
    await expect(page.getByTestId("pet-card")).toContainText("Bella Rose");

    await page.goto(tripUrl);
    await expect(page.getByTestId("plan-Bella Rose")).toBeVisible();
    await page.getByRole("button", { name: "Delete trip" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete trip" }).click();
    await page.waitForURL("**/app/trips");
    await expect(page.getByText("No trips yet")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("another owner can't open someone else's trip or pet", async ({ page, browser }, info) => {
    await signUpNewOwner(page, "First Owner", `iso-a-${info.project.name}`);
    await page.goto("/app/pets/new");
    await fillPetProfile(page, { name: "Secret", species: "Cat", month: "March", year: "2020" });
    await choose(page, "Is Secret microchipped?", "Not sure");
    await choose(page, "Is Secret vaccinated against rabies?", "Not sure");
    await page.getByRole("button", { name: "Add pet" }).click();
    await page.waitForURL(/\/app\/pets\?saved=/);
    await page.getByTestId("pet-card").click();
    await page.waitForURL(/\/app\/pets\/[^?]+$/);
    const petUrl = page.url();

    const other = await browser.newContext();
    const page2 = await other.newPage();
    await signUpNewOwner(page2, "Second Owner", `iso-b-${info.project.name}`);
    const res = await page2.goto(petUrl);
    expect(res?.status()).toBe(404);
    await expect(page2.getByRole("heading", { level: 1 })).toHaveText("This page has flown off.");
    await other.close();
  });

  test("deleting a pet asks for confirmation", async ({ page }, info) => {
    await signUpNewOwner(page, "Del Owner", `del-${info.project.name}`);
    await page.goto("/app/pets/new");
    await fillPetProfile(page, { name: "Temp", species: "Ferret", month: "May", year: "2024" });
    await choose(page, "Is Temp microchipped?", "No");
    await choose(page, "Is Temp vaccinated against rabies?", "No");
    await page.getByRole("button", { name: "Add pet" }).click();
    await page.waitForURL(/\/app\/pets\?saved=/);
    await page.getByTestId("pet-card").click();
    await page.getByRole("button", { name: "Delete pet" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete Temp?" });
    await dialog.getByRole("button", { name: "Keep" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Delete pet" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete pet" }).click();
    await page.waitForURL("**/app/pets");
    await expect(page.getByText("No pets yet")).toBeVisible();
  });
});
