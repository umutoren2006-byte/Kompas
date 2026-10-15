import { Link } from "react-router-dom";
import { Compass, LayoutDashboard, FileText, Percent, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";

const features = [
  {
    icon: LayoutDashboard,
    title: "Overzichtelijk dashboard",
    text: "Omzet, kosten, winst en openstaande facturen in één oogopslag.",
  },
  {
    icon: FileText,
    title: "Facturen & klanten",
    text: "Maak en beheer professionele facturen en klantgegevens.",
  },
  {
    icon: Percent,
    title: "BTW-voorbereiding",
    text: "Automatisch BTW-overzicht per kwartaal, gebaseerd op je eigen gegevens.",
  },
  {
    icon: CheckSquare,
    title: "Centrale actielijst",
    text: "Mis nooit meer een bonnetje of een vervallen factuur.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Compass className="text-indigo-600" size={26} />
          <span className="text-lg font-semibold text-slate-900">Kompas</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/inloggen" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Inloggen
          </Link>
          <Link to="/registreren">
            <Button size="sm">Gratis beginnen</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Boekhouding die meedenkt, niet in de weg zit
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Kompas is een moderne boekhoudapp voor Nederlandse zzp'ers en kleine
          ondernemingen — overzichtelijker en eenvoudiger dan traditionele
          boekhoudsoftware.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/registreren">
            <Button size="lg">Start gratis</Button>
          </Link>
          <Link to="/inloggen">
            <Button size="lg" variant="outline">
              Ik heb al een account
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 pb-20 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <f.icon className="mb-3 text-indigo-600" size={24} />
            <h3 className="font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Kompas
      </footer>
    </div>
  );
}
