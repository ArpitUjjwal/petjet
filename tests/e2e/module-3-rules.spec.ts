import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, trackErrors } from "./helpers";

test.describe("Module 3: rules & sources page", () => {
  test("lists every route's rules from the database with sources and dates", async ({ page }, info) => {
    const errors = trackErrors(page);
    await page.goto("/rules");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every rule we use, and where it comes from.");
    await expect(page.getByText("All rules last checked 15 Nov 2026.")).toBeVisible();

    for (const [id, title] of [
      ["gb-fr", "Great Britain to France"],
      ["gb-ie", "Great Britain to Ireland"],
      ["gb-us", "Great Britain to the United States"],
      ["return", "Coming home to Great Britain"],
    ]) {
      await expect(page.locator(`section#${id}`).getByRole("heading", { level: 2 })).toHaveText(title);
    }

    const ireland = page.locator("section#gb-ie");
    const tapeworm = ireland.getByTestId("rule-IE-TAPEWORM");
    await expect(tapeworm).toContainText("no less than 24 hours and no more than 120 hours");
    await expect(tapeworm).toContainText("IE-TAPEWORM · v1 · last checked 15 Nov 2026");
    await expect(ireland.getByTestId("rule-IE-ENTRY-POINT")).toContainText("Dublin Airport, Shannon Airport, Cork Airport");

    const france = page.locator("section#gb-fr");
    await expect(france.getByTestId("rule-FR-MIN-AGE")).toContainText("16 weeks");
    await expect(france.getByTestId("rule-GB-EU-AHC")).toContainText("the issue date is day 1");

    const usa = page.locator("section#gb-us");
    const exportRule = usa.getByTestId("rule-GB-EXPORT-NON-EU");
    await expect(exportRule).toContainText("Needs review");
    await expect(usa.getByTestId("rule-US-DOG-IMPORT-FORM")).toContainText("Verified");

    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("rules.png"), fullPage: false });
    expect(errors).toEqual([]);
  });

  test("source links open the official page in a new tab", async ({ page }) => {
    await page.goto("/rules");
    const link = page
      .locator("section#gb-fr")
      .getByTestId("rule-GB-EU-RABIES")
      .getByRole("link", { name: /GOV.UK: Rabies vaccinations and boosters/ });
    await expect(link).toHaveAttribute("href", "https://www.gov.uk/taking-your-pet-abroad/rabies-vaccinations-and-boosters");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);

    const hrefs = await page.locator("main a[target=_blank]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      expect(href).toMatch(/^https:\/\/(www\.gov\.uk|assets\.gov\.ie|www\.douane\.gouv\.fr|www\.cdc\.gov)\//);
    }
  });

  test("route links jump to each section", async ({ page }) => {
    await page.goto("/rules");
    await page.getByRole("navigation", { name: "Routes" }).getByRole("link", { name: "Coming home to Great Britain" }).click();
    await expect(page).toHaveURL(/#return$/);
    await expect(page.locator("section#return").getByRole("heading", { level: 2 })).toBeInViewport();
  });

  test("is linked from the header and footer", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer").getByRole("link", { name: "Rules & sources" }).click();
    await page.waitForURL("**/rules");
  });

});
