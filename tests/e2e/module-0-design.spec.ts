import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, trackErrors } from "./helpers";

test.describe("Module 0: design system", () => {
  test("home page renders brand and illustration", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pet travel, simplified.");
    const img = page.getByAltText("A dog and a cat riding a small green plane");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });

  test("showcase renders every section without errors or overflow", async ({ page }, info) => {
    const errors = trackErrors(page);
    await page.goto("/design");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("PetJet design system");
    for (const id of [
      "colour",
      "type",
      "buttons",
      "forms",
      "status",
      "stepper",
      "bento",
      "timeline",
      "table",
      "overlays",
      "states",
      "ticket",
    ]) {
      await expect(page.locator(`section#${id}`)).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("design.png"), fullPage: true });
    expect(errors).toEqual([]);
  });

  test("tokens are applied: primary button is forest green on a cream page", async ({ page }) => {
    await page.goto("/design");
    const bg = await page
      .locator("section#buttons")
      .getByRole("button", { name: "Plan my trip" })
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(31, 64, 51)");
    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(body).toBe("rgb(250, 247, 240)");
  });

  test("stepper advances and stops at the last step", async ({ page }) => {
    await page.goto("/design");
    const section = page.locator("section#stepper");
    const current = section.locator('li[aria-current="step"]');
    await expect(current).toContainText("Travel plans");
    await section.getByRole("button", { name: "Continue" }).click();
    await expect(current).toContainText("Health & records");
    await section.getByRole("button", { name: "Continue" }).click();
    await expect(current).toContainText("Review");
    await expect(section.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("progress ring updates when a task is completed", async ({ page }) => {
    await page.goto("/design");
    const ring = page.getByRole("progressbar", { name: "Tasks completed" });
    await expect(ring).toHaveAttribute("aria-valuenow", "43");
    await page.getByRole("button", { name: "Complete a task" }).click();
    await expect(ring).toHaveAttribute("aria-valuenow", "57");
  });

  test("dialog opens, traps the page and closes with Escape", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Share this record?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Open dialog" })).toBeFocused();
  });

  test("drawer and toast work", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Open drawer" }).click();
    const drawer = page.getByRole("dialog", { name: "Rabies vaccination" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole("button", { name: "Show toast" }).click();
    await expect(page.getByRole("status")).toContainText("Appointment requested");
  });

  test("timeline and e-ticket animate in when scrolled to", async ({ page }, info) => {
    await page.goto("/design");
    const timeline = page.locator("section#timeline");
    await timeline.scrollIntoViewIfNeeded();
    const lastItem = timeline.getByRole("listitem").last();
    await expect(lastItem).toContainText("Travel date");
    await expect(lastItem).toHaveCSS("opacity", "1");
    await timeline.screenshot({ path: info.outputPath("timeline.png") });

    const ticket = page.getByRole("article", { name: /SA 0304 LHR to CDG/ });
    await ticket.scrollIntoViewIfNeeded();
    await expect(ticket).toHaveCSS("opacity", "1");
    await expect(ticket.getByText("PJ7K2Q")).toBeVisible();
    await expect(ticket.getByText("Sample ticket")).toBeVisible();
    await page.waitForTimeout(800);
    await ticket.screenshot({ path: info.outputPath("ticket.png") });
  });

  test("form error is announced and inputs are labelled", async ({ page }) => {
    await page.goto("/design");
    await expect(page.getByLabel("Microchip number")).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("Pet name").fill("Milo");
    await expect(page.getByLabel("Pet name")).toHaveValue("Milo");
    await page.getByLabel("Species").selectOption("Cat");
    await expect(page.getByLabel("Species")).toHaveValue("Cat");
  });

  for (const [slug, heading, link] of [
    ["shell-owner", "Welcome back, Mariyam.", "Documents"],
    ["shell-vet", "Appointment requests", "Requests"],
    ["shell-lab", "Test orders", "Test orders"],
  ] as const) {
    test(`${slug} shows its navigation`, async ({ page, isMobile }, info) => {
      const errors = trackErrors(page);
      await page.goto(`/design/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      if (isMobile) {
        await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeHidden();
        await page.getByRole("button", { name: "Open menu" }).click();
        const menu = page.getByRole("dialog", { name: "Menu" });
        await expect(menu.getByRole("link", { name: link })).toBeVisible();
      } else {
        await expect(
          page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: link }),
        ).toBeVisible();
      }
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: info.outputPath(`${slug}.png`) });
      expect(errors).toEqual([]);
    });
  }

  test("unknown shell preview returns 404", async ({ page }) => {
    const res = await page.goto("/design/shell-nope");
    expect(res?.status()).toBe(404);
  });
});
