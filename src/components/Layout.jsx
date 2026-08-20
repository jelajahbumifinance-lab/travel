import { useState, Suspense } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandIcon } from './BrandMark';
import NotificationBell from './NotificationBell';
import { IconDashboard, IconBukuKas, IconRekening, IconPaket, IconTagihan, IconVendor, IconAgen, IconKomisi, IconLaporan, IconJejakAudit, IconUndangStaf } from './Icons';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/tagihan', label: 'Tagihan & Cicilan', Icon: IconTagihan },
  { to: '/paket', label: 'Paket Keberangkatan', Icon: IconPaket },
  { to: '/vendor', label: 'Vendor', Icon: IconVendor },
  { to: '/agen', label: 'Agen & Mitra', Icon: IconAgen },
  { to: '/komisi', label: 'Komisi Agen', Icon: IconKomisi },
  { to: '/buku-kas', label: 'Buku Kas', Icon: IconBukuKas },
  { to: '/rekening', label: 'Kas & Rekening', Icon: IconRekening },
  // Tanpa daftar `roles`, menu dianggap milik semua staf — hanya menu yang
  // memang perlu dibatasi (laporan manajemen, mengundang akun baru) yang
  // menyebutkannya.
  { to: '/laporan', label: 'Laporan Keuangan', Icon: IconLaporan, roles: ['direktur', 'admin_keuangan'] },
  { to: '/jejak-audit', label: 'Jejak Audit', Icon: IconJejakAudit, roles: ['direktur', 'admin_keuangan'] },
  { to: '/undang-staf', label: 'Undang Staf', Icon: IconUndangStaf, roles: ['direktur', 'admin_keuangan'] },
];

export default function Layout() {
  const { profile, signOut } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('jbi_dark', next ? '1' : '0');
  }

  const ROLE_LABEL = {
    direktur: 'Direktur',
    admin_keuangan: 'Admin Keuangan',
    kasir: 'Kasir',
    agen: 'Agen/Mitra',
  };

  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(profile?.role));

  const NavList = ({ onNavigate }) => (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <span className="w-5 flex items-center justify-center shrink-0">
            <item.Icon />
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-rule bg-paper-raised p-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 mb-6 rounded-md2 hover:bg-accent-soft py-1.5 -my-1">
          <BrandIcon className="w-9 h-9" />
          <span className="font-display font-bold flex-1 text-sm">JBI Finance</span>
        </Link>

        <p className="text-[11px] font-bold text-ink-soft px-3 mb-2 uppercase tracking-wider">Menu</p>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>

        <div className="pt-3 mt-3 border-t border-rule">
          <p className="px-2 text-xs font-semibold truncate">{profile?.full_name}</p>
          <p className="px-2 text-[11px] text-ink-soft mb-2">{ROLE_LABEL[profile?.role] || profile?.role}</p>
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex-1 text-xs font-semibold px-3 py-2 rounded-md2 bg-accent-soft text-accent-text"
            >
              {isDark ? '☀ Terang' : '☽ Gelap'}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex-1 text-xs font-semibold px-3 py-2 rounded-md2 bg-brick-100 text-brick-600"
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 bg-paper-raised border-b border-rule px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
            <BrandIcon className="w-8 h-8" />
            <span className="font-display font-bold text-sm">JBI Finance</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              type="button"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center text-accent-text"
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="md:hidden bg-paper-raised border-b border-rule p-4">
            <NavList onNavigate={() => setMobileOpen(false)} />
            <div className="pt-3 mt-3 border-t border-rule flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-accent-soft text-accent-text"
              >
                {isDark ? '☀ Mode Terang' : '☽ Mode Gelap'}
              </button>
              <button
                type="button"
                onClick={signOut}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-brick-100 text-brick-600"
              >
                Keluar
              </button>
            </div>
          </div>
        )}

        <div className="hidden md:flex items-center justify-end gap-2 px-6 pt-3 w-full max-w-7xl mx-auto">
          <NotificationBell />
        </div>

        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:px-6 md:py-4 overflow-y-auto">
          <Suspense fallback={<div className="text-sm text-ink-soft">Memuat halaman...</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
