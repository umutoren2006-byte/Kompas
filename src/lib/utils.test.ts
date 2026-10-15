import { describe, it, expect } from "vitest";
import { currentQuarter, quarterRange } from "./utils";

describe("currentQuarter", () => {
  it("bepaalt het juiste kwartaal per maand", () => {
    expect(currentQuarter(new Date(2026, 0, 15)).quarter).toBe(1); // jan
    expect(currentQuarter(new Date(2026, 2, 31)).quarter).toBe(1); // mrt
    expect(currentQuarter(new Date(2026, 3, 1)).quarter).toBe(2); // apr
    expect(currentQuarter(new Date(2026, 5, 30)).quarter).toBe(2); // jun
    expect(currentQuarter(new Date(2026, 6, 1)).quarter).toBe(3); // jul
    expect(currentQuarter(new Date(2026, 8, 30)).quarter).toBe(3); // sep
    expect(currentQuarter(new Date(2026, 9, 1)).quarter).toBe(4); // okt
    expect(currentQuarter(new Date(2026, 11, 31)).quarter).toBe(4); // dec
  });

  it("geeft het juiste jaar terug", () => {
    expect(currentQuarter(new Date(2026, 5, 1)).year).toBe(2026);
  });
});

describe("quarterRange", () => {
  it("berekent de juiste start- en einddatum per kwartaal", () => {
    expect(quarterRange(1, 2026)).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(quarterRange(2, 2026)).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    expect(quarterRange(3, 2026)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(quarterRange(4, 2026)).toEqual({ start: "2026-10-01", end: "2026-12-31" });
  });

  it("houdt rekening met schrikkeljaren", () => {
    // 2028 is een schrikkeljaar: Q1 eindigt op 29 februari
    expect(quarterRange(1, 2028)).toEqual({ start: "2028-01-01", end: "2028-03-31" });
  });
});
