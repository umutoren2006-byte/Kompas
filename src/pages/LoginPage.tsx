import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { isSupabaseConfigured } from "@/lib/supabase";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate("/app");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Compass className="text-indigo-600" size={32} />
          <h1 className="text-xl font-semibold text-slate-900">Inloggen bij Kompas</h1>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Supabase is nog niet geconfigureerd. Zie <code>.env.example</code> om in te
            loggen en de app volledig te gebruiken.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <Label htmlFor="email">E-mailadres</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@bedrijf.nl"
            />
          </div>
          <div>
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Bezig..." : "Inloggen"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Nog geen account?{" "}
          <Link to="/registreren" className="font-medium text-indigo-600 hover:underline">
            Registreer je
          </Link>
        </p>
      </div>
    </div>
  );
}
