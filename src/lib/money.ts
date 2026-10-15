// Alle financiële berekeningen gebeuren in hele centen (integers) om
// drijvendekommafouten te voorkomen (0.1 + 0.2 !== 0.3 in JS floats).
// Bedragen worden pas op het laatste moment omgezet naar euro's voor weergave
// of opslag in de database (numeric(12,2), die zelf wél exact is).

/** Zet een euro-bedrag (number, mag floats bevatten) om naar hele centen. */
export function euroToCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

/** Zet hele centen om naar een euro-bedrag (number) voor opslag/weergave. */
export function centsToEuro(cents: number): number {
  return cents / 100;
}

/**
 * Berekent de totalen van één factuurregel in centen.
 * Rondt per regel af op hele centen (standaardpraktijk bij Nederlandse facturen).
 */
export function calcLineCents(input: {
  quantity: number;
  unitPrice: number; // in euro's
  vatRate: number; // percentage, bv. 21
}): { subtotalCents: number; vatCents: number; totalCents: number } {
  const quantity = Number.isFinite(input.quantity) ? input.quantity : 0;
  const unitPriceCents = euroToCents(input.unitPrice);
  const subtotalCents = Math.round(quantity * unitPriceCents);
  const vatCents = Math.round(subtotalCents * (input.vatRate / 100));
  return {
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
  };
}

/** Telt de centen-totalen van meerdere factuurregels bij elkaar op. */
export function sumLineCents(
  lines: { quantity: number; unitPrice: number; vatRate: number }[]
): { subtotalCents: number; vatCents: number; totalCents: number } {
  return lines.reduce(
    (acc, line) => {
      const { subtotalCents, vatCents, totalCents } = calcLineCents(line);
      return {
        subtotalCents: acc.subtotalCents + subtotalCents,
        vatCents: acc.vatCents + vatCents,
        totalCents: acc.totalCents + totalCents,
      };
    },
    { subtotalCents: 0, vatCents: 0, totalCents: 0 }
  );
}

/** Berekent de btw (in centen) over een los bedrag (bv. een transactie). */
export function vatCentsFor(amount: number, vatRate: number): number {
  return Math.round(euroToCents(amount) * (vatRate / 100));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatCentsCurrency(cents: number): string {
  return formatCurrency(centsToEuro(cents));
}
