/*
 * A tiny PDF writer for PetJet's sample documents. It writes real, text-based PDFs (Helvetica,
 * one page) with no dependencies, so the demo, unit tests and browser tests all use files that
 * go through exactly the same reading pipeline as an owner's upload.
 *
 * Every sample is marked as a PetJet sample in its own text: they are not real certificates.
 */

export type SampleLine = { text: string; size?: number; bold?: boolean; gap?: number };

function escapeText(s: string) {
  /* PDF string literal escaping; samples are ASCII so WinAnsi covers them */
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e]/g, "?");
}

/** Builds a one-page A4 PDF. With `textless`, draws boxes only, like a scan with no text layer. */
export function buildPdf(lines: SampleLine[], opts: { textless?: boolean; accent?: [number, number, number] } = {}) {
  const [r, g, b] = opts.accent ?? [0.12, 0.25, 0.2];
  const ops: string[] = [];
  /* Header band */
  ops.push(`${r} ${g} ${b} rg 0 792 595 50 re f`);
  if (opts.textless) {
    ops.push("0.85 0.85 0.85 rg");
    let y = 740;
    for (const l of lines) {
      ops.push(`56 ${y} ${Math.min(480, l.text.length * 6)} 10 re f`);
      y -= (l.gap ?? 0) + (l.size ?? 11) + 8;
    }
  } else {
    let y = 760;
    for (const l of lines) {
      const size = l.size ?? 11;
      y -= l.gap ?? 0;
      ops.push(`BT /${l.bold ? "F2" : "F1"} ${size} Tf 0.1 0.13 0.12 rg 56 ${y} Td (${escapeText(l.text)}) Tj ET`);
      y -= size + 8;
    }
  }
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Producer (PetJet sample generator) /Title (PetJet sample document) >>",
  ];

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/* ---------- The sample documents ---------- */

export type SamplePet = { name: string; species: "Dog" | "Cat"; breed: string; microchip: string; dob: string };

const FOOTER: SampleLine = {
  text: "PETJET SAMPLE DOCUMENT - for demonstration only. Not a real certificate.",
  size: 8,
  gap: 24,
};

/** "12/09/2026" from "2026-09-12" (UK day/month order) */
export function ukDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "11/15/2026" from "2026-11-15" (US month/day order, as on CDC receipts) */
export function usDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function petLines(p: SamplePet): SampleLine[] {
  return [
    { text: `Animal name: ${p.name}` },
    { text: `Species: ${p.species}    Breed: ${p.breed}` },
    { text: `Date of birth: ${ukDate(p.dob)}` },
    { text: `Microchip number: ${p.microchip}` },
  ];
}

export function rabiesCertificate(p: SamplePet, o: { vaccinatedOn: string; validUntil: string; booster?: boolean }) {
  return buildPdf([
    { text: "Riverside Veterinary Centre  |  London SE1 7PB", size: 9 },
    { text: "Rabies Vaccination Certificate", size: 20, bold: true, gap: 18 },
    { text: "Anti-rabies vaccination record", size: 10 },
    ...petLines(p).map((l, i) => (i === 0 ? { ...l, gap: 14 } : l)),
    { text: "Vaccine: Nobivac Rabies    Manufacturer: MSD Animal Health", gap: 14 },
    { text: "Batch number: A1234B" },
    { text: `Date of vaccination: ${ukDate(o.vaccinatedOn)}` },
    { text: `Valid until: ${ukDate(o.validUntil)}` },
    { text: `Vaccination type: ${o.booster ? "Booster (no lapse in cover)" : "Primary vaccination"}` },
    { text: "Authorised veterinarian: Dr Asha Patel MRCVS", gap: 14 },
    FOOTER,
  ]);
}

export function microchipCertificate(p: SamplePet, o: { implantedOn: string }) {
  return buildPdf([
    { text: "UK Pet Microchip Database", size: 9 },
    { text: "Certificate of Microchip Registration", size: 20, bold: true, gap: 18 },
    ...petLines(p).map((l, i) => (i === 0 ? { ...l, gap: 14 } : l)),
    { text: `Date of implantation: ${ukDate(o.implantedOn)}`, gap: 14 },
    { text: "Transponder standard: ISO 11784/11785" },
    { text: "Implanted by: Riverside Veterinary Centre" },
    FOOTER,
  ]);
}

export function animalHealthCertificate(p: SamplePet, o: { issuedOn: string; destination: string; number?: string }) {
  return buildPdf([
    { text: "Animal and Plant Health Agency  |  Official Veterinarian", size: 9 },
    { text: "Animal Health Certificate", size: 20, bold: true, gap: 18 },
    { text: "For the non-commercial movement of dogs, cats or ferrets into the EU", size: 10 },
    { text: `Certificate reference: ${o.number ?? "GB-AHC-2026-004417"}`, gap: 14 },
    { text: `Country of destination: ${o.destination}` },
    ...petLines(p),
    { text: `Date of issue: ${ukDate(o.issuedOn)}`, gap: 14 },
    { text: "Official veterinarian: Dr Asha Patel OV 7041" },
    FOOTER,
  ]);
}

export function tapewormRecord(p: SamplePet, o: { treatedOn: string; time?: string }) {
  return buildPdf([
    { text: "Riverside Veterinary Centre  |  London SE1 7PB", size: 9 },
    { text: "Tapeworm Treatment Record", size: 20, bold: true, gap: 18 },
    { text: "Echinococcus multilocularis treatment", size: 10 },
    ...petLines(p).map((l, i) => (i === 0 ? { ...l, gap: 14 } : l)),
    { text: "Product: Droncit (praziquantel 50 mg)", gap: 14 },
    { text: `Date of treatment: ${ukDate(o.treatedOn)}` },
    { text: `Time of treatment: ${o.time ?? "10:30"}` },
    { text: "Administered by: Dr Asha Patel MRCVS" },
    FOOTER,
  ]);
}

export function cdcReceipt(p: SamplePet, o: { submittedOn: string; confirmation?: string }) {
  return buildPdf(
    [
      { text: "Centers for Disease Control and Prevention", size: 9 },
      { text: "CDC Dog Import Form - Receipt", size: 20, bold: true, gap: 18 },
      { text: `Confirmation number: ${o.confirmation ?? "CDC-DIF-88412907"}`, gap: 14 },
      { text: `Submission date: ${usDate(o.submittedOn)}` },
      { text: `Dog name: ${p.name}` },
      { text: `Microchip number: ${p.microchip}` },
      { text: "This receipt is valid for 6 months from the date of submission." },
      FOOTER,
    ],
    { accent: [0.15, 0.3, 0.5] },
  );
}

/** A "scanned" document: a PDF with no text layer */
export function scannedRecord() {
  return buildPdf(
    [{ text: "x".repeat(30) }, { text: "x".repeat(60) }, { text: "x".repeat(50) }, { text: "x".repeat(70) }],
    { textless: true },
  );
}
