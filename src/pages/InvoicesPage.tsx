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
import { formatCurrency, formatDate } from "@/lib/utils";

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
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
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

  function openNew() {
    setEditing(null);
    setInvoiceNumber(`F-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, "0")}`);
    setCustomerId(customers[0]?.id ?? "");
    setStatus("concept");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setLines([{ ...emptyLine }]);
    setError(null);
    setModalOpen(true);
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

  function lineTotal(l: LineDraft) {
    const subtotal = l.quantity * l.unit_price;
    return subtotal + subtotal * (l.vat_rate / 100);
  }

  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    const invoicePayload = {
      user_id: user.id,
      customer_id: customerId || null,
      invoice_number: invoiceNumber,
      status,
      issue_date: issueDate,
      due_date: dueDate || null,
    };

    let invoiceId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("invoices").update(invoicePayload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        setError(error.message);
        return;
      }
      await supabase.from("invoice_lines").delete().eq("invoice_id", editing.id);
    } else {
      const { data, error } = await supabase.from("invoices").insert(invoicePayload).select().single();
      if (error || !data) {
        setSaving(false);
        setError(error?.message ?? "Onbekende fout");
        return;
      }
      invoiceId = data.id;
    }

    const linePayload = lines
      .filter((l) => l.description.trim() !== "")
      .map((l, idx) => ({
        invoice_id: invoiceId,
        user_id: user.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        vat_rate: l.vat_rate,
        sort_order: idx,
      }));

    if (linePayload.length > 0) {
      const { error } = await supabase.from("invoice_lines").insert(linePayload);
      if (error) {
        setSaving(false);
        setError(error.message);
        return;
      }
    }

    setSaving(false);
    setModalOpen(false);
    void loadInvoices(user.id);
  }

  async function handleDelete(invoice: Invoice) {
    if (!user) return;
    if (!confirm(`Factuur ${invoice.invoice_number} verwijderen?`)) return;
    await supabase.from("invoices").delete().eq("id", invoice.id);
    void loadInvoices(user.id);
  }

  function invoiceTotal(invoice: Invoice) {
    return (invoice.invoice_lines ?? []).reduce((sum, l) => {
      const subtotal = l.quantity * l.unit_price;
      return sum + subtotal + subtotal * (l.vat_rate / 100);
    }, 0);
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
                  {formatCurrency(invoiceTotal(inv))}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(inv)}>
                  <Pencil size={15} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(inv)}>
                  <Trash2 size={15} className="text-red-500" />
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invoiceNumber">Factuurnummer</Label>
              <Input
                id="invoiceNumber"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customer">Klant</Label>
              <Select
                id="customer"
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
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Vervaldatum</Label>
              <Input
                id="dueDate"
                type="date"
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

          <div>
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
                    className="col-span-1 flex justify-center text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-right text-sm font-semibold text-slate-900">
              Totaal (incl. btw): {formatCurrency(total)}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Opslaan..." : "Factuur opslaan"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
