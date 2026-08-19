/**
 * Wordmark JBI digambar ulang sebagai SVG + teks (bukan file logo asli —
 * belum ada berkasnya di repo ini). "Jelajah Bumi" tebal oranye +
 * "International" gaya script teal, dengan lencana globe + rute penerbangan
 * sebagai ikon. Ganti isi <BrandIcon> dengan <img src="/logo-mark.png" />
 * begitu berkas logo asli (PNG/SVG) tersedia di folder public/.
 */
export function BrandIcon({ className = 'w-10 h-10' }) {
  return (
    <div className={`${className} rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 shadow-sm`}>
      <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" xmlns="http://www.w3.org/2000/svg">
        {/* Globe — garis lintang/bujur standar, bukan corat-coret bebas,
            supaya langsung terbaca sebagai bumi, bukan bentuk acak. */}
        <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="#fff" strokeWidth="1.1" opacity="0.55" />
        <line x1="3" y1="12" x2="21" y2="12" stroke="#fff" strokeWidth="1.1" opacity="0.55" />
        <path d="M4.3 8.2h15.4M4.3 15.8h15.4" stroke="#fff" strokeWidth="1.1" opacity="0.4" />
        {/* Rute penerbangan lengkung + titik tujuan — motif "jelajah". */}
        <path d="M5.5 15.5c3-4.5 7-6.5 13-7.5" stroke="#F0791A" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="5.5" cy="15.5" r="1.5" fill="#F0791A" />
        <circle cx="18.5" cy="8" r="1.5" fill="#fff" />
      </svg>
    </div>
  );
}

export function BrandWordmark({ size = 'base' }) {
  const l1 = size === 'lg' ? 'text-lg' : 'text-base';
  const l2 = size === 'lg' ? 'text-xl' : 'text-lg';
  return (
    <div className="leading-tight">
      <p className={`font-display font-bold text-orange-500 ${l1}`}>Jelajah Bumi</p>
      <p className={`-mt-1 ${l2}`} style={{ fontFamily: '"Segoe Script","Brush Script MT",cursive', color: '#0D8088' }}>
        International
      </p>
    </div>
  );
}
