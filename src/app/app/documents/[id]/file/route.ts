import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/documents/storage";

/*
 * Serves an uploaded file to its owner only. Anyone else gets the same 404 as a missing file,
 * so document ids can't be probed. Files are never cached publicly or sniffed as another type.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/documents/[id]/file">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!user || user.role !== "OWNER") return notFound();

  const doc = await db.document.findFirst({
    where: { id, ownerId: user.id },
    select: { storedName: true, mimeType: true, fileName: true },
  });
  if (!doc) return notFound();

  let bytes: Buffer;
  try {
    bytes = await readUpload(doc.storedName);
  } catch {
    return notFound();
  }
  const download = request.nextUrl.searchParams.get("download") === "1";
  const asciiName = doc.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      /* Images get a locked-down policy; PDFs need the browser's own viewer, which sandboxing blocks */
      ...(doc.mimeType.startsWith("image/") ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
