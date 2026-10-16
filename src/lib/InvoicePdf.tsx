import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { Invoice, Profile } from "@/types/database";
import { calcLineCents, sumLineCents, formatCentsCurrency, euroToCents } from "@/lib/money";
import { formatDate } from "@/lib/utils";

// Kompas-huisstijl: kalm diepblauw/indigo, rustige typografie — zelfde geest
// als de webapp (zie Tailwind-config: indigo-600 primaire kleur).
const INDIGO = "#4f46e5";
const SLATE_700 = "#334155";
const SLATE_500 = "#64748b";
const SLATE_200 = "#e2e8f0";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: SLATE_700,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  brand: {
    fontSize: 20,
    fontWeight: 700,
    color: INDIGO,
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: SLATE_700,
    textAlign: "right",
  },
  invoiceMeta: {
    fontSize: 9,
    color: SLATE_500,
    textAlign: "right",
    marginTop: 4,
  },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  partyBlock: {
    width: "45%",
  },
  partyLabel: {
    fontSize: 8,
    color: SLATE_500,
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  partyName: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 9,
    color: SLATE_500,
    marginBottom: 1,
  },
  table: {
    marginTop: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: SLATE_700,
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    paddingVertical: 6,
  },
  colDescription: { width: "40%" },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colVat: { width: "12%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: SLATE_500,
    textTransform: "uppercase",
  },
  totalsBlock: {
    marginTop: 16,
    alignSelf: "flex-end",
    width: "45%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 9,
    color: SLATE_500,
  },
  totalsValue: {
    fontSize: 9,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: SLATE_700,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  paymentBlock: {
    marginTop: 40,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  paymentTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
  },
  paymentLine: {
    fontSize: 9,
    color: SLATE_500,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: SLATE_500,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: SLATE_200,
    paddingTop: 8,
  },
});

const statusLabels: Record<Invoice["status"], string> = {
  concept: "Concept",
  verzonden: "Verzonden",
  betaald: "Betaald",
  te_laat: "Te laat",
};

