import { ArrowRight, Download, FileText, FileUp, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocStatusBadge, DocTypeIcon, fileSize } from "@/components/documents/doc-meta";
import { PageHeader } from "@/components/shell/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { DOC_TYPE_LABEL, isDocType } from "@/lib/documents/extract";
import { listDocuments } from "@/lib/documents/repository";
import { SAMPLE_FILES } from "@/lib/documents/samples";
import { formatDate, toISODate } from "@/lib/rules/dates";
import { routeTitle } from "@/lib/trips/plan";
import { listPets } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Documents" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "review", label: "To review" },
  { id: "confirmed", label: "Confirmed" },
] as const;

export default async function DocumentsPage({ searchParams }: PageProps<"/app/documents">) {
  const user = await requireOwner();
  const { filter: f, deleted } = await searchParams;
  const filter = f === "review" || f === "confirmed" ? f : "all";
  const [docs, pets] = await Promise.all([listDocuments(user.id), listPets(user.id)]);
  const toReview = docs.filter((d) => d.status === "NEEDS_REVIEW" || d.status === "READY");
  const shown =
    filter === "review" ? toReview : filter === "confirmed" ? docs.filter((d) => d.status === "CONFIRMED") : docs;

  const upload =
    pets.length > 0 ? (
      <ButtonLink href="/app/documents/upload" iconLeft={<FileUp className="size-4" />}>
        Upload a document
      </ButtonLink>
    ) : undefined;

  return (
    <>
      <PageHeader
        title="Documents"
        description="Your pets' records in one private place. We read the key dates so you don't have to type them."
        action={upload}
      />

      {deleted && (
        <Callout tone="ok" title="Document deleted" className="mb-6">
          It&apos;s been removed from your vault.
        </Callout>
      )}

      {pets.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="Add a pet first"
          description="Documents belong to a pet, so we can check them against the right microchip and plan."
          action={<ButtonLink href="/app/pets/new">Add a pet</ButtonLink>}
        />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No documents yet"
          description="Upload a vaccination record, microchip certificate or health certificate. We'll read the dates and check them against your pet's profile."
          action={upload}
        />
      ) : (
        <>
          <nav aria-label="Filter documents" className="mb-4 flex gap-1.5">
            {FILTERS.map((x) => {
              const count = x.id === "all" ? docs.length : x.id === "review" ? toReview.length : docs.filter((d) => d.status === "CONFIRMED").length;
              const active = x.id === filter;
              return (
                <Link
                  key={x.id}
                  href={x.id === "all" ? "/app/documents" : `/app/documents?filter=${x.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    active ? "border-forest-800 bg-forest-800 text-cream-50" : "border-line-strong bg-surface text-ink-700 hover:bg-sage-50",
                  )}
                >
                  {x.label}
                  <span className={cn("tabular rounded-full px-1.5 text-[11px]", active ? "bg-forest-700" : "bg-cream-200")}>{count}</span>
                </Link>
              );
            })}
          </nav>
          {shown.length === 0 ? (
            <p className="rounded-card border border-dashed border-line-strong bg-cream-50 p-8 text-center text-sm text-ink-500">
              {filter === "review" ? "Nothing waiting for review." : "No confirmed documents yet."}
            </p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label="Your documents">
              {shown.map((d) => (
                <li key={d.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/app/documents/${d.id}`}
                    data-testid="document-row"
                    className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-cream-50 sm:px-5"
                  >
                    <DocTypeIcon type={d.type} image={d.readMode === "IMAGE"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold group-hover:text-forest-800">
                        {isDocType(d.type) && d.type !== "OTHER" ? DOC_TYPE_LABEL[d.type] : d.fileName}
                      </span>
                      <span className="tabular block truncate text-xs text-ink-500">
                        {d.pet.name}
                        {d.trip ? ` · ${routeTitle(d.trip)}` : ""} · {d.fileName} · {fileSize(d.size)} · {formatDate(toISODate(d.createdAt))}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <DocStatusBadge status={d.status} />
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <section aria-label="Sample documents" className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">Try it with a sample</h2>
          <p className="mt-1 text-sm text-ink-500">
            Download a sample, then upload it. Each one is clearly marked as a PetJet sample, not a real certificate.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {SAMPLE_FILES.map((s) => (
              <li key={s.file}>
                <a
                  href={`/samples/${s.file}`}
                  download
                  className="group flex items-center gap-3 rounded-control border border-line p-3 transition-colors hover:border-line-strong hover:bg-cream-50"
                >
                  <Download className="size-4 shrink-0 text-ink-400 group-hover:text-forest-800" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{s.title}</span>
                    <span className="block truncate text-xs text-ink-500">{s.note}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <aside className="self-start rounded-card border border-sage-200 bg-sage-100 p-5">
          <ShieldCheck className="size-5 text-forest-800" />
          <p className="mt-3 text-sm font-semibold">Read, not verified</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
            PetJet reads your documents to save you typing and to spot mistakes early. It can&apos;t tell whether a
            certificate is genuine: officials check the original when you travel, so always carry it.
          </p>
        </aside>
      </section>
    </>
  );
}
