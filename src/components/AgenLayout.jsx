import { useState, Suspense } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandIcon } from './BrandMark';
import { IconDashboard, IconTagihan, IconLeads, IconKomisi, IconHelpdesk, IconProfil } from './Icons';

// Portal Agen dipisah jadi beberapa halaman (bukan satu halaman panjang
// yang di-scroll) supaya bentuknya sama dengan sisi staf — sidebar tetap,
// kontennya yang berganti. Hanya 6 menu jadi tidak perlu dikelompokkan
// kayak sidebar staf (13+ menu, 5 grup); daftar polos lebih pas di sini.
const NAV_ITEMS = [
  { to: '/portal-agen', label: 'Ringkasan', Icon: IconDashboard, end: true },
  { to: '/portal-agen/jamaah', label: 'Jamaah Saya', Icon: IconTagihan },
  { to: '/portal-agen/calon-jamaah', label: 'Calon Jamaah', Icon: IconLeads },
  { to: '/portal-agen/komisi', label: 'Komisi Saya', Icon: IconKomisi },
  { to: '/portal-agen/bantuan', label: 'Bantuan', Icon: IconHelpdesk },
  { to: '/portal-agen/profil', label: 'Profil Saya', Icon: IconProfil },
];

export default function AgenLayout() {
  const { profile, signOut } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('jbi_dark', next ? '1' : '0');
  }

  const NavList = ({ onNavigate }) => (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <span className="w-5 flex items-center justify-center shrink-0"><item.Icon /></span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex tema-kaca">
      <aside className="card hidden md:flex flex-col w-64 shrink-0 h-[calc(100vh-1.5rem)] sticky top-3 my-3 ml-3 rounded-xl2 p-4">
        <Link to="/portal-agen" className="flex items-center gap-2.5 px-2 mb-6 rounded-md2 hover:bg-accent-soft py-1.5 -my-1">
          <BrandIcon className="w-9 h-9" />
          <span className="font-display font-bold flex-1 text-sm">JBI Finance</span>
        </Link>

        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>

        <div className="pt-3 mt-3 border-t border-rule">
          <p className="px-2 text-xs font-semibold truncate">{profile?.full_name}</p>
          <p className="px-2 text-[11px] text-ink-soft mb-2">Agen/Mitra</p>
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
        <header className="md:hidden sticky top-0 z-20 header-kaca px-4 py-3 flex items-center justify-between">
          <Link to="/portal-agen" className="flex items-center gap-2 min-w-0">
            <BrandIcon className="w-8 h-8" />
            <span className="font-display font-bold text-sm">JBI Finance</span>
          </Link>
          <button
            type="button"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center text-accent-text"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </header>

        {mobileOpen && (
          <div className="md:hidden header-kaca p-4">
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

        <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:px-6 md:py-4 overflow-y-auto">
          <Suspense fallback={<div className="text-sm text-ink-soft">Memuat halaman...</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Tempat menempel dropdown MenuAksi/SearchSelect (lihat
          components/ui.jsx & SearchSelect.jsx) lewat portal. */}
      <div id="menu-portal-root" style={{ display: 'contents' }} />
    </div>
  );
}
