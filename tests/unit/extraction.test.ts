// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  checkFields,
  classify,
  dateOrder,
  extractFields,
  parseChip,
  parseDate,
  reviewState,
  type DocType,
  type ExtractedField,
  type PetProfile,
} from "@/lib/documents/extract";
import { readPdfText } from "@/lib/documents/pdf-text";
import {
  animalHealthCertificate,
  cdcReceipt,
  microchipCertificate,
  rabiesCertificate,
  scannedRecord,
  tapewormRecord,
  type SamplePet,
} from "@/lib/documents/sample-pdf";

const TODAY = "2026-11-15";
const MILO: SamplePet = { name: "Milo", species: "Cat", breed: "British Shorthair", microchip: "956000012345678", dob: "2023-03-04" };
const profile: PetProfile = {
  name: "Milo",
  species: "CAT",
  microchipNumber: "956000012345678",
  microchipDate: "2023-06-01",
  birthYear: 2023,
  birthMonth: 3,
  birthDay: 4,
};

async function read(pdf: Buffer, type?: DocType) {
  const { pages } = await readPdfText(pdf);
  const c = classify(pages);
  const fields = extractFields(type ?? c.type, pages);
  return { pages, c, fields, get: (k: string) => fields.find((f) => f.key === k) as ExtractedField };
}

