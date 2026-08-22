import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandIcon, BrandWordmark } from './BrandMark';

const ROLE_LABEL = {
  agen: 'Agen/Mitra',
  jamaah: 'Jamaah',
};

/**
 * Layout terpisah untuk portal non-staf (agen, jamaah) — sengaja TANPA
 * sidebar staf. Masing-masing hanya punya satu halaman (data miliknya
 * sendiri), jadi tidak ada menu untuk disembunyikan; memakai <Layout>
 * staf dan menyaring menunya berisiko satu item baru lolos tanpa sengaja
 * jadi terlihat oleh peran yang bukan staf.
 */
export default function PortalLayout() {
  const { profile, signOut } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('jbi_dark', next ? '1' : '0');
  }

  return (
    <div className="min-h-screen flex flex-col tema-kaca">
      <header className="sticky top-0 z-20 header-kaca px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandIcon className="w-9 h-9" />
          <BrandWordmark />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold leading-tight">{profile?.full_name}</p>
            <p className="text-[11px] text-ink-soft leading-tight">{ROLE_LABEL[profile?.role] || profile?.role}</p>
          </div>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            className="w-9 h-9 rounded-full hover:bg-accent-soft flex items-center justify-center text-ink-soft text-sm"
          >
            {isDark ? '☀' : '☽'}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="text-xs font-semibold px-3 py-2 rounded-md2 bg-brick-100 text-brick-600"
          >
            Keluar
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6">
        <Suspense fallback={<div className="text-sm text-ink-soft">Memuat halaman...</div>}>
          <Outlet />
        </Suspense>
      </main>

      <div id="menu-portal-root" style={{ display: 'contents' }} />
    </div>
  );
}
