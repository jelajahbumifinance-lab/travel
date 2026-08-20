import { useState, useMemo, Suspense } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandIcon } from './BrandMark';
import NotificationBell from './NotificationBell';
import { IconDashboard, IconBukuKas, IconRekening, IconPaket, IconTagihan, IconVendor, IconAgen, IconKomisi, IconLaporan, IconJejakAudit, IconUndangStaf, IconLeads } from './Icons';

// Menu dikelompokkan per fungsi (bukan satu daftar panjang rata) supaya
// sidebar tetap mudah dipindai walau modulnya terus bertambah. Grup tanpa
// label ("Utama") tampil polos di atas; grup lain dapat judul kecil.
// Item tanpa daftar `roles` dianggap milik semua staf — hanya menu yang
// memang perlu dibatasi (laporan manajemen, jejak audit, undang staf) yang
// menyebutkannya.
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
    ],
  },
  {
    label: 'Produk & Pasokan',
    items: [
      { to: '/paket', label: 'Paket Keberangkatan', Icon: IconPaket },
      { to: '/vendor', label: 'Vendor', Icon: IconVendor },
    ],
  },
  {
    label: 'Keagenan',
    items: [
      { to: '/agen', label: 'Agen & Mitra', Icon: IconAgen },
      { to: '/komisi', label: 'Komisi Agen', Icon: IconKomisi },
      { to: '/crm-agen', label: 'CRM Agen', Icon: IconLeads },
    ],
  },
  {
    label: 'Pemasaran',
    items: [
      { to: '/leads', label: 'Leads / Calon Jamaah', Icon: IconLeads },
    ],
  },
  {
    label: 'Transaksi & Keuangan',
    items: [
      { to: '/tagihan', label: 'Tagihan & Cicilan', Icon: IconTagihan },
      { to: '/buku-kas', label: 'Buku Kas', Icon: IconBukuKas },
      { to: '/rekening', label: 'Kas & Rekening', Icon: IconRekening },
      { to: '/laporan', label: 'Laporan Keuangan', Icon: IconLaporan, roles: ['direktur', 'admin_keuangan'] },
    ],
  },
  {
    label: 'Sistem & Pengawasan',
    items: [
      { to: '/jejak-audit', label: 'Jejak Audit', Icon: IconJejakAudit, roles: ['direktur', 'admin_keuangan'] },
      { to: '/undang-staf', label: 'Undang Staf', Icon: IconUndangStaf, roles: ['direktur', 'admin_keuangan'] },
    ],
  },
];

export default function Layout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [mobileOpen, setMobileOpen] = useState(false);
  // Grup yang dibuka manual oleh pengguna (klik judulnya). Terpisah dari
  // grup yang otomatis terbuka karena berisi halaman yang sedang aktif —
  // supaya pindah halaman tidak diam-diam menutup grup lain yang tadi
  // sengaja dibuka.
  const [grupTerbuka, setGrupTerbuka] = useState(() => new Set());

  function toggleGrup(label) {
    setGrupTerbuka((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

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

  // Grup yang seluruh isinya tersaring habis oleh peran (mis. kasir vs
  // "Sistem & Pengawasan") disembunyikan total — judul grup kosong tanpa
  // isi di bawahnya terlihat seperti bug, bukan sekadar menu kosong.
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((item) => !item.roles || item.roles.includes(profile?.role)) }))
    .filter((g) => g.items.length > 0);

  // Grup yang berisi halaman yang sedang dibuka harus terlihat terbuka
  // dengan sendirinya — kalau tidak, seseorang bisa mendarat di halaman
  // aktifnya sendiri tapi tidak melihat menunya tersorot di mana pun.
  const grupAktif = useMemo(() => {
    const found = visibleGroups.find((g) =>
      g.items.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
    );
    return found?.label ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const NavList = ({ onNavigate }) => (
    <nav className="flex flex-col gap-1">
      {visibleGroups.map((group, i) => {
        // Grup "Utama" (Dashboard, tanpa label) selalu tampil polos, tidak
        // bisa dilipat — cuma satu tautan, tidak ada yang perlu disembunyikan.
        if (!group.label) {
          return group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="w-5 flex items-center justify-center shrink-0"><item.Icon /></span>
              {item.label}
            </NavLink>
          ));
        }

        const terbuka = group.label === grupAktif || grupTerbuka.has(group.label);
        return (
          <div key={group.label} className="mt-3 first:mt-0">
            <button
              type="button"
              onClick={() => toggleGrup(group.label)}
              aria-expanded={terbuka}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-md2 text-[10px] font-bold text-ink-soft uppercase tracking-wider hover:bg-accent-soft hover:text-accent-text"
            >
              {group.label}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`w-2.5 h-2.5 shrink-0 transition-transform ${terbuka ? 'rotate-90' : ''}`}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            {terbuka && (
              <div className="flex flex-col gap-1 mt-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="w-5 flex items-center justify-center shrink-0"><item.Icon /></span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-rule bg-paper-raised p-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 mb-6 rounded-md2 hover:bg-accent-soft py-1.5 -my-1">
          <BrandIcon className="w-9 h-9" />
          <span className="font-display font-bold flex-1 text-sm">JBI Finance</span>
        </Link>

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
