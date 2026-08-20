import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rupiah, tanggalID } from '../lib/format';
import { StatusPil, STATUS_PENDAFTARAN } from '../components/ui';
import Kuitansi from '../components/Kuitansi';

export default function PortalJamaah() {
  const [rows, setRows] = useState([]);
  const [cicilanMap, setCicilanMap] = useState({}); // pendaftaran_id -> [cicilan]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cetakData, setCetakData] = useState(null);
  const cetakTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // RLS menyaring otomatis ke jamaah yang sedang login (lihat
    // sql/0009_portal_jamaah.sql) — tidak ada filter jamaah_id eksplisit
    // di sini karena tidak perlu.
    const { data: pendaftaranData, error: err } = await supabase
      .from('v_pendaftaran_status')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRows(pendaftaranData || []);

    const ids = (pendaftaranData || []).map((r) => r.id);
    if (ids.length > 0) {
      const { data: cicilanData } = await supabase
        .from('cicilan')
        .select('id, pendaftaran_id, nominal, tanggal, no_kuitansi, is_void')
        .in('pendaftaran_id', ids)
        .order('tanggal', { ascending: false });
      const peta = {};
      (cicilanData || []).forEach((c) => {
        if (!peta[c.pendaftaran_id]) peta[c.pendaftaran_id] = [];
        peta[c.pendaftaran_id].push(c);
      });
      setCicilanMap(peta);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!cetakData) return;
    cetakTimer.current = setTimeout(() => window.print(), 150);
    return () => clearTimeout(cetakTimer.current);
  }, [cetakData]);

  function cetakKuitansi(row, c) {
    const riwayat = cicilanMap[row.id] || [];
    const terbayarSebelum = riwayat
      .filter((x) => !x.is_void && x.tanggal <= c.tanggal && x.id !== c.id)
      .reduce((s, x) => s + Number(x.nominal), 0);
    setCetakData({
      noKuitansi: c.no_kuitansi,
      jamaahNama: row.jamaah_nama,
      paketNama: row.paket_nama,
      nominal: c.nominal,
      tanggal: c.tanggal,
      totalTagihan: row.total_tagihan,
      sisaSetelah: row.total_tagihan - terbayarSebelum - Number(c.nominal),
    });
  }

  if (loading) return <div className="text-sm text-ink-soft">Memuat...</div>;
  if (error) {
    return (
      <div className="card rounded-xl2 p-5 border-l-4 border-l-brick-500">
        <p className="font-semibold text-brick-600">Gagal memuat data</p>
        <p className="text-xs text-ink-soft mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 print:hidden">
        <h1 className="font-display text-2xl font-semibold">Portal Jamaah</h1>
        <p className="text-ink-soft text-sm mt-1">Status tagihan, cicilan, dan riwayat pembayaran Anda.</p>
      </div>

      {rows.length === 0 && (
        <div className="card rounded-xl2 p-10 text-center text-ink-soft text-sm print:hidden">
          Belum ada pendaftaran paket yang tercatat atas nama Anda.
        </div>
      )}

      <div className="space-y-5 print:hidden">
        {rows.map((row) => {
          const riwayat = cicilanMap[row.id] || [];
          return (
            <div key={row.id} className="card rounded-xl2 overflow-hidden">
              <div className="p-5 border-b border-rule flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold text-lg">{row.paket_nama}</h2>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {row.tanggal_berangkat ? `Berangkat ${tanggalID(row.tanggal_berangkat)}` : 'Tanggal berangkat belum ditentukan'}
                  </p>
                </div>
                <StatusPil peta={STATUS_PENDAFTARAN} nilai={row.computed_status} bawaan="BELUM_BAYAR" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 border-b border-rule">
                <div>
                  <p className="text-xs text-ink-soft font-medium">Total Tagihan</p>
                  <p className="tabular text-lg font-semibold mt-0.5">{rupiah(row.total_tagihan)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft font-medium">Sudah Dibayar</p>
                  <p className="tabular text-lg font-semibold mt-0.5 text-teal-700">{rupiah(row.terbayar)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft font-medium">Sisa {row.jatuh_tempo_berikutnya ? `(Jatuh tempo ${tanggalID(row.jatuh_tempo_berikutnya)})` : ''}</p>
                  <p className={`tabular text-lg font-semibold mt-0.5 ${Number(row.sisa) > 0 ? 'text-brick-600' : 'text-teal-700'}`}>{rupiah(Math.max(0, row.sisa))}</p>
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">Riwayat Pembayaran</p>
                {riwayat.length === 0 && <p className="text-sm text-ink-soft">Belum ada pembayaran tercatat.</p>}
                <div className="space-y-2">
                  {riwayat.map((c) => (
                    <div key={c.id} className={`flex items-center justify-between border-b border-rule pb-2 ${c.is_void ? 'opacity-50' : ''}`}>
                      <div>
                        <p className="text-sm font-medium tabular">{rupiah(c.nominal)}</p>
                        <p className="text-[11px] text-ink-soft">{tanggalID(c.tanggal)} · {c.no_kuitansi}{c.is_void && ' · Dibatalkan'}</p>
                      </div>
                      {!c.is_void && (
                        <button type="button" onClick={() => cetakKuitansi(row, c)} className="text-xs font-semibold text-accent-text hover:underline shrink-0">
                          Cetak Kuitansi
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Kuitansi data={cetakData} />
    </div>
  );
}
