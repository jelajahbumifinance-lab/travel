import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rupiah, tanggalID } from '../lib/format';
import { unduhCSV } from '../lib/csv';
import { StatusPil, STATUS_PENDAFTARAN, Aksi } from '../components/ui';

export default function PortalAgenJamaah() {
  const [jamaahRows, setJamaahRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [riwayatTarget, setRiwayatTarget] = useState(null);
  const [riwayatRows, setRiwayatRows] = useState([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // RLS menyaring otomatis ke baris milik agen yang sedang login —
    // lihat sql/0004_komisi_agen.sql bagian 6.
    const { data, error: err } = await supabase.from('v_pendaftaran_status').select('*').order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setJamaahRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function bukaRiwayat(row) {
    setRiwayatTarget(row);
    setRiwayatLoading(true);
    const { data } = await supabase
      .from('cicilan')
      .select('id, nominal, tanggal, no_kuitansi, is_void')
      .eq('pendaftaran_id', row.id)
      .order('tanggal', { ascending: false });
    setRiwayatRows(data || []);
    setRiwayatLoading(false);
  }

  function eksporLaporan() {
    unduhCSV(
      'laporan-agen.csv',
      ['Jamaah', 'Paket', 'Total Tagihan', 'Sisa', 'Status Pendaftaran'],
      jamaahRows.map((r) => [r.jamaah_nama, r.paket_nama, r.total_tagihan, r.sisa, r.computed_status])
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Jamaah Saya</h1>
          <p className="text-ink-soft text-sm mt-1">Jamaah yang sudah terdaftar lewat Anda.</p>
        </div>
        <button type="button" onClick={eksporLaporan} className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-2 px-4 rounded-md2 text-sm">
          ⭳ Ekspor Laporan
        </button>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Jamaah</th>
                <th className="p-4 whitespace-nowrap">Paket</th>
                <th className="p-4 whitespace-nowrap text-right">Total</th>
                <th className="p-4 whitespace-nowrap text-right">Sisa</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Riwayat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && jamaahRows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Belum ada jamaah yang Anda daftarkan.</td></tr>
              )}
              {jamaahRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-4 font-medium">{r.jamaah_nama}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{r.paket_nama}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(r.total_tagihan)}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap font-semibold">{rupiah(Math.max(0, r.sisa))}</td>
                  <td className="p-4 text-center"><StatusPil peta={STATUS_PENDAFTARAN} nilai={r.computed_status} bawaan="BELUM_BAYAR" /></td>
                  <td className="p-4 text-center"><Aksi onClick={() => bukaRiwayat(r)}>Lihat</Aksi></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {riwayatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setRiwayatTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold">Riwayat Pembayaran</h2>
                <p className="text-xs text-ink-soft mt-0.5">{riwayatTarget.jamaah_nama} — {riwayatTarget.paket_nama}</p>
              </div>
              <button type="button" onClick={() => setRiwayatTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            {riwayatLoading && <p className="text-sm text-ink-soft">Memuat...</p>}
            {!riwayatLoading && riwayatRows.length === 0 && <p className="text-sm text-ink-soft">Belum ada pembayaran tercatat.</p>}
            {!riwayatLoading && riwayatRows.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {riwayatRows.map((c) => (
                  <div key={c.id} className={`flex items-center justify-between border-b border-rule pb-2 ${c.is_void ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-sm font-medium tabular">{rupiah(c.nominal)}</p>
                      <p className="text-[11px] text-ink-soft">{tanggalID(c.tanggal)} · {c.no_kuitansi}{c.is_void && ' · Dibatalkan'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
