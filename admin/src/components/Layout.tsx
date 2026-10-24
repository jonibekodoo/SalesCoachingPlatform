import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, ListChecks, CreditCard, Settings, BookOpen, LogOut, Radio, Menu, Wallet, FileText, UploadCloud } from 'lucide-react';
import { cx } from './ui';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'Boshqaruv paneli', icon: LayoutDashboard, end: true },
  { to: '/companies', label: 'Kompaniyalar', icon: Building2 },
  { to: '/analyses', label: 'Tahlillar', icon: ListChecks },
  { to: '/payments', label: 'Toʻlovlar', icon: Wallet },
  { to: '/plans', label: 'Tariflar', icon: CreditCard },
  { to: '/settings', label: 'Sozlamalar', icon: Settings },
  { to: '/docs', label: 'API hujjatlari', icon: BookOpen },
];

export const PORTAL_NAV: NavItem[] = [
  { to: '/portal', label: 'Umumiy', icon: LayoutDashboard, end: true },
  { to: '/portal/analyze', label: 'Audio yuklash', icon: UploadCloud },
  { to: '/portal/analyses', label: 'Tahlillar', icon: ListChecks },
  { to: '/portal/payments', label: 'Hisob va toʻlovlar', icon: Wallet },
  { to: '/portal/script', label: 'Sotuv skripti', icon: FileText },
  { to: '/portal/settings', label: 'Sozlamalar', icon: Settings },
  { to: '/portal/docs', label: 'API hujjatlari', icon: BookOpen },
];

export const Layout: React.FC<{ username: string; subtitle?: string; roleLabel?: string; nav?: NavItem[]; onLogout: () => void }> = ({
  username,
  subtitle = 'Platform · Admin',
  roleLabel = 'Administrator',
  nav: items = ADMIN_NAV,
  onLogout,
}) => {
  const [open, setOpen] = React.useState(false);
  const nav = (
    <nav className="flex-1 px-3 space-y-1">
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition',
              isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            )
          }
        >
          <n.icon className="w-4 h-4" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-full flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-slate-950 text-white sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow">
            <Radio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight">Sales Coaching</div>
            <div className="text-[11px] text-slate-400 font-medium truncate">{subtitle}</div>
          </div>
        </div>
        <div className="py-4 flex-1 flex flex-col">{nav}</div>
        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="text-xs min-w-0">
            <div className="font-bold truncate">{username}</div>
            <div className="text-slate-500">{roleLabel}</div>
          </div>
          <button onClick={onLogout} title="Chiqish" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 bg-slate-950 text-white px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            <Radio className="w-4 h-4 text-indigo-300" /> Sales Coaching
          </div>
          <button onClick={() => setOpen((v) => !v)} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
        </header>
        {open && (
          <div className="lg:hidden bg-slate-950 text-white py-3 border-b border-white/10">
            {nav}
            <button onClick={onLogout} className="mx-3 mt-2 text-sm text-slate-400 hover:text-white flex items-center gap-2 px-3 py-2 cursor-pointer">
              <LogOut className="w-4 h-4" /> Chiqish
            </button>
          </div>
        )}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
