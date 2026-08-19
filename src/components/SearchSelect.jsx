import { useState, useEffect, useRef } from 'react';

/**
 * Combobox cari-lalu-pilih — pengganti <select> polos untuk daftar yang bisa
 * membengkak ke ratusan/ribuan baris (agen, jamaah). Dropdown native tidak
 * punya cara mencari selain men-scroll; ini mengetik untuk menyaring.
 *
 * Dua mode, dipilih lewat prop mana yang diisi:
 *  - `options`      -> menyaring array yang sudah ada di memori (client-side).
 *    Cocok untuk daftar yang memang perlu ditarik penuh untuk keperluan lain
 *    juga (mis. paket/vendor — biasanya puluhan, dan datanya sudah dipakai
 *    untuk hal lain di halaman yang sama).
 *  - `fetchOptions` -> query ke server tiap ketikan berhenti (di-debounce
 *    300ms). Cocok untuk daftar yang tidak dibatasi jumlahnya (agen, jamaah)
 *    — supaya tidak perlu menarik seluruh tabel ke browser hanya untuk
 *    mengisi satu dropdown.
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  fetchOptions,
  placeholder = 'Ketik untuk mencari...',
  emptyLabel = '— Tidak dipilih —',
  allowEmpty = true,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const selectedLabel = !value ? '' : (
    options?.find((o) => o.value === value)?.label
    || results.find((o) => o.value === value)?.label
    || ''
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (fetchOptions) {
      setLoading(true);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const r = await fetchOptions(query);
        if (!cancelled) { setResults(r); setLoading(false); setHighlight(-1); }
      }, 300);
    } else {
      const q = query.trim().toLowerCase();
      setResults(!q ? (options || []) : (options || []).filter((o) => o.label.toLowerCase().includes(q)));
      setHighlight(-1);
    }
    return () => { cancelled = true; clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, fetchOptions, options]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function pick(opt) {
    onChange(opt ? opt.value : '');
    setQuery('');
    setOpen(false);
  }

  const list = allowEmpty ? [{ value: '', label: emptyLabel }, ...results] : results;

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[highlight]) pick(list[highlight].value ? list[highlight] : null); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        disabled={disabled}
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="field w-full rounded-md2 px-4 py-2.5 text-sm"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-md2 border border-rule bg-paper-raised shadow-card">
          {loading && <div className="px-4 py-2.5 text-sm text-ink-soft">Mencari...</div>}
          {!loading && list.length === 0 && (
            <div className="px-4 py-2.5 text-sm text-ink-soft">Tidak ditemukan.</div>
          )}
          {!loading && list.map((o, i) => (
            <button
              key={o.value || '__kosong__'}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(o.value ? o : null); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-accent-soft ${i === highlight ? 'bg-accent-soft' : ''} ${!o.value ? 'text-ink-soft' : ''}`}
            >
              <span className="block">{o.label}</span>
              {o.sub && <span className="block text-[11px] text-ink-soft">{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
