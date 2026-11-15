import { CheckCircle2, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LabResultForm } from "@/components/provider/provider-actions";
import { Badge } from "@/components/ui/badge";
import { requireProvider } from "@/lib/auth/session";
import { formatDate, toISODate } from "@/lib/rules/dates";
import { SPECIES_NAME } from "@/lib/trips/format";
import { LAB_TESTS } from "@/lib/vets/core";
import { getLabOrder } from "@/lib/vets/repository";

export const metadata: Metadata = { title: "Test order" };

export default async function LabOrderPage({ params }: PageProps<"/provider/lab-orders/[id]">) {
  const user = await requireProvider();
  if (user.role !== "LAB") notFound();
  const { id } = await params;
  const order = await getLabOrder(user.provider.id, id);
  if (!order) notFound();
  const t = LAB_TESTS[order.test as keyof typeof LAB_TESTS];
  const pet = order.appointment.pet;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/provider" className="hover:text-forest-800 hover:underline">
          Test orders
        </Link>{" "}
        / <span className="text-ink-900">{pet.name}</span>
      </nav>
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-tan-100 text-tan-700">
          <FlaskConical className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold sm:text-[28px]">{t?.label ?? order.test}</h1>
          <p className="tabular mt-0.5 text-sm text-ink-500">
            Ordered by {order.appointment.provider.name} · {formatDate(toISODate(order.createdAt))}
          </p>
        </div>
        <span data-testid="lab-order-status" data-status={order.status}>
          <Badge tone={order.status === "RESULTED" ? "ok" : "warn"}>{order.status === "RESULTED" ? "Resulted" : "Awaiting result"}</Badge>
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section aria-label="Sample" className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">Sample</h2>
          <dl className="mt-2 divide-y divide-line text-sm">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Animal</dt>
              <dd className="font-medium">
                {pet.name} · {SPECIES_NAME[pet.species] ?? pet.species}
                {pet.breed ? `, ${pet.breed}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Microchip</dt>
              <dd className="tabular font-medium">{pet.microchipNumber ?? "Not recorded"}</dd>
            </div>
          </dl>
        </section>
        <section aria-label="Result" className="rounded-card border border-line bg-surface p-5 shadow-card">
          {order.status === "ORDERED" ? (
            <LabResultForm id={order.id} test={order.test} />
          ) : (
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok-700" />
              <div>
                <p className="font-semibold">
                  {order.resultValue !== null ? `${order.resultValue} ${t?.unit ?? ""} · ` : ""}
                  {order.outcome === "PASS" ? "Pass" : "Below the pass mark"}
                </p>
                {order.resultNote && <p className="mt-1 text-sm text-ink-700">{order.resultNote}</p>}
                <p className="mt-2 text-[12px] text-ink-500">Sent to the vet and the owner.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
