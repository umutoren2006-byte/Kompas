import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  Receipt,
  Percent,
  CheckSquare,
  LogOut,
  Compass,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/klanten", label: "Klanten", icon: Users },
  { to: "/app/facturen", label: "Facturen", icon: FileText },
  { to: "/app/transacties", label: "Inkomsten & uitgaven", icon: Wallet },
  { to: "/app/bonnetjes", label: "Bonnetjes", icon: Receipt },
  { to: "/app/btw", label: "BTW-overzicht", icon: Percent },
  { to: "/app/taken", label: "Taken", icon: CheckSquare },
];

export function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <Compass className="text-indigo-600" size={24} />
          <span className="text-lg font-semibold text-slate-900">Kompas</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate px-2 text-xs text-slate-400">{user?.email}</p>
          <button
            onClick={() => signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={16} />
            Uitloggen
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Compass className="text-indigo-600" size={22} />
          <span className="font-semibold text-slate-900">Kompas</span>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Uitloggen"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Main content */}
      <main className="pb-20 md:ml-64 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                isActive ? "text-indigo-600" : "text-slate-500"
              )
            }
          >
            <item.icon size={20} />
            <span className="truncate px-0.5">{item.label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
