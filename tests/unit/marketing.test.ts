// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TIERS, formatPrice } from "@/lib/marketing/pricing";
import { SUPPORTED_ROUTES } from "@/lib/marketing/routes";

describe("pricing tiers", () => {
  it("matches the business plan: Explore free, Travel Plan £19, Complete £39", () => {
    expect(TIERS.map((t) => [t.id, t.name, t.price])).toEqual([
      ["EXPLORE", "Explore", 0],
      ["PLAN", "Travel Plan", 19],
      ["COMPLETE", "Complete", 39],
    ]);
  });

  it("has unique ids, rising prices, one highlighted tier and features on each", () => {
    expect(new Set(TIERS.map((t) => t.id)).size).toBe(TIERS.length);
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].price).toBeGreaterThan(TIERS[i - 1].price);
    expect(TIERS.filter((t) => t.highlighted)).toHaveLength(1);
    for (const t of TIERS) expect(t.features.length).toBeGreaterThanOrEqual(3);
  });

  it("formats prices", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(19)).toBe("£19");
  });
});

describe("supported routes", () => {
  it("lists exactly the three launch routes, all from Great Britain", () => {
    expect(SUPPORTED_ROUTES.map((r) => r.id)).toEqual(["gb-fr", "gb-ie", "gb-us"]);
    for (const r of SUPPORTED_ROUTES) expect(r.from.code).toBe("GB");
  });

  it("names an authority and at least one species and requirement for each", () => {
    for (const r of SUPPORTED_ROUTES) {
      expect(r.authority.length).toBeGreaterThan(0);
      expect(r.species.length).toBeGreaterThan(0);
      expect(r.keyRequirements.length).toBeGreaterThan(0);
    }
  });

  it("does not offer ferrets to the USA", () => {
    const us = SUPPORTED_ROUTES.find((r) => r.id === "gb-us")!;
    expect(us.species).not.toContain("Ferrets");
  });
});

import { cn } from "@/lib/cn";

describe("cn", () => {
  it("lets a later class override a conflicting earlier one", () => {
    expect(cn("inline-flex", "hidden sm:inline-flex")).toBe("hidden sm:inline-flex");
    expect(cn("rounded-control", "rounded-full")).toBe("rounded-full");
    expect(cn("shadow-xs", "shadow-raised")).toBe("shadow-raised");
    expect(cn("px-4", false && "px-2", "py-2")).toBe("px-4 py-2");
  });

  it("keeps font size and text colour together", () => {
    expect(cn("text-[13px] text-ink-500")).toBe("text-[13px] text-ink-500");
    expect(cn("text-sm text-forest-800", "text-cream-50")).toBe("text-sm text-cream-50");
  });
});
