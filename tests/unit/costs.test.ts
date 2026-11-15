import { describe, expect, it } from "vitest";
import { AGENCY_FEE, VET_PRICES, gbp, insuranceDirectPrice, summariseCosts, type CostLine } from "@/lib/trips/costs";

const line = (id: CostLine["id"], amount: number, typical: number, booked = true): CostLine => ({ id, label: id, detail: "", amount, typical, booked });

describe("trip costs and savings", () => {
  it("adds up what the customer pays, PetJet's fee included, against booking each part alone", () => {
    const c = summariseCosts(
      [line("vet", 149, 185), line("flight-out", 290, 428), line("flight-home", 569, 569), line("insurance", 34, 40, false), line("plan", 39, 0)],
      "FR",
    );
    expect(c.total).toBe(149 + 290 + 569 + 34 + 39);
    /* The plan fee is a cost, never part of the "typical" side */
    expect(c.typicalTotal).toBe(185 + 428 + 569 + 40);
    expect(c.saved).toBe(c.typicalTotal - c.total);
    expect(c.agencyTotal).toBe(c.typicalTotal + AGENCY_FEE.FR);
    expect(c.savedVsAgency).toBe(c.agencyTotal - c.total);
    expect(c.allBooked).toBe(false);
  });

  it("uses partner prices below typical ones", () => {
    for (const p of Object.values(VET_PRICES)) expect(p.petjet).toBeLessThan(p.typical);
    expect(insuranceDirectPrice(34)).toBe(40);
    expect(gbp(1222)).toBe("£1,222");
  });
});
