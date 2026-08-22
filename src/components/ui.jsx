/**
 * Elemen bersama untuk tabel: pil status dan tombol aksi. Dikumpulkan di
 * sini supaya bentuknya tidak bisa diam-diam berbeda antar halaman.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Pil({ nada = 'mute', children }) {
  return <span className={`pill pill-${nada}`}>{children}</span>;
}

/**
 * Tombol aksi dalam tabel. Selalu berupa kata, tidak pernah ikon sendirian.
 *   netral — aksi biasa (Detail, Ubah)
 *   utama  — aksi pokok baris itu
 *   bahaya — aksi merusak/mengurangi (Batalkan, Nonaktifkan)
 */
export function Aksi({ jenis = 'netral', href, children, ...sisa }) {
  const kelas = `aksi aksi-${jenis}`;
  if (href) {
    return (
      <a className={kelas} href={href} target="_blank" rel="noopener noreferrer" {...sisa}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={kelas} {...sisa}>
      {children}
    </button>
  );
}

export function GrupAksi({ children }) {
  return <div className="grup-aksi">{children}</div>;
}

/**
 * Menu "⋯" untuk aksi sekunder dalam tabel — dipakai bersama satu Aksi
 * utama yang tetap tampil, supaya baris tidak perlu menumpuk 4-5 tombol
 * sekaligus. Isi menunya dirender lewat portal ke document.body (posisi
 * dihitung manual dari lokasi tombol) SUPAYA TIDAK terpotong oleh kartu
 * pembungkus tabel yang punya `overflow-hidden` (dipakai untuk merapikan
 * sudut membulat) — kalau dropdown ini ditaruh langsung di dalam sel
 * tabel seperti biasa, baris-baris dekat bagian bawah kartu akan
 * terpotong separuh.
 */
export function MenuAksi({ children, label = 'Aksi lainnya' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    // Ditutup saat discroll/diresize daripada mengikuti posisi terus-menerus —
    // menu aksi cuma dibuka sebentar, tidak perlu tetap menempel saat pengguna
    // menggulir tabel di baliknya.
    function onTutup() { setOpen(false); }
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onTutup, true);
    window.addEventListener('resize', onTutup);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onTutup, true);
      window.removeEventListener('resize', onTutup);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="w-7 h-7 rounded-md2 flex items-center justify-center text-ink-soft hover:bg-accent-soft hover:text-accent-text shrink-0"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
          className="z-50 w-48 card rounded-md2 py-1.5 flex flex-col overflow-hidden"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        // Ditaruh di #menu-portal-root (anak `.staf-kaca` di Layout.jsx)
        // kalau ada, BUKAN langsung document.body — supaya menu ini masih
        // mewarisi variabel warna teal/kaca shell staf. Portal ke body
        // polos dipakai sebagai fallback di luar shell staf (kalau nanti
        // dipakai di halaman lain yang tidak punya elemen ini).
        document.getElementById('menu-portal-root') || document.body
      )}
    </>
  );
}

export function ItemMenu({ jenis = 'netral', children, ...sisa }) {
  const kelas = jenis === 'bahaya'
    ? 'text-brick-600 hover:bg-brick-100 dark:hover:bg-red-900/30'
    : 'text-ink hover:bg-accent-soft';
  return (
    <button type="button" className={`text-left px-3.5 py-2 text-sm font-medium ${kelas}`} {...sisa}>
      {children}
    </button>
  );
}

export function AksiIkon({ jenis = 'netral', label, children, ...sisa }) {
  return (
    <button
      type="button"
      className={`aksi aksi-ikon aksi-${jenis}`}
      title={label}
      aria-label={label}
      {...sisa}
    >
      {children}
    </button>
  );
}

export function IkonUbah() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-4 h-4">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IkonNonaktifkan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-4 h-4">
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  );
}

// Belum ada alur approval berjenjang di fondasi ini — semua transaksi
// tercatat langsung APPROVED, satu-satunya status lain adalah VOID
// (pembatalan dengan alasan, lihat sql/0001_pondasi.sql bagian 4).
export const STATUS_TRANSAKSI = {
  APPROVED: { label: 'Tercatat', nada: 'ok' },
  VOID: { label: 'Dibatalkan', nada: 'mute' },
};

export const STATUS_PENDAFTARAN = {
  LUNAS: { label: 'Lunas', nada: 'ok' },
  DICICIL: { label: 'Dicicil', nada: 'warn' },
  LEWAT_TEMPO: { label: 'Lewat Tempo', nada: 'bad' },
  BELUM_BAYAR: { label: 'Belum Bayar', nada: 'mute' },
  BATAL: { label: 'Dibatalkan', nada: 'mute' },
};

export const STATUS_KOMISI = {
  AKRUAL: { label: 'Akrual', nada: 'warn' },
  DIAJUKAN: { label: 'Diajukan', nada: 'info' },
  CAIR: { label: 'Cair', nada: 'ok' },
  BATAL: { label: 'Dibatalkan', nada: 'mute' },
};

export function StatusPil({ peta, nilai, bawaan }) {
  const s = peta[nilai] || peta[bawaan] || { label: nilai || '-', nada: 'mute' };
  return <Pil nada={s.nada}>{s.label}</Pil>;
}
