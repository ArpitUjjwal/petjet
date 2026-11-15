import type { PrismaClient } from "@prisma/client";
import { RULES } from "../src/lib/rules/catalog";
import { ruleToRow } from "../src/lib/rules/rule-rows";

/**
 * Writes the rules catalog to the database. A rule whose content changed without a
 * version bump is an error, so every change leaves a new, auditable version.
 */
export async function seedRules(prisma: PrismaClient) {
  let created = 0;
  for (const r of RULES) {
    const { code, version, ...data } = ruleToRow(r);
    const existing = await prisma.rule.findUnique({ where: { code_version: { code, version } } });
    if (!existing) {
      await prisma.rule.create({ data: { code, version, ...data } });
      created++;
      continue;
    }
    const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) => existing[k] !== data[k]);
    if (changed) {
      throw new Error(
        `Rule ${code} v${version} changed without a version bump. Increase its version in src/lib/rules/catalog.ts.`,
      );
    }
  }
  return { created, total: RULES.length };
}
