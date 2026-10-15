import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Customer, Invoice, InvoiceLine, InvoiceStatus } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatDate, todayLocalDateString } from "@/lib/utils";
import { sumLineCents, formatCentsCurrency } from "@/lib/money";

const statusLabels: Record<InvoiceStatus, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  concept: { label: "Concept", variant: "default" },
  verzonden: { label: "Verzonden", variant: "info" },
  betaald: { label: "Betaald", variant: "success" },
  te_laat: { label: "Te laat", variant: "danger" },
};

type LineDraft = Pick<InvoiceLine, "description" | "quantity" | "unit_price" | "vat_rate">;

const emptyLine: LineDraft = { description: "", quantity: 1, unit_price: 0, vat_rate: 21 };

export function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("concept");
  const [issueDate, setIssueDate] = useState(todayLocalDateString());
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      void loadInvoices(user.id);
      void loadCustomers(user.id);
    }
  }, [user]);

  async function loadInvoices(userId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*, customers(id, name, company_name), invoice_lines(*)")
      .eq("user_id", userId)
      .order("issue_date", { ascending: false });
    setInvoices((data as unknown as Invoice[]) ?? []);
    setLoading(false);
  }

  async function loadCustomers(userId: string) {
    const { data } = await supabase.from("customers").select("*").eq("user_id", userId).order("name");
    setCustomers(data ?? []);
  }

  async function openNew() {
    setEditing(null);
    setInvoiceNumber("Genereren...");
    setCustomerId(customers[0]?.id ?? "");
    setStatus("concept");
    setIssueDate(todayLocalDateString());
    setDueDate("");
    setLines([{ ...emptyLine }]);
    setError(null);
    setModalOpen(true);

    // Factuurnummer wordt atomisch door de database toegekend (zie
    // next_invoice_number RPC), zodat twee gelijktijdige nieuwe facturen
    // nooit hetzelfde nummer kunnen krijgen.
    const { data, error } = await supabase.rpc("next_invoice_number", {
      p_year: new Date().getFullYear(),
    });
    if (error || !data) {
      setInvoiceNumber("");
      setError("Kon geen factuurnummer genereren: " + (error?.message ?? "onbekende fout"));
      return;
    }
    setInvoiceNumber(data as string);
  }

  function openEdit(invoice: Invoice) {
    setEditing(invoice);
    setInvoiceNumber(invoice.invoice_number);
    setCustomerId(invoice.customer_id ?? "");
    setStatus(invoice.status);
    setIssueDate(invoice.issue_date);
    setDueDate(invoice.due_date ?? "");
    setLines(
      invoice.invoice_lines && invoice.invoice_lines.length > 0
        ? invoice.invoice_lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            vat_rate: l.vat_rate,
          }))
        : [{ ...emptyLine }]
    );
    setError(null);
    setModalOpen(true);
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const { totalCents } = sumLineCents(
    lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unit_price, vatRate: l.vat_rate }))
  );

  function validateForm(): string | null {
    if (!invoiceNumber.trim()) return "Factuurnummer ontbreekt.";
    if (!issueDate) return "Factuurdatum is verplicht.";
    const validLines = lines.filter((l) => l.description.trim() !== "");
    if (validLines.length === 0) return "Voeg minimaal één factuurregel met omschrijving toe.";
    for (const l of validLines) {
      if (l.quantity <= 0) return "Aantal moet groter dan 0 zijn op elke regel.";
      if (l.unit_price < 0) return "Prijs kan niet negatief zijn.";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    // Een betaalde factuur ligt vast: alleen de status zelf mag nog
    // wijzigen (bv. terugzetten naar 'verzonden' bij een correctie). De
    // factuurregels worden dan niet aangeraakt.
    if (editing && editing.status === "betaald") {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        setError("Kon de status niet wijzigen: " + error.message);
        return;
      }
      setModalOpen(false);
      void loadInvoices(user.id);
      return;
    }

    const validLines = lines.filter((l) => l.description.trim() !== "");

    const { error } = await supabase.rpc("save_invoice", {
      p_id: editing?.id ?? null,
      p_invoice_number: invoiceNumber,
      p_customer_id: customerId || null,
      p_status: status,
      p_issue_date: issueDate,
      p_due_date: dueDate || null,
      p_lines: validLines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        vat_rate: l.vat_rate,
      })),
    });

    setSaving(false);
    if (error) {
      setError(
        error.message.includes("duplicate key") && error.message.includes("invoice_number")
          ? "Dit factuurnummer bestaat al. Kies een ander nummer."
          : error.message
      );
      return;
    }
    setModalOpen(false);
    void loadInvoices(user.id);
  }

  async function handleDelete(invoice: Invoice) {
    if (!user) return;
    if (invoice.status === "betaald") {
      alert("Betaalde facturen kunnen niet verwijderd worden.");
      return;
    }
    if (!confirm(`Factuur ${invoice.invoice_number} verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
    const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
    if (error) {
      alert("Verwijderen mislukt: " + error.message);
      return;
    }
    void loadInvoices(user.id);
  }

  function invoiceTotalCents(invoice: Invoice) {
    return sumLineCents(
      (invoice.invoice_lines ?? []).map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unit_price,
        vatRate: l.vat_rate,
      }))
    ).totalCents;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Facturen</h1>
          <p className="mt-1 text-sm text-slate-500">Maak en beheer je facturen</p>
        </div>
        <Button onClick={openNew} disabled={customers.length === 0}>
          <Plus size={16} /> Nieuwe factuur
        </Button>
      </div>
      {customers.length === 0 && (
        <p className="mt-2 text-sm text-amber-600">
          Voeg eerst een klant toe voordat je een factuur kunt maken.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-slate-400">Laden...</p>}
        {!loading && invoices.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-slate-500">
              Nog geen facturen.
            </CardContent>
          </Card>
        )}
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{inv.invoice_number}</p>
                  <Badge variant={statusLabels[inv.status].variant}>
                    {statusLabels[inv.status].label}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">
                  {inv.customers?.name ?? "Geen klant"} · {formatDate(inv.issue_date)}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {formatCentsCurrency(invoiceTotalCents(inv))}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(inv)}
                  title={inv.status === "betaald" ? "Bekijk (nummer, klant en datum liggen vast)" : "Bewerken"}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(inv)}
                  disabled={inv.status === "betaald"}
                  title={inv.status === "betaald" ? "Betaalde facturen kunnen niet verwijderd worden" : "Verwijderen"}
                >
                  <Trash2 size={15} className={inv.status === "betaald" ? "text-slate-300" : "text-red-500"} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Factuur bewerken" : "Nieuwe factuur"}
        className="sm:max-w-2xl"
      >
        {editing?.status === "betaald" && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Deze factuur is betaald en ligt vast. Je kunt alleen nog de status wijzigen
            (bijvoorbeeld bij een correctie).
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invoiceNumber">Factuurnummer</Label>
              <Input
                id="invoiceNumber"
                required
                disabled={editing?.status === "betaald"}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customer">Klant</Label>
              <Select
                id="customer"
                disabled={editing?.status === "betaald"}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Geen klant</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="issueDate">Factuurdatum</Label>
              <Input
                id="issueDate"
                type="date"
                required
                disabled={editing?.status === "betaald"}
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Vervaldatum</Label>
              <Input
                id="dueDate"
                type="date"
                disabled={editing?.status === "betaald"}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              >
                {Object.entries(statusLabels).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <fieldset disabled={editing?.status === "betaald"} className="disabled:opacity-60">
            <div className="mb-2 flex items-center justify-between">
              <Label className="mb-0">Factuurregels</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus size={14} /> Regel
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center gap-2">
                  <Input
                    className="col-span-5"
                    placeholder="Omschrijving"
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Aantal"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Prijs"
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })}
                  />
                  <Select
                    className="col-span-2"
                    value={line.vat_rate}
                    onChange={(e) => updateLine(idx, { vat_rate: Number(e.target.value) })}
                  >
                    <option value={21}>21%</option>
                    <option value={9}>9%</option>
                    <option value={0}>0%</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="col-span-1 flex justify-center text-slate-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-right text-sm font-semibold text-slate-900">
              Totaal (incl. btw): {formatCentsCurrency(totalCents)}
            </p>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving || invoiceNumber === "Genereren..."}>
            {saving ? "Opslaan..." : "Factuur opslaan"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
