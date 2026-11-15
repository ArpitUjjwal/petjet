import { expect, type Page } from "@playwright/test";
import { addDays, todayISO } from "../../src/lib/rules/dates";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../../prisma/demo-accounts";

export { DEMO_ACCOUNTS, DEMO_PASSWORD };

/* Pages linked from shared navigation that later modules build.
   Next prefetches them, which 404s until they exist. Remove entries as modules land. */
const PENDING_ROUTES: string[] = [];
const PENDING_PREFIXES: string[] = [];

/** Collects uncaught exceptions, console errors and failed requests for a page. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
      errors.push(m.text());
    }
  });
  page.on("response", (res) => {
    if (res.status() < 400) return;
    const path = new URL(res.url()).pathname;
    if (PENDING_ROUTES.includes(path)) return;
    if (PENDING_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return;
    errors.push(`${res.status()} ${path}`);
  });
  return errors;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll sideways").toBeLessThanOrEqual(0);
}

export async function login(page: Page, who: keyof typeof DEMO_ACCOUNTS) {
  const account = DEMO_ACCOUNTS[who];
  await page.goto(who === "owner" ? "/login" : "/provider/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(who === "owner" ? "**/app" : "**/provider");
}

/** Logs out through the UI, opening the mobile menu when the sidebar is hidden. */
export async function logout(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/* ---------- Questionnaire helpers ---------- */

/** "YYYY-MM-DD" n days from today (UTC, matching the server's date-only handling closely enough for tests). */
export function daysFromToday(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@petjet.test`;
}

/** Picks an option in a ChoiceGroup by its legend and option label. */
export async function choose(page: Page, legend: string | RegExp, option: string) {
  await page.getByRole("group", { name: legend }).getByText(option, { exact: true }).click();
}

export async function signUpNewOwner(page: Page, name: string, tag: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(uniqueEmail(tag));
  await page.getByLabel("Password").fill("Travel-with-pets-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/app");
}

export async function fillPetProfile(
  page: Page,
  pet: { name: string; species: "Dog" | "Cat" | "Ferret"; breed?: string; month: string; year: string; weightKg?: string },
) {
  await page.getByLabel("Pet's name").fill(pet.name);
  await choose(page, "Species", pet.species);
  if (pet.breed) await page.getByLabel(/Breed/).fill(pet.breed);
  if (pet.weightKg) await page.getByLabel(/Weight/).fill(pet.weightKg);
  await page.getByLabel("Month").selectOption({ label: pet.month });
  await page.getByLabel("Year").selectOption(pet.year);
}

export async function fillTrip(
  page: Page,
  trip: {
    to: string;
    arrive: string;
    back?: string;
    transit?: string;
    with?: string;
    purpose?: string;
  },
) {
  await page.getByLabel("Going to").selectOption({ label: trip.to });
  await page.getByLabel("Date your pet arrives").fill(trip.arrive);
  if (trip.back) await page.getByLabel("Date you come home").fill(trip.back);
  else await page.getByText("I don't know my return date yet").click();
  await choose(page, "Does the flight stop anywhere on the way?", trip.transit ?? "No, it's direct");
  await choose(page, "Who does your pet travel with?", trip.with ?? "With me");
  await choose(page, "What's the trip for?", trip.purpose ?? "Travelling or moving with my pet");
}

/* ---------- Planning a trip as a signed-in owner ---------- */

/** "YYYY-MM-DD" n days from today in UK time, the same "today" the app uses */
export const day = (n: number) => addDays(todayISO(), n);

export type NewPet = {
  name: string;
  species: "Dog" | "Cat";
  breed?: string;
  month: string;
  year: string;
  vaccinatedDaysAgo?: number;
  weightKg?: string;
  /** Answer "Not sure" to the rabies question instead of "No" when not vaccinated */
  rabiesUnknown?: boolean;
};

/** Plans a trip through the questionnaire as a signed-in owner, for a new or saved pet. */
export async function planTripAs(
  page: Page,
  opts: {
    pet: NewPet | { existing: string };
    to: "France" | "Ireland" | "United States";
    arrive: string;
    back?: string;
    landing: string;
  },
) {
  await page.goto("/plan");
  if ("existing" in opts.pet) {
    await page.getByText(opts.pet.existing, { exact: true }).click();
  } else {
    await fillPetProfile(page, opts.pet);
    await page.getByRole("button", { name: "Save pet" }).click();
    await expect(page.getByRole("list", { name: "Pets you've added" })).toContainText(opts.pet.name);
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await fillTrip(page, { to: opts.to, arrive: opts.arrive, back: opts.back });
  await page.getByLabel(/Landing at/).selectOption(opts.landing);
  await page.getByRole("button", { name: "Continue" }).click();
  if (!("existing" in opts.pet)) {
    const p = opts.pet;
    await choose(page, `Is ${p.name} microchipped?`, "Yes");
    await page.getByLabel(/Microchip number/).fill("956000012345678");
    if (p.vaccinatedDaysAgo !== undefined) {
      await choose(page, `Is ${p.name} vaccinated against rabies?`, "Yes");
      await page.getByLabel("Date of the last dose").fill(day(-p.vaccinatedDaysAgo));
      await choose(page, "Was that dose…", "A first vaccination");
    } else {
      await choose(page, `Is ${p.name} vaccinated against rabies?`, p.rabiesUnknown ? "Not sure" : "No");
    }
  }
  await choose(page, "Do you have your pets' microchip and vaccination records?", "Some of them");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Build my plan" }).click();
  await page.waitForURL(/\/app\/trips\/[^/?]+\?new=1$/, { timeout: 20_000 });
  return page.url().replace("?new=1", "");
}


/** Screenshot once entrance animations have settled, so tiles aren't caught mid-fade. */
export async function shot(page: Page, path: string, fullPage = true) {
  if (fullPage) {
    /* Timeline items reveal as they scroll into view; pass over the page once so they all have */
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
        window.scrollTo({ top: y, behavior: "instant" });
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  await page.screenshot({ path, fullPage, animations: "disabled" });
}
