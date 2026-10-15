import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Geld- en btw-berekeningen staan in src/lib/money.ts (centen-gebaseerd,
// om drijvendekommafouten te voorkomen). formatCurrency wordt vanuit daar
// geëxporteerd en hier doorverwezen voor bestaande imports.
export { formatCurrency } from "./money";

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function currentQuarter(date = new Date()): { quarter: number; year: number } {
  return { quarter: Math.floor(date.getMonth() / 3) + 1, year: date.getFullYear() };
}

/**
 * Zet een lokale datum om naar een "YYYY-MM-DD" string zónder via UTC te
 * gaan. `Date#toISOString()` converteert eerst naar UTC, wat voor gebruikers
 * in een tijdzone vóór UTC (zoals Europe/Amsterdam, UTC+1/+2) een dag kan
 * terugschuiven — bijvoorbeeld 1 januari 00:00 lokale tijd wordt
 * 31 december in UTC. Voor datums (zonder tijdscomponent) willen we altijd
 * de lokale kalenderdag.
 */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function quarterRange(quarter: number, year: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start: toLocalDateString(start), end: toLocalDateString(end) };
}

/** Vandaag als "YYYY-MM-DD" in de lokale tijdzone van de gebruiker. */
export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}

/** Eerste dag van de huidige kalendermaand als "YYYY-MM-DD", lokale tijdzone. */
export function monthStartLocalDateString(): string {
  const now = new Date();
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
}
