import { describe, it, expect } from "vitest";
import {
  euroToCents,
  centsToEuro,
  calcLineCents,
  sumLineCents,
  vatCentsFor,
  formatCentsCurrency,
} from "./money";

describe("euroToCents / centsToEuro", () => {
  it("rondt correct af, inclusief klassieke float-valkuilen", () => {
    expect(euroToCents(0.1)).toBe(10);
    expect(euroToCents(0.2)).toBe(20);
    // 0.1 + 0.2 === 0.30000000000000004 in gewone JS floats — dit mag niet
    // doorsijpelen naar het eindresultaat.
    expect(euroToCents(0.1) + euroToCents(0.2)).toBe(30);
    expect(euroToCents(19.99)).toBe(1999);
    expect(euroToCents(1234.5)).toBe(123450);
  });

  it("is de inverse van centsToEuro", () => {
    expect(centsToEuro(euroToCents(42.37))).toBeCloseTo(42.37, 10);
  });
});

describe("calcLineCents", () => {
  it("berekent subtotaal, btw en totaal in centen", () => {
    const result = calcLineCents({ quantity: 2, unitPrice: 50, vatRate: 21 });
    expect(result.subtotalCents).toBe(10000); // 2 x €50 = €100
    expect(result.vatCents).toBe(2100); // 21% van €100 = €21
    expect(result.totalCents).toBe(12100);
  });

  it("rondt btw per regel af op hele centen", () => {
    // 1 x €10,555 → subtotal 1055.5 cent → rondt naar 1056, btw op 1056 = 221.76 → 222
    const result = calcLineCents({ quantity: 1, unitPrice: 10.555, vatRate: 21 });
    expect(Number.isInteger(result.subtotalCents)).toBe(true);
    expect(Number.isInteger(result.vatCents)).toBe(true);
    expect(Number.isInteger(result.totalCents)).toBe(true);
  });

  it("werkt met 0% btw", () => {
    const result = calcLineCents({ quantity: 3, unitPrice: 10, vatRate: 0 });
    expect(result.subtotalCents).toBe(3000);
    expect(result.vatCents).toBe(0);
    expect(result.totalCents).toBe(3000);
  });

  it("werkt met fractionele aantallen (bv. uren)", () => {
    const result = calcLineCents({ quantity: 2.5, unitPrice: 40, vatRate: 21 });
    expect(result.subtotalCents).toBe(10000); // 2.5 x €40 = €100
  });
});

describe("sumLineCents", () => {
  it("telt meerdere regels correct op, geen cumulatieve afrondfouten", () => {
    const lines = Array.from({ length: 10 }, () => ({
      quantity: 1,
      unitPrice: 10.1, // notoir lastig bedrag in floats
      vatRate: 21,
    }));
    const { subtotalCents } = sumLineCents(lines);
    // 10 x €10,10 = €101,00 = 10100 cent, exact
    expect(subtotalCents).toBe(10100);
  });

  it("geeft nul terug voor een lege lijst", () => {
    expect(sumLineCents([])).toEqual({ subtotalCents: 0, vatCents: 0, totalCents: 0 });
  });
});

describe("vatCentsFor", () => {
  it("berekent btw over een los bedrag", () => {
    expect(vatCentsFor(100, 21)).toBe(2100);
    expect(vatCentsFor(100, 9)).toBe(900);
    expect(vatCentsFor(100, 0)).toBe(0);
  });
});

describe("formatCentsCurrency", () => {
  it("formatteert centen als euro-bedrag in nl-NL notatie", () => {
    const formatted = formatCentsCurrency(123456);
    expect(formatted).toContain("1.234,56");
  });
});
