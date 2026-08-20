import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { rupiah } from '../lib/format';

/**
 * Notifikasi dihitung langsung dari data yang sudah ada (piutang lewat
 * tempo, komisi siap cair) — bukan tabel notifikasi terpisah yang perlu
 * dijaga tetap sinkron. Selalu akurat karena bukan salinan, dan RLS yang
 * sudah ada otomatis membatasi apa yang terlihat per peran (mis. kasir
 * tidak akan pernah melihat notifikasi komisi karena memang tidak boleh
 * membaca tabel itu).
 *
 * PRD Bagian 7 (Modul 09) juga menyebut pengingat lewat WhatsApp —
 * itu butuh kredensial WhatsApp Business API yang belum tersedia,
 * jadi belum diimplementasikan. Bel ini adalah bagian in-app-nya.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [piutang, setPiutang] = useState([]);
  const [komisi, setKomisi] = useState([]);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [piutangRes, komisiRes] = await Promise.all([
      supabase.from('v_pendaftaran_status').select('id, jamaah_nama, sisa, jatuh_tempo_berikutnya').eq('computed_status', 'LEWAT_TEMPO'),
      supabase.from('v_komisi_agen').select('id, agen_nama, nominal').eq('status', 'AKRUAL').eq('jamaah_lunas', true),
    ]);
    setPiutang(piutangRes.data || []);
    setKomisi(komisiRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const total = piutang.length + komisi.length;

  function bukaHalaman(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        aria-label="Notifikasi"
        className="relative w-9 h-9 rounded-full hover:bg-accent-soft flex items-center justify-center text-ink-soft"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
          <path d="M6 8.5a6 6 0 0 1 12 0c0 4.2 1.2 6 2 6.5H4c.8-.5 2-2.3 2-6.5Z" />
          <path d="M10 18.5a2 2 0 0 0 4 0" />
        </svg>
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-brick-500 text-white text-[10px] font-bold flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-md2 border border-rule bg-paper-raised shadow-card z-30">
          {loading && <p className="p-4 text-sm text-ink-soft">Memuat...</p>}
          {!loading && total === 0 && <p className="p-4 text-sm text-ink-soft">Tidak ada notifikasi.</p>}

          {!loading && piutang.length > 0 && (
            <div className="p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brick-600 px-1 mb-1.5">Piutang Lewat Tempo</p>
              {piutang.slice(0, 5).map((p) => (
                <button key={p.id} type="button" onClick={() => bukaHalaman('/tagihan')} className="w-full text-left px-2 py-2 rounded-md2 hover:bg-accent-soft text-sm">
                  <span className="font-medium block">{p.jamaah_nama}</span>
                  <span className="text-[11px] text-ink-soft">Sisa {rupiah(p.sisa)}</span>
                </button>
              ))}
              {piutang.length > 5 && <p className="text-[11px] text-ink-soft px-2 mt-1">+{piutang.length - 5} lainnya</p>}
            </div>
          )}

          {!loading && komisi.length > 0 && (
            <div className="p-3 border-t border-rule">
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 px-1 mb-1.5">Komisi Siap Cair</p>
              {komisi.slice(0, 5).map((k) => (
                <button key={k.id} type="button" onClick={() => bukaHalaman('/komisi')} className="w-full text-left px-2 py-2 rounded-md2 hover:bg-accent-soft text-sm">
                  <span className="font-medium block">{k.agen_nama}</span>
                  <span className="text-[11px] text-ink-soft">{rupiah(k.nominal)}</span>
                </button>
              ))}
              {komisi.length > 5 && <p className="text-[11px] text-ink-soft px-2 mt-1">+{komisi.length - 5} lainnya</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