describe("reading the sample PDFs", () => {
  it("reads a rabies vaccination certificate with evidence for every field", async () => {
    const r = await read(rabiesCertificate(MILO, { vaccinatedOn: "2026-09-12", validUntil: "2029-09-11" }));
    expect(r.c.type).toBe("RABIES");
    expect(r.c.confidence).toBeGreaterThanOrEqual(0.8);
    expect(r.get("vaccinationDate")).toMatchObject({ value: "2026-09-12", raw: "12/09/2026", confidence: 0.95, page: 1 });
    expect(r.get("vaccinationDate").evidence).toBe("Date of vaccination: 12/09/2026");
    expect(r.get("validUntil").value).toBe("2029-09-11");
    expect(r.get("doseKind").value).toBe("PRIMARY");
    expect(r.get("vaccine").value).toBe("Nobivac Rabies");
    expect(r.get("microchipNumber").value).toBe("956000012345678");
    expect(r.get("petName").value).toBe("Milo");
    expect(r.get("species").value).toBe("Cat");
    const issues = checkFields("RABIES", r.fields, profile, TODAY, { typeConfidence: r.c.confidence });
    expect(issues).toEqual([]);
    expect(reviewState("RABIES", issues)).toBe("READY");
  });

  it("recognises a booster", async () => {
    const r = await read(rabiesCertificate(MILO, { vaccinatedOn: "2026-09-12", validUntil: "2029-09-11", booster: true }));
    expect(r.get("doseKind").value).toBe("BOOSTER");
  });

  it("reads a microchip certificate", async () => {
    const r = await read(microchipCertificate(MILO, { implantedOn: "2023-06-01" }));
    expect(r.c.type).toBe("MICROCHIP");
    expect(r.get("microchipNumber").value).toBe("956000012345678");
    expect(r.get("implantDate").value).toBe("2023-06-01");
    expect(r.get("dateOfBirth").value).toBe("2023-03-04");
    expect(checkFields("MICROCHIP", r.fields, profile, TODAY)).toEqual([]);
  });

  it("reads an animal health certificate", async () => {
    const r = await read(animalHealthCertificate(MILO, { issuedOn: "2026-11-10", destination: "France" }));
    expect(r.c.type).toBe("AHC");
    expect(r.get("issuedOn").value).toBe("2026-11-10");
    expect(r.get("destination").value).toBe("France");
    expect(r.get("certificateNumber").value).toBe("GB-AHC-2026-004417");
  });

  it("reads a tapeworm treatment record, including the time", async () => {
    const r = await read(tapewormRecord(MILO, { treatedOn: "2026-11-13", time: "14:45" }));
    expect(r.c.type).toBe("TAPEWORM");
    expect(r.get("treatedOn").value).toBe("2026-11-13");
    expect(r.get("treatedAt").value).toBe("14:45");
    expect(r.get("product").value).toBe("Droncit (praziquantel 50 mg)");
  });

  it("reads US month-first dates on a CDC receipt", async () => {
    const r = await read(cdcReceipt({ ...MILO, species: "Dog" }, { submittedOn: "2026-11-03" }));
    expect(r.c.type).toBe("CDC_RECEIPT");
    expect(r.get("submittedOn")).toMatchObject({ value: "2026-11-03", raw: "11/03/2026" });
    expect(r.get("confirmationNumber").value).toBe("CDC-DIF-88412907");
  });

  it("finds no text in a scanned PDF and asks for the details to be typed in", async () => {
    const r = await read(scannedRecord());
    expect(r.pages.join("").trim()).toBe("");
    expect(r.c.type).toBe("OTHER");
    const fields = extractFields("RABIES", r.pages);
    expect(fields.every((f) => f.value === null)).toBe(true);
    const issues = checkFields("RABIES", fields, profile, TODAY, { readable: false });
    expect(issues[0]).toMatchObject({ key: "vaccinationDate", level: "block" });
    expect(issues.some((i) => i.key === "type" && /couldn't read any text/.test(i.message))).toBe(true);
  });

  it("rejects a file that isn't a PDF", async () => {
    await expect(readPdfText(new TextEncoder().encode("this is not a pdf"))).rejects.toThrow();
  });
});

describe("mismatches with the pet's profile", () => {
  it("flags another pet's microchip number and name", async () => {
    const other = { ...MILO, name: "Max", microchip: "985112003456789" };
    const r = await read(rabiesCertificate(other, { vaccinatedOn: "2026-09-12", validUntil: "2029-09-11" }));
    const issues = checkFields("RABIES", r.fields, profile, TODAY, { typeConfidence: r.c.confidence });
    expect(issues.find((i) => i.key === "microchipNumber")?.message).toMatch(/Doesn't match Milo's microchip number on file \(ending 5678\)/);
    expect(issues.find((i) => i.key === "petName")?.message).toBe('The document names "Max", but this upload is for Milo.');
    expect(issues.every((i) => i.level === "check")).toBe(true);
    expect(reviewState("RABIES", issues)).toBe("NEEDS_REVIEW");
  });

  it("flags the wrong species and date of birth", async () => {
    const r = await read(microchipCertificate({ ...MILO, species: "Dog", dob: "2021-01-01" }, { implantedOn: "2023-06-01" }));
    const issues = checkFields("MICROCHIP", r.fields, profile, TODAY);
    expect(issues.map((i) => i.key)).toEqual(expect.arrayContaining(["species", "dateOfBirth"]));
  });

  it("flags a vaccination before the microchip, an expired one, and impossible dates", () => {
    const f = (vaccinationDate: string | null, validUntil: string | null) => [
      { key: "vaccinationDate" as const, value: vaccinationDate, confidence: 1 },
      { key: "validUntil" as const, value: validUntil, confidence: 1 },
    ];
    expect(checkFields("RABIES", f("2023-05-01", "2026-12-01"), profile, TODAY)[0].message).toMatch(/before the microchip/);
    expect(checkFields("RABIES", f("2023-07-01", "2026-07-01"), profile, TODAY)[0].message).toMatch(/expired/);
    expect(checkFields("RABIES", f("2026-12-01", "2029-12-01"), profile, TODAY)[0]).toMatchObject({ level: "block", message: expect.stringMatching(/future/) });
    expect(checkFields("RABIES", f("2026-09-01", "2026-08-01"), profile, TODAY)[0]).toMatchObject({ level: "block", key: "validUntil" });
    expect(checkFields("RABIES", f(null, null), profile, TODAY)[0]).toMatchObject({ level: "block", key: "vaccinationDate" });
  });

  it("leaves other documents alone", () => {
    expect(checkFields("OTHER", [], profile, TODAY)).toEqual([]);
    expect(reviewState("OTHER", [])).toBe("STORED");
  });
});

describe("value parsing", () => {
  it("reads dates in the common formats, knowing when day and month could swap", () => {
    expect(parseDate("on 12/09/2026")).toEqual({ iso: "2026-09-12", raw: "12/09/2026", ambiguous: true });
    expect(parseDate("25.12.2026")).toMatchObject({ iso: "2026-12-25", ambiguous: false });
    expect(parseDate("12/25/2026")).toMatchObject({ iso: "2026-12-25", ambiguous: false });
    expect(parseDate("2026-09-12")).toMatchObject({ iso: "2026-09-12", ambiguous: false });
    expect(parseDate("3rd March 2027")?.iso).toBe("2027-03-03");
    expect(parseDate("Sept 4, 2026")?.iso).toBe("2026-09-04");
    expect(parseDate("11/03/2026", "MDY")?.iso).toBe("2026-11-03");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("no date here")).toBeNull();
  });

  it("reads microchip numbers with or without spaces", () => {
    expect(parseChip("956 000 012 345 678")).toMatchObject({ value: "956000012345678", standard: true });
    expect(parseChip("Chip: 985112003456789.")).toMatchObject({ value: "985112003456789", standard: true });
    expect(parseChip("old chip 0A1B2C3D4E")).toMatchObject({ value: "0A1B2C3D4E", standard: false });
    expect(parseChip("phone 0207 946 0000")).toBeNull();
  });

  it("follows the document's own date order", () => {
    expect(dateOrder("RABIES", ["Date of vaccination: 05/06/2026"])).toEqual({ order: "DMY", sure: true });
    expect(dateOrder("CDC_RECEIPT", ["Submission date: 05/06/2026"])).toEqual({ order: "MDY", sure: true });
    // A date that only works month-first turns the whole document month-first
    const us = extractFields("RABIES", ["Rabies vaccination\nDate of vaccination: 05/06/2026\nValid until: 05/30/2029"]);
    expect(us.find((f) => f.key === "vaccinationDate")).toMatchObject({ value: "2026-05-06", confidence: 0.95 });
  });

  it("a date that could be read two ways gets a lower confidence and asks for a check", () => {
    const fields = extractFields("RABIES", [
      "Rabies vaccination certificate\nDate of vaccination: 05/06/2026\nValid until: 25/05/2029\nNext due: 05/25/2029",
    ]);
    const d = fields.find((f) => f.key === "vaccinationDate")!;
    expect(d).toMatchObject({ value: "2026-06-05", confidence: 0.7 });
    expect(checkFields("RABIES", fields, { ...profile, microchipNumber: null }, TODAY).find((i) => i.key === "vaccinationDate")?.message).toMatch(/two ways/);
  });

  it("never invents a value it can't find", () => {
    const fields = extractFields("AHC", ["Animal Health Certificate\nSome other text"]);
    expect(fields.every((f) => f.value === null && f.confidence === 0 && f.evidence === null)).toBe(true);
  });

  it("calls an unknown document 'other'", () => {
    expect(classify(["Invoice\nConsultation fee £45"])).toMatchObject({ type: "OTHER", confidence: 0 });
  });
});
