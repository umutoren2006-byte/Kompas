import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Task } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn, todayLocalDateString } from "@/lib/utils";

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (user) void refreshAll(user.id);
  }, [user]);

  async function refreshAll(userId: string) {
    setLoading(true);
    await generateAutomaticTasks(userId);
    await loadTasks(userId);
    setLoading(false);
  }

  async function loadTasks(userId: string) {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("is_done")
      .order("created_at", { ascending: false });
    setTasks(data ?? []);
  }

  // Genereert automatische taken op basis van echte data: vervallen facturen
  // en uitgaven zonder gekoppeld bonnetje. Voorkomt duplicaten per gerelateerd item.
  async function generateAutomaticTasks(userId: string) {
    const today = todayLocalDateString();

    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, due_date")
      .eq("user_id", userId)
      .in("status", ["verzonden", "te_laat"])
      .lt("due_date", today);

    const { data: expensesWithoutReceipt } = await supabase
      .from("transactions")
      .select("id, description, category, receipts(id)")
      .eq("user_id", userId)
      .eq("type", "uitgave");

    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("related_invoice_id, related_transaction_id")
      .eq("user_id", userId);

    const existingInvoiceIds = new Set(
      (existingTasks ?? []).map((t) => t.related_invoice_id).filter(Boolean)
    );
    const existingTransactionIds = new Set(
      (existingTasks ?? []).map((t) => t.related_transaction_id).filter(Boolean)
    );

    const newTasks = [];

    for (const inv of overdueInvoices ?? []) {
      if (!existingInvoiceIds.has(inv.id)) {
        newTasks.push({
          user_id: userId,
          title: `Factuur ${inv.invoice_number} is vervallen — volg op bij klant`,
          type: "factuur_te_laat" as const,
          related_invoice_id: inv.id,
        });
      }
    }

    for (const tx of expensesWithoutReceipt ?? []) {
      const hasReceipt = Array.isArray(tx.receipts) && tx.receipts.length > 0;
      if (!hasReceipt && !existingTransactionIds.has(tx.id)) {
        newTasks.push({
          user_id: userId,
          title: `Bonnetje ontbreekt voor uitgave: ${tx.description || tx.category}`,
          type: "ontbrekend_bonnetje" as const,
          related_transaction_id: tx.id,
        });
      }
    }

    if (newTasks.length > 0) {
      await supabase.from("tasks").insert(newTasks);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: newTitle.trim(),
      type: "handmatig",
    });
    setNewTitle("");
    void loadTasks(user.id);
  }

  async function toggleDone(task: Task) {
    if (!user) return;
    await supabase.from("tasks").update({ is_done: !task.is_done }).eq("id", task.id);
    void loadTasks(user.id);
  }

  async function handleDelete(task: Task) {
    if (!user) return;
    if (!confirm("Deze taak verwijderen?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      alert("Verwijderen mislukt: " + error.message);
      return;
    }
    void loadTasks(user.id);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Taken</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ontbrekende bonnetjes en vervallen facturen worden automatisch aangemaakt
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex gap-2">
        <Input
          placeholder="Nieuwe taak toevoegen..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <Button type="submit">
          <Plus size={16} />
        </Button>
      </form>

      <div className="mt-6 space-y-2">
        {loading && <p className="text-sm text-slate-400">Laden...</p>}
        {!loading && tasks.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-slate-500">
              Geen openstaande taken. Goed bezig!
            </CardContent>
          </Card>
        )}
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <button
                onClick={() => toggleDone(task)}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    task.is_done
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-slate-300"
                  )}
                >
                  {task.is_done && <Check size={12} className="text-white" />}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    task.is_done ? "text-slate-400 line-through" : "text-slate-900"
                  )}
                >
                  {task.title}
                </span>
              </button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(task)}>
                <Trash2 size={15} className="text-red-500" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
