import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Profile } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";

const emptyForm = {
  full_name: "",
  company_name: "",
  kvk_number: "",
  vat_number: "",
  address: "",
  iban: "",
  email: "",
  phone: "",
  invoice_footer: "",
};

// Lichte validatie van een Nederlands IBAN-formaat (NL + 2 cijfers + 4
// letters bank-code + 10 cijfers). Dit is geen volledige IBAN-checksum,
// maar vangt de meest voorkomende tikfouten af.
const NL_IBAN_PATTERN = /^NL\d{2}[A-Z]{4}\d{10}$/;

export function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) void loadProfile(user.id);
  }, [user]);

  async function loadProfile(userId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<Profile>();
    if (data) {
      setForm({
        full_name: data.full_name ?? "",
        company_name: data.company_name ?? "",
        kvk_number: data.kvk_number ?? "",
        vat_number: data.vat_number ?? "",
        address: data.address ?? "",
        iban: data.iban ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        invoice_footer: data.invoice_footer ?? "",
      });
    }
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(false);

    const ibanNormalized = form.iban.replace(/\s+/g, "").toUpperCase();
    if (ibanNormalized && !NL_IBAN_PATTERN.test(ibanNormalized)) {
      setError("IBAN lijkt ongeldig. Gebruik het formaat NL00BANK0123456789.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, iban: ibanNormalized || null })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Laden...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Instellingen</h1>
      <p className="mt-1 text-sm text-slate-500">
        Je bedrijfs- en betalingsgegevens, gebruikt op je facturen
      </p>

      <Card className="mt-6">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Naam</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
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
                <Label htmlFor="kvk_number">KvK-nummer</Label>
                <Input
                  id="kvk_number"
                  value={form.kvk_number}
                  onChange={(e) => setForm({ ...form, kvk_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vat_number">Btw-nummer</Label>
                <Input
                  id="vat_number"
                  value={form.vat_number}
                  onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Adres</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">E-mail (op factuur)</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefoon</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="iban">IBAN (voor betalingsgegevens op facturen)</Label>
              <Input
                id="iban"
                placeholder="NL00BANK0123456789"
                value={form.iban}
                onChange={(e) => setForm({ ...form, iban: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="invoice_footer">Extra tekst onderaan factuur (optioneel)</Label>
              <Textarea
                id="invoice_footer"
                rows={2}
                placeholder="Bijv. betalingstermijn of bedankregel"
                value={form.invoice_footer}
                onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">Opgeslagen.</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
