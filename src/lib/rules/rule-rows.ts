import type { ReviewStatus, Rule, RuleSource, Species } from "./types";

/** Shape of a Rule row in the database: list and object fields are stored as JSON text. */
export type RuleRow = {
  code: string;
  version: number;
  routes: string;
  species: string;
  title: string;
  summary: string;
  sources: string;
  lastVerified: string;
  reviewStatus: string;
  params: string;
};

export function ruleToRow(r: Rule): RuleRow {
  return {
    code: r.id,
    version: r.version,
    routes: JSON.stringify(r.routes),
    species: JSON.stringify(r.species),
    title: r.title,
    summary: r.summary,
    sources: JSON.stringify(r.sources),
    lastVerified: r.lastVerified,
    reviewStatus: r.reviewStatus,
    params: JSON.stringify(r.params),
  };
}

export function rowToRule(row: RuleRow): Rule {
  return {
    id: row.code,
    version: row.version,
    routes: JSON.parse(row.routes) as string[],
    species: JSON.parse(row.species) as Species[],
    title: row.title,
    summary: row.summary,
    sources: JSON.parse(row.sources) as RuleSource[],
    lastVerified: row.lastVerified,
    reviewStatus: row.reviewStatus as ReviewStatus,
    params: JSON.parse(row.params) as Record<string, unknown>,
  };
}

/** Picks the highest version of each rule code and returns them in the given code order. */
export function latestRules(rows: RuleRow[], order: string[]): Rule[] {
  const latest = new Map<string, RuleRow>();
  for (const row of rows) {
    const seen = latest.get(row.code);
    if (!seen || row.version > seen.version) latest.set(row.code, row);
  }
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...latest.values()]
    .map(rowToRule)
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.id.localeCompare(b.id));
}
