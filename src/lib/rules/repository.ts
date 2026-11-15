import "server-only";
import { db } from "@/lib/db";
import { RULES } from "./catalog";
import { latestRules } from "./rule-rows";
import type { Rule } from "./types";

/**
 * The current version of every rule, from the database. Falls back to the built-in
 * catalog (the same verified rules the database is seeded from) if the database has
 * no rules yet or can't be read, so public pages never go down over it.
 */
export async function loadRules(): Promise<{ rules: Rule[]; fromDatabase: boolean }> {
  try {
    const rows = await db.rule.findMany();
    if (rows.length === 0) return { rules: RULES, fromDatabase: false };
    return { rules: latestRules(rows, RULES.map((r) => r.id)), fromDatabase: true };
  } catch (error) {
    console.warn(
      "[rules] Could not read rules from the database; using the built-in catalog. " +
        "If you changed prisma/schema.prisma, run `npx prisma db push` and restart the dev server.",
      error instanceof Error ? error.message : error,
    );
    return { rules: RULES, fromDatabase: false };
  }
}
