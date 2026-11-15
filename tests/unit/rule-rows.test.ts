// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RULES } from "@/lib/rules/catalog";
import { latestRules, rowToRule, ruleToRow } from "@/lib/rules/rule-rows";

describe("rule database rows", () => {
  it("round-trips every catalog rule without loss", () => {
    for (const r of RULES) expect(rowToRule(ruleToRow(r))).toEqual(r);
  });

  it("uses the highest version of each rule and keeps catalog order", () => {
    const rows = RULES.map(ruleToRow);
    const v2 = { ...ruleToRow(RULES[1]), version: 2, title: "Updated title" };
    const shuffled = [v2, ...rows].reverse();
    const out = latestRules(shuffled, RULES.map((r) => r.id));
    expect(out.map((r) => r.id)).toEqual(RULES.map((r) => r.id));
    expect(out[1]).toMatchObject({ version: 2, title: "Updated title" });
    expect(out[0].version).toBe(1);
  });

  it("puts unknown codes last instead of dropping them", () => {
    const extra = { ...ruleToRow(RULES[0]), code: "ZZ-NEW", version: 1 };
    const out = latestRules([extra, ...RULES.map(ruleToRow)], RULES.map((r) => r.id));
    expect(out.at(-1)!.id).toBe("ZZ-NEW");
  });
});
