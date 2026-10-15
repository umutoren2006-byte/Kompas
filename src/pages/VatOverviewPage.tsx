import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { formatCurrency, currentQuarter, quarterRange } from "@/lib/utils";

export function VatOverviewPage() {
  const { user } = useAuth();
  const { quarter: defaultQ, year: defaultY } = currentQuarter();
  const [quarter, setQuarter] = useState(defaultQ);
  const [year, setYear] = useState(defaultY);
  const [vatCollected, setVatCollected] = useState(0);
  const [vatPaid, setVatPaid] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) void loadVatData(user.id);
  }, [user, quarter, year]);

  async function loadVatData(userId: string) {
    setLoading(true);
    const { start, end } = quarterRange(quarter, year);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("type, amount, vat_rate")
      .eq("user_id", userId)
      .gte("transaction_date", start)
      .lte("transaction_date", end);

    let collected = 0;
    let paid = 0;
    for (const t of transactions ?? []) {
      const amount = Number(t.amount);
      const vatRate = Number(t.vat_rate);
      // amount is assumed to be the net/excl.-btw bedrag per transactie
      const vat = amount * (vatRate / 100);
      if (t.type === "inkomst") collected += vat;
      else paid += vat;
    }

    setVatCollected(collected);
    setVatPaid(paid);
    setLoading(false);
  }

  const balance = vatCollected - vatPaid;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">BTW-overzicht</h1>
      <p className="mt-1 text-sm text-slate-500">
        Voorbereiding voor je btw-aangifte — nog geen koppeling met de Belastingdienst.
      </p>

      <div className="mt-6 flex gap-3">
        <Select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
          <option value={1}>Q1 (jan-mrt)</option>
          <option value={2}>Q2 (apr-jun)</option>
          <option value={3}>Q3 (jul-sep)</option>
          <option value={4}>Q4 (okt-dec)</option>
        </Select>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[defaultY - 1, defaultY, defaultY + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Btw ontvangen (over omzet)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {loading ? "…" : formatCurrency(vatCollected)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Btw betaald (over kosten)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {loading ? "…" : formatCurrency(vatPaid)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent>
            <p className="text-sm text-indigo-700">
              {balance >= 0 ? "Af te dragen" : "Terug te vorderen"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-indigo-900">
              {loading ? "…" : formatCurrency(Math.abs(balance))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Dit overzicht is een voorbereiding op basis van je eigen geregistreerde
        inkomsten en uitgaven. Er is nog geen automatische koppeling met de
        Belastingdienst — controleer de cijfers altijd zelf voordat je aangifte doet.
      </div>
    </div>
  );
}