export function InvoicePdfDocument({
  invoice,
  profile,
}: {
  invoice: Invoice;
  profile: Profile | null;
}) {
  const lines = invoice.invoice_lines ?? [];
  const totals = sumLineCents(
    lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unit_price, vatRate: l.vat_rate }))
  );

  // Groepeer btw per tarief voor een correcte btw-specificatie (gangbare
  // NL-praktijk: aparte regel per tarief i.p.v. één totaalbedrag).
  const vatByRate = new Map<number, number>();
  for (const line of lines) {
    const { vatCents } = calcLineCents({
      quantity: line.quantity,
      unitPrice: line.unit_price,
      vatRate: line.vat_rate,
    });
    vatByRate.set(line.vat_rate, (vatByRate.get(line.vat_rate) ?? 0) + vatCents);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>Kompas</Text>
          <View>
            <Text style={styles.invoiceTitle}>Factuur {invoice.invoice_number}</Text>
            <Text style={styles.invoiceMeta}>Status: {statusLabels[invoice.status]}</Text>
            <Text style={styles.invoiceMeta}>Factuurdatum: {formatDate(invoice.issue_date)}</Text>
            {invoice.due_date && (
              <Text style={styles.invoiceMeta}>Vervaldatum: {formatDate(invoice.due_date)}</Text>
            )}
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Van</Text>
            <Text style={styles.partyName}>
              {profile?.company_name || profile?.full_name || "Jouw bedrijf"}
            </Text>
            {profile?.address && <Text style={styles.partyLine}>{profile.address}</Text>}
            {profile?.kvk_number && (
              <Text style={styles.partyLine}>KvK: {profile.kvk_number}</Text>
            )}
            {profile?.vat_number && (
              <Text style={styles.partyLine}>Btw-nr: {profile.vat_number}</Text>
            )}
            {profile?.email && <Text style={styles.partyLine}>{profile.email}</Text>}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Aan</Text>
            <Text style={styles.partyName}>
              {invoice.customers?.company_name || invoice.customers?.name || "Onbekende klant"}
            </Text>
            {invoice.customers?.company_name && invoice.customers?.name && (
              <Text style={styles.partyLine}>t.a.v. {invoice.customers.name}</Text>
            )}
            {invoice.customers?.address && (
              <Text style={styles.partyLine}>{invoice.customers.address}</Text>
            )}
            {invoice.customers?.vat_number && (
              <Text style={styles.partyLine}>Btw-nr: {invoice.customers.vat_number}</Text>
            )}
            {invoice.customers?.email && (
              <Text style={styles.partyLine}>{invoice.customers.email}</Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDescription, styles.tableHeaderText]}>Omschrijving</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Aantal</Text>
            <Text style={[styles.colPrice, styles.tableHeaderText]}>Prijs</Text>
            <Text style={[styles.colVat, styles.tableHeaderText]}>Btw</Text>
            <Text style={[styles.colTotal, styles.tableHeaderText]}>Totaal</Text>
          </View>
          {lines.map((line) => {
            const lineTotals = calcLineCents({
              quantity: line.quantity,
              unitPrice: line.unit_price,
              vatRate: line.vat_rate,
            });
            return (
              <View style={styles.tableRow} key={line.id}>
                <Text style={styles.colDescription}>{line.description}</Text>
                <Text style={styles.colQty}>{line.quantity}</Text>
                <Text style={styles.colPrice}>{formatCentsCurrency(euroToCents(line.unit_price))}</Text>
                <Text style={styles.colVat}>{line.vat_rate}%</Text>
                <Text style={styles.colTotal}>{formatCentsCurrency(lineTotals.totalCents)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotaal (excl. btw)</Text>
            <Text style={styles.totalsValue}>{formatCentsCurrency(totals.subtotalCents)}</Text>
          </View>
          {Array.from(vatByRate.entries())
            .sort(([a], [b]) => b - a)
            .map(([rate, cents]) => (
              <View style={styles.totalsRow} key={rate}>
                <Text style={styles.totalsLabel}>Btw {rate}%</Text>
                <Text style={styles.totalsValue}>{formatCentsCurrency(cents)}</Text>
              </View>
            ))}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Totaal</Text>
            <Text style={styles.grandTotalValue}>{formatCentsCurrency(totals.totalCents)}</Text>
          </View>
        </View>

        {profile?.iban && (
          <View style={styles.paymentBlock}>
            <Text style={styles.paymentTitle}>Betaalgegevens</Text>
            <Text style={styles.paymentLine}>IBAN: {profile.iban}</Text>
            <Text style={styles.paymentLine}>
              T.n.v. {profile.company_name || profile.full_name}
            </Text>
            <Text style={styles.paymentLine}>
              O.v.v. factuurnummer {invoice.invoice_number}
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          {profile?.invoice_footer || `Factuur ${invoice.invoice_number} — gegenereerd met Kompas`}
        </Text>
      </Page>
    </Document>
  );
}

/** Genereert de PDF als Blob, voor download of als e-mailbijlage. */
export async function generateInvoicePdfBlob(invoice: Invoice, profile: Profile | null): Promise<Blob> {
  return pdf(<InvoicePdfDocument invoice={invoice} profile={profile} />).toBlob();
}

/**
 * Genereert de PDF en geeft deze als base64-string terug, voor verzending
 * naar de send-invoice edge function (die geen binaire body ondersteunt via
 * supabase.functions.invoke met JSON).
 */
export async function generateInvoicePdfBase64(
  invoice: Invoice,
  profile: Profile | null
): Promise<string> {
  const blob = await generateInvoicePdfBlob(invoice, profile);
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  // In chunks om "Maximum call stack size exceeded" bij grote PDF's te voorkomen.
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Downloadt de factuur-PDF direct in de browser. */
export async function downloadInvoicePdf(invoice: Invoice, profile: Profile | null) {
  const blob = await generateInvoicePdfBlob(invoice, profile);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoice_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
