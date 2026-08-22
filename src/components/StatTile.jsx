/**
 * Kartu statistik bento — ikon dalam lingkaran berwarna + angka besar,
 * dipakai di halaman-halaman yang punya baris ringkasan (Dashboard, Agen,
 * Komisi, RAB Paket, dst). Satu sumber supaya bahasa visualnya konsisten,
 * bukan disalin-tempel per halaman.
 */

// Palet literal (bukan hasil string.replace()) supaya terdeteksi static
// scanner Tailwind. Tiap warna sudah dipasangkan varian dark: sendiri
// karena teal/moss/brick/orange/sky bukan token CSS variable yang otomatis
// ikut berganti mode gelap seperti --accent.
export const WARNA_STAT = {
  teal: { bg: 'bg-teal-100 dark:bg-teal-800/40', text: 'text-teal-700 dark:text-teal-300' },
  moss: { bg: 'bg-moss-100 dark:bg-moss-600/25', text: 'text-moss-600 dark:text-moss-500' },
  brick: { bg: 'bg-brick-100 dark:bg-red-900/30', text: 'text-brick-600 dark:text-red-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-800/40', text: 'text-orange-600 dark:text-orange-300' },
  sky: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300' },
};

export function StatTile({ warna, Icon, label, value, children }) {
  return (
    <div className="card rounded-xl2 p-4">
      <div className={`w-10 h-10 rounded-xl2 flex items-center justify-center mb-3 ${warna.bg}`}>
        <Icon className={`w-5 h-5 ${warna.text}`} />
      </div>
      <p className="text-xs text-ink-soft font-medium">{label}</p>
      <p className="tabular text-xl font-bold mt-1">{value}</p>
      {children}
    </div>
  );
}

const svgBase = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export function IconWallet({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9h1.5A1.5 1.5 0 0 1 22 10.5v6a1.5 1.5 0 0 1-1.5 1.5H5.5A2.5 2.5 0 0 1 3 15.5v-8Z" />
      <circle cx="17" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTrendUp({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M3 16l6-6 4 4 8-9" />
      <path d="M15 5h6v6" />
    </svg>
  );
}

export function IconTrendDown({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M3 8l6 6 4-4 8 9" />
      <path d="M15 19h6v-6" />
    </svg>
  );
}

export function IconReceipt({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function IconUsers({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19c0-3.4 2.8-5.8 6.2-5.8s6.2 2.4 6.2 5.8" />
      <path d="M16 4.3a3.2 3.2 0 0 1 0 6.2M21.2 19c0-2.8-1.9-5-4.6-5.6" />
    </svg>
  );
}

export function IconCheckCircle({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.6 2.6L16.5 9" />
    </svg>
  );
}

export function IconClock({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconTarget({ className = 'w-5 h-5' }) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}
