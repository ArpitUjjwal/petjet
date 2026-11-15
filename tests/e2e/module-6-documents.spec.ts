import { expect, test, type Page } from "@playwright/test";
import { formatDate } from "../../src/lib/rules/dates";
import {
  animalHealthCertificate,
  rabiesCertificate,
  scannedRecord,
  type SamplePet,
} from "../../src/lib/documents/sample-pdf";
import {
  day,
  expectNoHorizontalScroll,
  planTripAs,
  shot,
  signUpNewOwner,
  trackErrors,
  uniqueEmail,
  type NewPet,
} from "./helpers";

/* Module 6: uploading, reading, reviewing and confirming documents. */

const CHIP = "956000012345678"; // the number planTripAs enters for every pet
const milo: SamplePet = { name: "Milo", species: "Cat", breed: "British Shorthair", microchip: CHIP, dob: "2023-03-31" };
const MILO_UNSURE: NewPet = { name: "Milo", species: "Cat", breed: "British Shorthair", month: "March", year: "2023", rabiesUnknown: true };
const MILO_VACCINATED: NewPet = { ...MILO_UNSURE, rabiesUnknown: false, vaccinatedDaysAgo: 60 };

async function chooseFile(page: Page, name: string, buffer: Buffer, mimeType = "application/pdf") {
  await page.getByLabel("Document file").setInputFiles({ name, mimeType, buffer });
  await expect(page.getByTestId("chosen-file")).toContainText(name);
}

async function upload(page: Page, name: string, buffer: Buffer, opts: { pet?: string } = {}) {
  await page.goto("/app/documents/upload");
  await chooseFile(page, name, buffer);
  if (opts.pet) await page.getByLabel("Which pet is it for?").selectOption({ label: opts.pet });
  await page.getByRole("button", { name: "Upload and read" }).click();
  await page.waitForURL(/\/app\/documents\/[^/]+\?uploaded=1$/, { timeout: 20_000 });
  return page.url().replace("?uploaded=1", "");
}

