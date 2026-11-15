import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Uploaded files live outside public/, in storage/uploads/<ownerId>/, and are only ever
 * served through an authorised route. Stored names are random, never the owner's file name.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type FileKind = { ext: "pdf" | "jpg" | "png"; mime: string; image: boolean };

export function uploadDir() {
  /* The ignore comment stops the build tracing the whole project from this runtime path */
  /* On Vercel only /tmp is writable, so uploads go there (and vanish with the instance) */
  const fallback = process.env.VERCEL ? "/tmp/petjet-uploads" : path.join("storage", "uploads");
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR ?? fallback);
}

/** Identifies a file by its first bytes, whatever its name or claimed type says. */
export function sniff(bytes: Uint8Array): FileKind | null {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return { ext: "pdf", mime: "application/pdf", image: false };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg", image: true };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a) {
    return { ext: "png", mime: "image/png", image: true };
  }
  return null;
}

/** A display-safe file name: no paths, no control characters, a sensible length. */
export function cleanFileName(name: string, ext: string) {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (!base || base.startsWith(".")) return `document.${ext}`;
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${ext}`;
}

function resolveStored(storedName: string) {
  const dir = uploadDir();
  const full = path.resolve(/* turbopackIgnore: true */ dir, storedName);
  if (!full.startsWith(dir + path.sep)) throw new Error("Invalid stored file path.");
  return full;
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function saveUpload(ownerId: string, bytes: Uint8Array, ext: string) {
  if (!/^[a-z0-9]+$/i.test(ownerId)) throw new Error("Invalid owner id.");
  const storedName = `${ownerId}/${randomUUID()}.${ext}`;
  const full = resolveStored(storedName);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" });
  return storedName;
}

export function readUpload(storedName: string) {
  return readFile(resolveStored(storedName));
}

export async function removeUpload(storedName: string) {
  await rm(resolveStored(storedName), { force: true });
}
