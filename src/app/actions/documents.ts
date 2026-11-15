"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import {
  changeDocumentType,
  confirmDocument,
  deleteDocument,
  uploadDocument,
  type DocResult,
} from "@/lib/documents/repository";
import { todayISO } from "@/lib/rules/dates";

export type UploadState = { errors?: Record<string, string>; message?: string } | null;

export async function uploadDocumentAction(_prev: UploadState, form: FormData): Promise<UploadState> {
  const user = await requireOwner();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Choose a file to upload." } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = String(form.get("type") ?? "AUTO");
  const result = await uploadDocument(
    user.id,
    { petId: String(form.get("petId") ?? ""), type: type === "AUTO" ? undefined : type, file: { name: file.name, bytes } },
    todayISO(),
  );
  if (!result.ok) return { errors: result.errors, message: result.message };
  revalidatePath("/app", "layout");
  redirect(`/app/documents/${result.documentId}?uploaded=1`);
}

export async function changeDocumentTypeAction(id: string, type: string): Promise<DocResult> {
  const user = await requireOwner();
  const result = await changeDocumentType(user.id, id, type, todayISO());
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}

export async function confirmDocumentAction(
  id: string,
  input: { fields: Record<string, string>; tripId?: string | null; acknowledged?: boolean },
): Promise<DocResult<{ applied: string[] }>> {
  const user = await requireOwner();
  const result = await confirmDocument(user.id, id, input, todayISO());
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}

export async function deleteDocumentAction(id: string) {
  const user = await requireOwner();
  const result = await deleteDocument(user.id, id);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect("/app/documents?deleted=1");
}
