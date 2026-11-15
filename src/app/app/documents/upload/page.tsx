import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UploadForm } from "@/components/documents/upload-form";
import { PageHeader } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/auth/session";
import { isDocType } from "@/lib/documents/extract";
import { listPets } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Upload a document" };

export default async function UploadPage({ searchParams }: PageProps<"/app/documents/upload">) {
  const user = await requireOwner();
  const { pet, type } = await searchParams;
  const pets = await listPets(user.id);
  if (!pets.length) redirect("/app/documents");
  const defaultPet = typeof pet === "string" && pets.some((p) => p.id === pet) ? pet : undefined;
  const defaultType = isDocType(type) ? type : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-500">
        <Link href="/app/documents" className="hover:text-forest-800 hover:underline">
          Documents
        </Link>{" "}
        / <span className="text-ink-900">Upload</span>
      </nav>
      <PageHeader
        title="Upload a document"
        description="We'll read the key details and show you exactly where each one came from, so you can check them."
      />
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
        <UploadForm pets={pets.map((p) => ({ id: p.id, name: p.name }))} defaultPet={defaultPet} defaultType={defaultType} />
      </div>
    </div>
  );
}
