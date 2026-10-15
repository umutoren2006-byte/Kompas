import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Customer } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const emptyForm = {
  name: "",
  company_name: "",
  email: "",
  address: "",
  vat_number: "",
  notes: "",
};

export function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) void loadCustomers(user.id);
  }, [user]);

  async function loadCustomers(userId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    setCustomers(data ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      company_name: customer.company_name ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      vat_number: customer.vat_number ?? "",
      notes: customer.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    const payload = { ...form, user_id: user.id };

    const { error } = editing
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    void loadCustomers(user.id);
  }

  async function handleDelete(customer: Customer) {
    if (!user) return;
    if (!confirm(`Klant "${customer.name}" verwijderen?`)) return;
    await supabase.from("customers").delete().eq("id", customer.id);
    void loadCustomers(user.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Klanten</h1>
          <p className="mt-1 text-sm text-slate-500">Beheer je klantgegevens</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Nieuwe klant
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-slate-400">Laden...</p>}
        {!loading && customers.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-slate-500">
              Nog geen klanten. Voeg je eerste klant toe.
            </CardContent>
          </Card>
        )}
        {customers.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{c.name}</p>
                {c.company_name && <p className="text-sm text-slate-500">{c.company_name}</p>}
                {c.email && <p className="text-sm text-slate-500">{c.email}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                  <Pencil size={15} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(c)}>
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
        title={editing ? "Klant bewerken" : "Nieuwe klant"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Naam *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="company_name">Bedrijfsnaam</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="address">Adres</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vat_number">BTW-nummer</Label>
            <Input
              id="vat_number"
              value={form.vat_number}
              onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notities</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
