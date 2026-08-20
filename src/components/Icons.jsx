/**
 * Ikon navigasi sidebar — SVG stroke minimal (gaya Feather/Lucide), bukan
 * karakter unicode (▦ ⌗ ◎) seperti sebelumnya. Unicode itu dipilih glyph
 * font-nya sendiri oleh browser dan hasilnya tidak konsisten/terlihat kasar
 * di berbagai OS — SVG memberi kontrol penuh atas ketebalan garis dan warna,
 * dan otomatis mengikuti warna teks link (aktif = oranye, non-aktif = abu).
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  className: 'w-[17px] h-[17px]',
};

export function IconDashboard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function IconBukuKas(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19.2V6.8A2.8 2.8 0 0 1 6.8 4H20v16H6.8A2.8 2.8 0 0 0 4 22" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  );
}

export function IconRekening(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 9.5V20M9.5 9.5V20M14.5 9.5V20M19 9.5V20" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconPaket(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="8" width="17" height="12.5" rx="2" />
      <path d="M8.5 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
      <path d="M3.5 13h17" />
    </svg>
  );
}

export function IconTagihan(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2v-19Z" />
      <path d="M8.5 8h7M8.5 12h7" />
    </svg>
  );
}

export function IconVendor(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21V9.5L12 4l8 5.5V21" />
      <path d="M9 21v-6h6v6" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function IconKomisi(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="7.5" cy="7.5" r="3" />
      <circle cx="16.5" cy="16.5" r="3" />
      <path d="M6 18 18 6" />
    </svg>
  );
}

export function IconLaporan(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 3.5h10l4 4V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8 13.5v4M12 10.5v7M16 15.5v2" />
    </svg>
  );
}

export function IconAgen(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="7.5" r="3" />
      <path d="M3.5 19.5c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M16.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M15 14c2.8.3 4.5 2.3 4.5 5" />
    </svg>
  );
}

export function IconJejakAudit(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 3.5h6l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M9 12.5l2 2 4-4.5" />
    </svg>
  );
}

export function IconUndangStaf(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" />
      <path d="M17.5 8.5h4.5M19.75 6.25v4.5" />
    </svg>
  );
}

export function IconLeads(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h16l-6 8v6l-4 2v-8L4 4Z" />
    </svg>
  );
}
