import "server-only";

/*
 * Reads the text layer of a PDF, page by page, with pdf.js running in Node.
 * Lines are rebuilt from text item positions so labels and values stay together
 * ("Date of vaccination: 12/09/2026"), which the pattern matcher relies on.
 */

export type PdfText = { pages: string[]; pageCount: number };

type TextItem = { str: string; transform: number[]; hasEOL?: boolean };

export async function readPdfText(data: Uint8Array): Promise<PdfText> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    /* Owners' certificates are short; reading more than 10 pages is never needed */
    const count = Math.min(doc.numPages, 10);
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; s: string }[]>();
      for (const raw of content.items) {
        const item = raw as TextItem;
        if (typeof item.str !== "string" || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
        const row = rows.get(key) ?? [];
        row.push({ x: item.transform[4], s: item.str });
        rows.set(key, row);
      }
      const text = [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) =>
          row
            .sort((a, b) => a.x - b.x)
            .map((c) => c.s)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .join("\n");
      pages.push(text);
      page.cleanup();
    }
    return { pages, pageCount: doc.numPages };
  } finally {
    await task.destroy();
  }
}
