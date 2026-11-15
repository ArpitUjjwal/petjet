import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, login, trackErrors } from "./helpers";

test.describe("Module 2: landing page", () => {
  test("renders every section without errors or sideways scroll", async ({ page }, info) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pet travel, simplified.");
    for (const id of ["how-it-works", "pricing"]) {
      const section = page.locator(`section#${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: info.outputPath("landing-hero.png") });
    expect(errors).toEqual([]);
  });

  test("sections reveal on scroll for full-page review", async ({ page }, info) => {
    await page.goto("/");
    // Scroll through slowly so every reveal animation runs, then capture the whole page.
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: info.outputPath("landing-full.png"), fullPage: true });
    await expect(page.getByTestId("tier-PLAN")).toHaveCSS("opacity", "1");
  });

  test("keeps the landing page short: hero, how it works, pricing", async ({ page }) => {
    await page.goto("/");
    for (const id of ["features", "routes", "faq"]) await expect(page.locator(`section#${id}`)).toHaveCount(0);
  });

  test("hero calls to action: plan a trip, or try the demo in one click", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("section").first();
    await expect(hero.getByRole("link", { name: "Plan my trip" })).toHaveAttribute("href", "/plan");
    await hero.getByRole("button", { name: "Try the demo" }).click();
    await page.waitForURL((u) => u.pathname === "/app");
    await expect(page.getByTestId("journey").or(page.getByTestId("ready-to-fly"))).toBeVisible();
  });


  test("pricing shows the three tiers and that payments are simulated", async ({ page }) => {
    await page.goto("/#pricing");
    await expect(page.getByTestId("tier-EXPLORE")).toContainText("Free");
    await expect(page.getByTestId("tier-PLAN")).toContainText("£19");
    await expect(page.getByTestId("tier-PLAN")).toContainText("Most popular");
    await expect(page.getByTestId("tier-COMPLETE")).toContainText("£39");
    await expect(page.locator("section#pricing")).toContainText("Payments in this demo are simulated");
    await page.getByTestId("tier-COMPLETE").getByRole("link", { name: "Choose Complete" }).click();
    await page.waitForURL("**/plan");
  });


  test("header navigation works on desktop and through the mobile menu", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeHidden();
      // On phones the header keeps only the logo and the menu button.
      await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeHidden();
      await expect(page.getByRole("banner").getByRole("link", { name: "Plan my trip" })).toBeHidden();
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Menu" });
      await expect(menu.getByRole("link", { name: "Log in" })).toBeVisible();
      await menu.getByRole("link", { name: "Pricing" }).click();
      await expect(menu).toBeHidden();
    } else {
      await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Pricing" }).click();
    }
    await expect(page).toHaveURL(/#pricing$/);
    await expect(page.getByTestId("tier-PLAN")).toBeInViewport();
  });

  test("footer links reach the login pages and the vets & labs page", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toContainText("does not issue official certificates");
    await footer.getByRole("link", { name: "Provider login" }).click();
    await page.waitForURL("**/provider/login");
    await page.goBack();
    await page.locator("footer").getByRole("link", { name: "For vets & labs" }).click();
    await page.waitForURL("**/for-providers");
  });

  test("a signed-in owner sees Open dashboard instead of sign-up", async ({ page, isMobile }) => {
    await login(page, "owner");
    await page.goto("/");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Menu" });
      await expect(menu.getByRole("link", { name: "Log in" })).toHaveCount(0);
      await menu.getByRole("link", { name: "Open dashboard" }).click();
    } else {
      await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toHaveCount(0);
      await page.getByRole("banner").getByRole("link", { name: "Open dashboard" }).click();
    }
    await page.waitForURL("**/app");
  });

  test("a signed-in vet sees Open portal", async ({ page }) => {
    await login(page, "vet");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Open portal" }).first()).toHaveAttribute("href", "/provider");
  });
});

test.describe("Module 2: vets & labs page", () => {
  test("explains both audiences and links to the provider login", async ({ page }, info) => {
    const errors = trackErrors(page);
    await page.goto("/for-providers");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clients who arrive prepared.");
    await expect(page.getByTestId("audience-vets")).toContainText("Veterinary practices");
    await expect(page.getByTestId("audience-labs")).toContainText("Pathology labs");
    await expect(page.getByText("appointment slots are simulated")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: info.outputPath("for-providers.png") });
    await page.locator("main").getByRole("link", { name: "Provider login" }).first().click();
    await page.waitForURL("**/provider/login");
    expect(errors).toEqual([]);
  });
});

test.describe("Module 2: not found", () => {
  test("unknown pages show a branded 404 with a way home", async ({ page }, info) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page has flown off.");
    await page.screenshot({ path: info.outputPath("not-found.png") });
    await page.getByRole("link", { name: "Back to home" }).click();
    await page.waitForURL((u) => u.pathname === "/");
  });
});

test.describe("Module 2: app icon", () => {
  test("serves the PetJet icon", async ({ request }) => {
    const res = await request.get("/icon.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});