test.describe("Module 6: documents", () => {
  test("an owner uploads a rabies record from the checklist, checks it, and the plan updates", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Doc Owner", `m6-rabies-${info.project.name}`);
    const tripUrl = await planTripAs(page, { pet: MILO_UNSURE, to: "France", arrive: day(60), back: day(74), landing: "CDG" });

    // The plan can't treat rabies as done without a record, and offers an upload
    await page.goto(tripUrl);
    const rabies = page.getByTestId("plan-Milo").getByTestId("task-rabies");
    await expect(rabies).toHaveAttribute("data-status", "VERIFY");
    await rabies.getByRole("link", { name: "Upload the record" }).click();
    await page.waitForURL(/\/app\/documents\/upload\?pet=.+&type=RABIES/);
    await expect(page.getByLabel("What kind of document?")).toHaveValue("RABIES");
    await expect(page.getByLabel("Which pet is it for?")).toHaveValue(/.+/);

    await chooseFile(page, "rabies-milo.pdf", rabiesCertificate(milo, { vaccinatedOn: day(-40), validUntil: day(1000) }));
    await expectNoHorizontalScroll(page);
    await shot(page, info.outputPath("upload.png"));
    await page.getByRole("button", { name: "Upload and read" }).click();
    await page.waitForURL(/\/app\/documents\/[^/]+\?uploaded=1$/, { timeout: 20_000 });

    // Every detail comes with how sure we are and the line it was read from
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rabies vaccination record");
    await expect(page.getByTestId("document-status")).toHaveAttribute("data-status", "READY");
    await expect(page.getByText("We've read your document")).toBeVisible();
    const date = page.getByTestId("field-vaccinationDate");
    await expect(date.getByLabel("Date of vaccination")).toHaveValue(day(-40));
    await expect(date).toContainText("Read clearly · 95%");
    await expect(date.getByTestId("field-vaccinationDate-evidence")).toContainText("Date of vaccination:");
    await expect(page.getByTestId("text-preview").locator("[data-highlight]")).not.toHaveCount(0);
    await expect(page.getByText(`Everything was read clearly and matches Milo's profile.`)).toBeVisible();
    await expect(page.getByText("This isn't an official check that the document is genuine.", { exact: false })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, info.outputPath("review.png"));

    await page.getByRole("button", { name: "Confirm and update plan" }).click();
    await expect(page.getByTestId("document-status")).toHaveAttribute("data-status", "CONFIRMED");
    await expect(page.getByTestId("applied")).toContainText(`Milo's rabies vaccination: ${formatDate(day(-40))}`);
    await shot(page, info.outputPath("confirmed.png"));

    // The checklist now counts it, and links back to the document
    await page.goto(tripUrl);
    await expect(rabies).toHaveAttribute("data-status", "DONE");
    await expect(rabies.getByTestId("task-evidence")).toContainText("From rabies-milo.pdf");
    await shot(page, info.outputPath("checklist-evidence.png"));
    await page.goto("/app/documents");
    await expect(page.getByTestId("document-row")).toContainText("Rabies vaccination record");
    await expect(page.getByTestId("document-row")).toContainText("Confirmed by you");
    await shot(page, info.outputPath("vault.png"));
    expect(errors).toEqual([]);
  });

  test("a record for another pet is flagged, and a health certificate completes the trip step", async ({ page }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Check Owner", `m6-check-${info.project.name}`);
    const tripUrl = await planTripAs(page, { pet: MILO_VACCINATED, to: "France", arrive: day(5), back: day(19), landing: "CDG" });

    // Max's record, uploaded for Milo
    const max = { ...milo, name: "Max", microchip: "985112003456789" };
    await upload(page, "max-rabies.pdf", rabiesCertificate(max, { vaccinatedOn: day(-30), validUntil: day(300) }));
    await expect(page.getByTestId("document-status")).toHaveAttribute("data-status", "NEEDS_REVIEW");
    await expect(page.getByTestId("field-microchipNumber-check")).toContainText("Doesn't match Milo's microchip number on file (ending 5678)");
    await expect(page.getByTestId("field-petName-check")).toContainText('The document names "Max"');
    const confirm = page.getByRole("button", { name: "Confirm and update plan" });
    await expect(confirm).toBeDisabled();
    await shot(page, info.outputPath("mismatch.png"));
    const docUrl = page.url().replace("?uploaded=1", "");

    // The dashboard asks for a look
    await page.goto("/app");
    await expect(page.getByTestId("attention-documents")).toContainText("1 document to check");

    // It isn't Milo's, so it's deleted
    await page.goto(docUrl);
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: "Delete this document?" }).getByRole("button", { name: "Delete document" }).click();
    await page.waitForURL("**/app/documents?deleted=1");
    await expect(page.getByText("Document deleted")).toBeVisible();
    await expect(page.getByText("No documents yet")).toBeVisible();

    // The animal health certificate: type worked out from the text, trip filled in
    await upload(page, "ahc.pdf", animalHealthCertificate(milo, { issuedOn: day(-1), destination: "France" }));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Animal health certificate");
    await expect(page.getByLabel("Which trip is this for?")).toHaveValue(/.+/);
    await expect(page.getByLabel("Date of issue")).toHaveValue(day(-1));
    await confirm.click();
    await expect(page.getByTestId("applied")).toContainText(`Animal health certificate issued ${formatDate(day(-1))}, for Great Britain to France.`);

    await page.goto(tripUrl);
    const ahc = page.getByTestId("plan-Milo").getByTestId("task-ahc");
    await expect(ahc).toHaveAttribute("data-status", "DONE");
    await expect(ahc.getByTestId("task-evidence")).toContainText("From ahc.pdf");
    expect(errors).toEqual([]);
  });

  test("bad files are refused, and a scan's details are typed in by hand", async ({ page, browser }, info) => {
    const errors = trackErrors(page);
    await signUpNewOwner(page, "Scan Owner", `m6-scan-${info.project.name}`);
    await planTripAs(page, { pet: MILO_VACCINATED, to: "France", arrive: day(60), back: day(74), landing: "CDG" });

    await page.goto("/app/documents/upload");
    // Wrong kind of file, caught in the browser
    await page.getByLabel("Document file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.locator("#document-file-msg")).toHaveText("Upload a PDF, JPG or PNG file.");
    await expect(page.getByRole("button", { name: "Upload and read" })).toBeDisabled();
    // A text file pretending to be a PDF, caught by the server from its contents
    await chooseFile(page, "fake.pdf", Buffer.from("this is not a pdf at all"));
    await page.getByRole("button", { name: "Upload and read" }).click();
    await expect(page.locator("#document-file-msg")).toHaveText("Upload a PDF, JPG or PNG file.");
    // A damaged PDF
    await chooseFile(page, "broken.pdf", Buffer.from("%PDF-1.7\ngarbage that is not a pdf body"));
    await page.getByRole("button", { name: "Upload and read" }).click();
    await expect(page.locator("#document-file-msg")).toContainText("We couldn't open this PDF");
    await shot(page, info.outputPath("bad-file.png"));

    // A scan with no text: the owner picks the type and types the details
    const docUrl = await upload(page, "scan.pdf", scannedRecord());
    await expect(page.getByTestId("document-status")).toHaveAttribute("data-status", "NEEDS_REVIEW");
    await expect(page.getByText("This PDF has no text we can read")).toBeVisible();
    await page.getByLabel("Document type").selectOption("MICROCHIP");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Microchip certificate");
    const chip = page.getByLabel("Microchip number");
    await expect(chip).toHaveValue("");
    await chip.fill("956 000 012 345 678");
    await page.getByLabel(/Date implanted/).fill("2023-06-01");
    await page.getByText(/I've checked the/).click();
    await page.getByRole("button", { name: "Confirm and update plan" }).click();
    await expect(page.getByTestId("document-status")).toHaveAttribute("data-status", "CONFIRMED");
    await expect(page.getByTestId("value-microchipNumber")).toContainText(CHIP);
    await expect(page.getByTestId("applied")).toContainText(`Milo's microchip: ${CHIP}, implanted 1 Jun 2023.`);

    // Another owner can't see the document or its file
    const other = await browser.newContext();
    const page2 = await other.newPage();
    await signUpNewOwner(page2, "Nosy Owner", `m6-nosy-${info.project.name}`);
    expect((await page2.goto(docUrl))?.status()).toBe(404);
    expect((await page2.goto(`${docUrl}/file`))?.status()).toBe(404);
    // Nor can someone signed out
    const anon = await browser.newContext();
    const res = await anon.request.get(`${new URL(docUrl).origin}${new URL(docUrl).pathname}/file`, { maxRedirects: 0 });
    expect([302, 303, 307, 308, 404]).toContain(res.status());
    await other.close();
    await anon.close();
    void uniqueEmail;
    expect(errors).toEqual([]);
  });
});
