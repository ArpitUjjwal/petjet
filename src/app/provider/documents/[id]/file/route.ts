import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/documents/storage";
import { canProviderOpenDocument } from "@/lib/vets/repository";

/*
 * A vet opens a document only if the owner shared it for one of that vet's appointments.
 * Everything else gets the same 404, so document ids can't be probed.
 */
export async function GET(_request: Request, ctx: RouteContext<"/provider/documents/[id]/file">) {
  const { id } = await ctx.params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const user = await getCurrentUser();
  if (!user?.provider || user.role !== "VET") return notFound();
  if (!(await canProviderOpenDocument(user.provider.id, id))) return notFound();

  const doc = await db.document.findUnique({ where: { id }, select: { storedName: true, mimeType: true, fileName: true } });
  if (!doc) return notFound();
  let bytes: Buffer;
  try {
    bytes = await readUpload(doc.storedName);
  } catch {
    return notFound();
  }
  const asciiName = doc.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      ...(doc.mimeType.startsWith("image/") ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
    },
  });
}
