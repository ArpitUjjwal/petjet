import { ArrowRight, CheckCircle2, Download, ExternalLink, FileSearch, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocStatusBadge, DocTypeIcon, fileSize } from "@/components/documents/doc-meta";
import { DocumentPreview, type PreviewLine } from "@/components/documents/document-preview";
import { DeleteDocumentButton, ReviewForm } from "@/components/documents/review-form";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { DOC_TYPE_LABEL, FIELD_SPECS, isDocType } from "@/lib/documents/extract";
import { getDocument, tripsForPet } from "@/lib/documents/repository";
import { formatDate, todayISO, toISODate } from "@/lib/rules/dates";
import { routeTitle } from "@/lib/trips/plan";

export const metadata: Metadata = { title: "Document" };

function displayValue(kind: string, value: string | null) {
  if (!value) return "—";
  if (kind === "date") return formatDate(value);
  if (kind === "dose") return value === "BOOSTER" ? "Booster, no break in cover" : "First (primary) vaccination";
  return value;
}

export default async function DocumentPage({ params, searchParams }: PageProps<"/app/documents/[id]">) {
  const user = await requireOwner();
  const { id } = await params;
  const { uploaded } = await searchParams;
  const doc = await getDocument(user.id, id);
  if (!doc) notFound();
  const today = todayISO();
  const trips = await tripsForPet(user.id, doc.petId);
  const type = isDocType(doc.type) ? doc.type : "OTHER";
  const fileUrl = `/app/documents/${doc.id}/file`;
  const isImage = doc.mimeType.startsWith("image/");
  const confirmed = doc.status === "CONFIRMED";
  const applied: string[] = doc.applied ? JSON.parse(doc.applied) : [];
  /* The text layer, with each line that a detail was read from labelled with that detail */
  const previewPages: PreviewLine[][] = doc.text
    ? doc.text.split("\f").map((page, i) =>
        page
          .split("\n")
          .filter((t) => t.trim())
          .map((text) => ({
            text,
            fields: doc.fields
              .filter((f) => f.value && f.origin === "EXTRACTED" && f.evidence === text && (f.page ?? 1) === i + 1)
              .map((f) => FIELD_SPECS[type].find((s) => s.key === f.key)?.label ?? f.key),
          })),
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/app/documents" className="hover:text-forest-800 hover:underline">
          Documents
        </Link>{" "}
        / <span className="text-ink-900">{doc.fileName}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-4">
        <DocTypeIcon type={type} image={isImage} className="size-12 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold sm:text-[28px]">{type === "OTHER" ? doc.fileName : DOC_TYPE_LABEL[type]}</h1>
          <p className="tabular mt-0.5 truncate text-sm text-ink-500">
            {doc.pet.name} · {doc.fileName} · {fileSize(doc.size)} · uploaded {formatDate(toISODate(doc.createdAt))}
          </p>
        </div>
        <span data-testid="document-status" data-status={doc.status}>
          <DocStatusBadge status={doc.status} />
        </span>
      </header>

      {uploaded && !confirmed && (
        <Callout tone="info" icon={<FileSearch className="size-4.5" />} title={doc.readMode === "TEXT" ? "We've read your document" : "Your document is stored"}>
          {doc.readMode === "TEXT"
            ? "Check each detail against the original, fix anything we got wrong, then confirm. Nothing changes in your plan until you do."
            : doc.readMode === "IMAGE"
              ? "We can't read photos automatically. Choose what it is and type the key details from it."
              : "This PDF has no text we can read, which usually means it's a scan. Choose what it is and type the key details from it."}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <section aria-label="The document" className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
          <DocumentPreview fileUrl={fileUrl} fileName={doc.fileName} isImage={isImage} pages={previewPages} />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={fileUrl} target="_blank" variant="secondary" size="sm" iconLeft={<ExternalLink className="size-3.5" />}>
              Open in a new tab
            </ButtonLink>
            <ButtonLink href={`${fileUrl}?download=1`} variant="ghost" size="sm" iconLeft={<Download className="size-3.5" />}>
              Download
            </ButtonLink>
          </div>
        </section>

        <section aria-label="Details" className="flex flex-col gap-5">
          {confirmed ? (
            <>
              <Callout tone="ok" icon={<CheckCircle2 className="size-4.5" />} title={`Confirmed ${doc.confirmedAt ? formatDate(toISODate(doc.confirmedAt)) : ""}`}>
                <ul className="mt-1 flex flex-col gap-1" data-testid="applied">
                  {applied.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Callout>
              <dl className="divide-y divide-line rounded-card border border-line bg-surface">
                {FIELD_SPECS[type].map((spec) => {
                  const f = doc.fields.find((x) => x.key === spec.key);
                  return (
                    <div key={spec.key} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                      <dt className="text-ink-500">{spec.label}</dt>
                      <dd className="tabular text-right font-medium" data-testid={`value-${spec.key}`}>
                        {displayValue(spec.kind, f?.value ?? null)}
                        {f && f.origin !== "EXTRACTED" && <span className="ml-2 text-xs font-normal text-ink-400">edited</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {doc.trip ? (
                  <ButtonLink href={`/app/trips/${doc.trip.id}`} variant="secondary" iconRight={<ArrowRight className="size-4" />}>
                    See {routeTitle(doc.trip)}
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/app/pets/${doc.petId}`} variant="secondary" iconRight={<ArrowRight className="size-4" />}>
                    See {doc.pet.name}&apos;s profile
                  </ButtonLink>
                )}
                <DeleteDocumentButton id={doc.id} confirmed />
              </div>
            </>
          ) : (
            <ReviewForm
              key={`${doc.type}-${doc.updatedAt.getTime()}`}
              doc={{ id: doc.id, type: doc.type, status: doc.status, readMode: doc.readMode, typeConfidence: doc.typeConfidence, tripId: doc.tripId }}
              fields={doc.fields.map((f) => ({ key: f.key, value: f.value, raw: f.raw, confidence: f.confidence, evidence: f.evidence, page: f.page, origin: f.origin }))}
              pet={{
                id: doc.pet.id,
                name: doc.pet.name,
                species: doc.pet.species,
                microchipNumber: doc.pet.microchipNumber,
                microchipDate: doc.pet.microchipDate,
                birthYear: doc.pet.birthYear,
                birthMonth: doc.pet.birthMonth,
                birthDay: doc.pet.birthDay,
              }}
              trips={trips.map((t) => ({ id: t.id, label: `${routeTitle(t)} · ${formatDate(t.arrivalDate)}` }))}
              today={today}
            />
          )}
          <p className="flex gap-2 text-[12px] leading-relaxed text-ink-500">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            Details read by PetJet from your upload. This isn&apos;t an official check that the document is genuine.
          </p>
        </section>
      </div>
    </div>
  );
}
