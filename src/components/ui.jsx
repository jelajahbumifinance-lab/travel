/**
 * Elemen bersama untuk tabel: pil status dan tombol aksi. Dikumpulkan di
 * sini supaya bentuknya tidak bisa diam-diam berbeda antar halaman.
 */

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
  CAIR: { label: 'Cair', nada: 'ok' },
  BATAL: { label: 'Dibatalkan', nada: 'mute' },
};

export function StatusPil({ peta, nilai, bawaan }) {
  const s = peta[nilai] || peta[bawaan] || { label: nilai || '-', nada: 'mute' };
  return <Pil nada={s.nada}>{s.label}</Pil>;
}
