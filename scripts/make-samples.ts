/* Writes the sample documents owners can download from the Documents page: `npm run samples`. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  animalHealthCertificate,
  cdcReceipt,
  microchipCertificate,
  rabiesCertificate,
  scannedRecord,
  tapewormRecord,
  type SamplePet,
} from "../src/lib/documents/sample-pdf";
import { SAMPLE_FILES } from "../src/lib/documents/samples";

const milo: SamplePet = { name: "Milo", species: "Cat", breed: "British Shorthair", microchip: "956000012345678", dob: "2023-03-04" };
const rex: SamplePet = { name: "Rex", species: "Dog", breed: "Labrador", microchip: "956000012345678", dob: "2021-04-30" };
const max: SamplePet = { name: "Max", species: "Cat", breed: "Maine Coon", microchip: "985112003456789", dob: "2022-07-19" };

const files: Record<(typeof SAMPLE_FILES)[number]["file"], Buffer> = {
  "rabies-vaccination-milo.pdf": rabiesCertificate(milo, { vaccinatedOn: "2026-09-12", validUntil: "2029-09-11" }),
  "microchip-certificate-milo.pdf": microchipCertificate(milo, { implantedOn: "2023-06-01" }),
  "animal-health-certificate-milo.pdf": animalHealthCertificate(milo, { issuedOn: "2026-11-12", destination: "France" }),
  "tapeworm-treatment-rex.pdf": tapewormRecord(rex, { treatedOn: "2026-11-13", time: "10:30" }),
  "cdc-receipt-rex.pdf": cdcReceipt(rex, { submittedOn: "2026-11-10" }),
  "rabies-vaccination-max-mismatch.pdf": rabiesCertificate(max, { vaccinatedOn: "2026-08-20", validUntil: "2027-08-19" }),
  "scanned-record.pdf": scannedRecord(),
};

const dir = path.join(process.cwd(), "public", "samples");
mkdirSync(dir, { recursive: true });
for (const [name, bytes] of Object.entries(files)) writeFileSync(path.join(dir, name), bytes);
console.log(`Wrote ${Object.keys(files).length} sample documents to public/samples`);
