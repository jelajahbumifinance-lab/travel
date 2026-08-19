/**
 * Logo asli JBI (public/logo-icon.png — dipotong dari logo lengkap yang
 * dikirim langsung, public/logo-full.png). Bukan lagi rekaan SVG.
 */
export function BrandIcon({ className = 'w-10 h-10' }) {
  return (
    <img
      src="/logo-icon.png"
      alt="Jelajah Bumi International"
      className={`${className} object-contain shrink-0`}
    />
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
