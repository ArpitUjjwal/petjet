import { expect, test } from "@playwright/test";
import { rabiesCertificate } from "../../src/lib/documents/sample-pdf";
import { day, login, planTripAs, shot, signUpNewOwner, trackErrors, type NewPet } from "./helpers";

/* Batch A: owner books a vet from the checklist, the vet issues the certificate, the lab posts a result. */


test("owner → vet → lab: a booked vet issues the certificate and a lab result reaches the owner", async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  const owner = `Vet Flow ${info.project.name}`;
  /* Desktop and mobile run at the same time against the same vet and lab, so each has its own pet */
  const name = info.project.name === "mobile" ? "Mika" : "Milo";
  const MILO: NewPet = { name, species: "Cat", breed: "British Shorthair", month: "March", year: "2023", vaccinatedDaysAgo: 60 };
  await signUpNewOwner(page, owner, `ba-${info.project.name}`);
  const tripUrl = await planTripAs(page, { pet: MILO, to: "France", arrive: day(8), back: day(22), landing: "CDG" });

  // A confirmed record to share with the vet
  await page.goto("/app/documents/upload");
  await page.getByLabel("Document file").setInputFiles({
    name: "milo-rabies.pdf",
    mimeType: "application/pdf",
    buffer: rabiesCertificate(
      { name, species: "Cat", breed: "British Shorthair", microchip: "956000012345678", dob: "2023-03-31" },
      { vaccinatedOn: day(-60), validUntil: day(300) },
    ),
  });
  await page.getByRole("button", { name: "Upload and read" }).click();
  await page.getByRole("button", { name: "Confirm and update plan" }).click();
  await expect(page.getByTestId("document-status")).toHaveAttribute("data-status", "CONFIRMED");

  // From the checklist step to a matching official vet
  await page.goto(tripUrl);
  const ahc = page.getByTestId(`plan-${name}`).getByTestId("task-ahc");
  await ahc.getByRole("link", { name: "Find a vet" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find a vet: Animal health certificate");
  await expect(page.getByTestId("vet-card")).not.toContainText(["Camden Animal Clinic"]);
  const riverside = page.getByTestId("vet-card").filter({ hasText: "Riverside Veterinary Centre" });
  await expect(riverside).toContainText("Official vet");
  await shot(page, info.outputPath("vets.png"));
  await riverside.getByRole("button", { name: "Choose a time" }).click();
  const dialog = page.getByRole("dialog", { name: "Book Riverside Veterinary Centre" });
  await dialog.getByRole("radio").first().click();
  await expect(dialog.getByRole("checkbox", { name: /Rabies vaccination record/ })).toBeChecked();
  await dialog.getByText("Share 1 document with Riverside Veterinary Centre").click();
  await shot(page, info.outputPath("booking.png"), false);
  await dialog.getByRole("button", { name: "Request appointment" }).click();
  await page.waitForURL(/\/app\/vets\?requested=/);
  await expect(page.getByText("Request sent to Riverside Veterinary Centre")).toBeVisible();
  await expect(page.getByTestId("owner-appointment").first()).toHaveAttribute("data-status", "REQUESTED");
  await page.goto(tripUrl);
  await expect(ahc.getByTestId("task-appointment")).toContainText("Requested · Riverside Veterinary Centre");

  // The vet accepts, opens the shared record, issues the certificate and orders a titre test
  const vetCtx = await browser.newContext({ ...(info.project.use ?? {}) });
  const vet = await vetCtx.newPage();
  await login(vet, "vet");
  await vet.getByTestId("request-row").filter({ hasText: owner }).first().click();
  await expect(vet.getByRole("heading", { level: 1 })).toHaveText(`Animal health certificate for ${name}`);
  const shared = vet.getByTestId("shared-document");
  await expect(shared).toContainText("milo-rabies.pdf");
  const file = await vet.request.get(new URL((await shared.getAttribute("href"))!, vet.url()).toString());
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("application/pdf");
  await shot(vet, info.outputPath("vet-request.png"));
  await vet.getByRole("button", { name: "Accept" }).click();
  await expect(vet.getByTestId("appointment-status")).toHaveAttribute("data-status", "ACCEPTED");
  await vet.getByRole("button", { name: "Issue demo certificate" }).click();
  await expect(vet.getByTestId("appointment-status")).toHaveAttribute("data-status", "COMPLETED");
  await vet.getByRole("button", { name: "Order test" }).click();
  await expect(vet.getByTestId("vet-lab-order")).toContainText("With Northgate Pathology Laboratory");
  await shot(vet, info.outputPath("vet-done.png"));

  // The lab posts the result
  const labCtx = await browser.newContext({ ...(info.project.use ?? {}) });
  const lab = await labCtx.newPage();
  await login(lab, "lab");
  await lab.getByTestId("lab-order-row").filter({ hasText: name }).filter({ hasText: "Awaiting result" }).first().click();
  await lab.getByLabel("Titre result").fill("2.4");
  await shot(lab, info.outputPath("lab-order.png"));
  await lab.getByRole("button", { name: "Post result" }).click();
  await expect(lab.getByTestId("lab-order-status")).toHaveAttribute("data-status", "RESULTED");

  // Back to the owner: the step is done by the vet, and the result is there
  await page.goto(tripUrl);
  await expect(ahc).toHaveAttribute("data-status", "DONE");
  await expect(ahc.getByTestId("task-recorded-by")).toContainText("Recorded by Riverside Veterinary Centre");
  await expect(page.getByTestId("trip-lab-result")).toContainText("2.4 IU/mL · Pass");
  await shot(page, info.outputPath("owner-result.png"));
  await page.goto("/app/vets");
  await expect(page.getByTestId("owner-appointment").first()).toHaveAttribute("data-status", "COMPLETED");
  await expect(page.getByTestId("lab-result")).toContainText("Sample result");

  await vetCtx.close();
  await labCtx.close();
  expect(errors).toEqual([]);
});
