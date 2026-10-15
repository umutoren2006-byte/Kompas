import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Wallet, FileClock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

interface Stats {
  revenue: number;
  costs: number;
  openInvoices: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ revenue: 0, costs: 0, openInvoices: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void loadStats(user.id);
  }, [user]);

  async function loadStats(userId: string) {
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);

    const [{ data: transactions }, { data: invoices }] = await Promise.all([
      supabase
        .from("transactions")
        .select("type, amount")
        .eq("user_id", userId)
        .gte("transaction_date", monthStart),
      supabase
        .from("invoices")
        .select("id, status")
        .eq("user_id", userId)
        .in("status", ["verzonden", "te_laat"]),
    ]);

    const revenue =
      transactions
        ?.filter((t) => t.type === "inkomst")
        .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
    const costs =
      transactions
        ?.filter((t) => t.type === "uitgave")
        .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

    setStats({
      revenue,
      costs,
      openInvoices: invoices?.length ?? 0,
    });
    setLoading(false);
  }

  const profit = stats.revenue - stats.costs;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Overzicht van deze maand</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Omzet (deze maand)"
          value={formatCurrency(stats.revenue)}
          loading={loading}
          color="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          icon={TrendingDown}
          label="Kosten (deze maand)"
          value={formatCurrency(stats.costs)}
          loading={loading}
          color="text-red-600 bg-red-50"
        />
        <StatCard
          icon={Wallet}
          label="Winst (deze maand)"
          value={formatCurrency(profit)}
          loading={loading}
          color="text-indigo-600 bg-indigo-50"
        />
        <StatCard
          icon={FileClock}
          label="Openstaande facturen"
          value={String(stats.openInvoices)}
          loading={loading}
          color="text-amber-600 bg-amber-50"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to="/app/facturen">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-medium text-slate-900">Nieuwe factuur maken</h3>
              <p className="mt-1 text-sm text-slate-500">Stel een factuur op voor een klant.</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/app/taken">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-medium text-slate-900">Bekijk je actielijst</h3>
              <p className="mt-1 text-sm text-slate-500">Ontbrekende bonnetjes en vervallen facturen.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  loading: boolean;
  color: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className={`mb-3 inline-flex rounded-lg p-2 ${color}`}>
          <Icon size={18} />
        </div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {loading ? "…" : value}
        </p>
      </CardContent>
    </Card>
  );
}
