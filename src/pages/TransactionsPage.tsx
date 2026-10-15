import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Transaction, TransactionType } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";

const categories = {
  inkomst: ["Verkoop", "Dienstverlening", "Overig"],
  uitgave: ["Kantoorkosten", "Software", "Reiskosten", "Marketing", "Overig"],
};

export function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<TransactionType>("uitgave");
  const [category, setCategory] = useState(categories.uitgave[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vatRate, setVatRate] = useState(21);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (user) void loadTransactions(user.id);
  }, [user]);

  async function loadTransactions(userId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });
    setTransactions(data ?? []);
    setLoading(false);
  }

  function openNew(initialType: TransactionType) {
    setType(initialType);
    setCategory(categories[initialType][0]);
    setDescription("");
    setAmount("");
    setVatRate(21);
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type,
      category,
      description,
      amount: Number(amount),
      vat_rate: vatRate,
      transaction_date: date,
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    void loadTransactions(user.id);
  }

  async function handleDelete(t: Transaction) {
    if (!user) return;
    if (!confirm("Deze transactie verwijderen?")) return;
    await supabase.from("transactions").delete().eq("id", t.id);
    void loadTransactions(user.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inkomsten & uitgaven</h1>
          <p className="mt-1 text-sm text-slate-500">Houd je transacties bij</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNew("inkomst")}>
            <Plus size={16} /> Inkomst
          </Button>
          <Button onClick={() => openNew("uitgave")}>
            <Plus size={16} /> Uitgave
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {loading && <p className="text-sm text-slate-400">Laden...</p>}
        {!loading && transactions.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-slate-500">
              Nog geen transacties.
            </CardContent>
          </Card>
        )}
        {transactions.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {t.type === "inkomst" ? (
                  <ArrowUpCircle className="shrink-0 text-emerald-500" size={20} />
                ) : (
                  <ArrowDownCircle className="shrink-0 text-red-500" size={20} />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {t.description || t.category}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t.category} · {formatDate(t.transaction_date)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p
                  className={`font-semibold ${
                    t.type === "inkomst" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {t.type === "inkomst" ? "+" : "-"}
                  {formatCurrency(Number(t.amount))}
                </p>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t)}>
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
        title={type === "inkomst" ? "Nieuwe inkomst" : "Nieuwe uitgave"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category">Categorie</Label>
            <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories[type].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Omschrijving</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Bedrag (€)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="vatRate">BTW%</Label>
              <Select
                id="vatRate"
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
              >
                <option value={21}>21%</option>
                <option value={9}>9%</option>
                <option value={0}>0%</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
