import { ArrowUpRight, BadgeCheck, CircleAlert, Plane } from "lucide-react";
import type { Metadata } from "next";
import { Reveal } from "@/components/marketing/reveal";
import { PublicShell } from "@/components/shell/public-shell";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import type { Rule } from "@/lib/rules/types";

export const metadata: Metadata = {
  title: "Rules & sources",
  description: "Every pet travel rule PetJet uses, with its official source and the date it was last checked.",
};

const GROUPS = [
  { id: "gb-fr", title: "Great Britain to France", from: "GB", to: "FR", routes: ["GB-FR"] },
  { id: "gb-ie", title: "Great Britain to Ireland", from: "GB", to: "IE", routes: ["GB-IE"] },
  { id: "gb-us", title: "Great Britain to the United States", from: "GB", to: "US", routes: ["GB-US"] },
  { id: "return", title: "Coming home to Great Britain", from: "FR · IE · US", to: "GB", routes: ["FR-GB", "IE-GB", "US-GB"] },
];

const SPECIES = { DOG: "Dogs", CAT: "Cats", FERRET: "Ferrets" } as const;

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <article
      data-testid={`rule-${rule.id}`}
      className="flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        {rule.reviewStatus === "VERIFIED" ? (
          <Badge tone="ok" icon={<BadgeCheck className="size-3.5" />}>
            Verified
          </Badge>
        ) : (
          <Badge tone="warn" icon={<CircleAlert className="size-3.5" />}>
            Needs review
          </Badge>
        )}
        {rule.species.map((s) => (
          <Badge key={s} tone="brand">
            {SPECIES[s]}
          </Badge>
        ))}
      </div>
      <h3 className="mt-4 text-base font-semibold">{rule.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-700">{rule.summary}</p>
      <div className="mt-5 border-t border-line pt-4">
        <ul className="flex flex-col gap-1.5">
          {rule.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-start gap-1 text-[13px] font-medium text-forest-800 underline-offset-4 hover:underline"
              >
                {s.name}
                <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-ink-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="tabular mt-3 font-mono text-[11px] text-ink-400">
          {rule.id} · v{rule.version} · last checked {formatDate(rule.lastVerified)}
        </p>
      </div>
    </article>
  );
}

export default async function RulesPage() {
  const { rules } = await loadRules();
  const lastChecked = rules.map((r) => r.lastVerified).sort().at(-1);

  return (
    <PublicShell>
      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 md:pt-20">
        <Reveal className="max-w-3xl">
          <p className="eyebrow text-tan-600">Rules & sources</p>
          <h1 className="display-lg mt-3 text-forest-900">Every rule we use, and where it comes from.</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-500">
            PetJet builds plans only from these requirements. Each links to the official page it
            came from, with the date we last checked it. Anything we couldn&apos;t confirm is marked
            &ldquo;Needs review&rdquo; and is only ever shown as advice.
          </p>
          {lastChecked && (
            <p className="mt-4 text-sm text-ink-500">
              All rules last checked <span className="tabular font-medium text-ink-900">{formatDate(lastChecked)}</span>.
            </p>
          )}
        </Reveal>
        <nav aria-label="Routes" className="mt-8 flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink-700 transition-colors hover:border-forest-700/40 hover:bg-sage-50"
            >
              {g.title}
            </a>
          ))}
        </nav>
      </section>

      {GROUPS.map((g) => {
        const list = rules.filter((r) => r.routes.some((route) => g.routes.includes(route)));
        return (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="scroll-mt-20 border-t border-line py-14">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tabular rounded-lg bg-forest-800 px-2.5 py-1 font-mono text-xs font-semibold text-cream-50">
                  {g.from}
                </span>
                <Plane className="size-4 text-tan-600" />
                <span className="tabular rounded-lg bg-tan-100 px-2.5 py-1 font-mono text-xs font-semibold text-tan-700">
                  {g.to}
                </span>
                <h2 id={`${g.id}-h`} className="ml-1 text-2xl font-semibold">
                  {g.title}
                </h2>
                <span className="text-sm text-ink-500">{list.length} rules</span>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {list.map((r) => (
                  <RuleCard key={r.id} rule={r} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <section className="border-t border-line bg-cream-50 py-10">
        <p className="mx-auto max-w-3xl px-4 text-center text-[13px] leading-relaxed text-ink-500 sm:px-6">
          These are summaries to help you plan. They are not legal advice and PetJet is not an
          official source. Rules can change, so always confirm with the linked page and your vet
          before you travel.
        </p>
      </section>
    </PublicShell>
  );
}
