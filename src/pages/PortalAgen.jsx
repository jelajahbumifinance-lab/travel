import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rupiah, tanggalID } from '../lib/format';
import { StatusPil, STATUS_PENDAFTARAN, STATUS_KOMISI } from '../components/ui';

export default function PortalAgen() {
  const [jamaahRows, setJamaahRows] = useState([]);
  const [komisiRows, setKomisiRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // RLS menyaring keduanya otomatis ke baris milik agen yang sedang login —
    // tidak ada filter agen_id eksplisit di query karena tidak perlu:
    // sql/0004_komisi_agen.sql bagian 6 sudah membatasinya di level database.
    const [pendaftaranRes, komisiRes] = await Promise.all([
      supabase.from('v_pendaftaran_status').select('*').order('created_at', { ascending: false }),
      supabase.from('v_komisi_agen').select('*').order('created_at', { ascending: false }),
    ]);
    if (pendaftaranRes.error || komisiRes.error) {
      setError(pendaftaranRes.error?.message || komisiRes.error?.message);
      setLoading(false);
      return;
    }
    setJamaahRows(pendaftaranRes.data || []);
    setKomisiRows(komisiRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalAkrual = komisiRows.filter((k) => k.status === 'AKRUAL').reduce((s, k) => s + Number(k.nominal), 0);
  const totalCair = komisiRows.filter((k) => k.status === 'CAIR').reduce((s, k) => s + Number(k.nominal), 0);

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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Portal Agen</h1>
        <p className="text-ink-soft text-sm mt-1">Jamaah yang Anda daftarkan dan komisi Anda.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Komisi Belum Cair</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-orange-600">{rupiah(totalAkrual)}</p>
        </div>
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Komisi Sudah Cair</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-teal-700">{rupiah(totalCair)}</p>
        </div>
      </div>

      <h2 className="font-display font-semibold mb-3">Jamaah Saya</h2>
      <div className="card rounded-xl2 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Jamaah</th>
                <th className="p-4 whitespace-nowrap">Paket</th>
                <th className="p-4 whitespace-nowrap text-right">Total</th>
                <th className="p-4 whitespace-nowrap text-right">Sisa</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {jamaahRows.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-ink-soft">Belum ada jamaah yang Anda daftarkan.</td></tr>
              )}
              {jamaahRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-4 font-medium">{r.jamaah_nama}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{r.paket_nama}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(r.total_tagihan)}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap font-semibold">{rupiah(Math.max(0, r.sisa))}</td>
                  <td className="p-4 text-center"><StatusPil peta={STATUS_PENDAFTARAN} nilai={r.computed_status} bawaan="BELUM_BAYAR" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="font-display font-semibold mb-3">Komisi Saya</h2>
      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Jamaah</th>
                <th className="p-4 whitespace-nowrap">Paket</th>
                <th className="p-4 whitespace-nowrap text-right">Nominal</th>
                <th className="p-4 whitespace-nowrap text-center">Tanggal</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {komisiRows.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-ink-soft">Belum ada komisi tercatat.</td></tr>
              )}
              {komisiRows.map((k) => (
                <tr key={k.id} className={k.status === 'BATAL' ? 'opacity-50' : ''}>
                  <td className="p-4 font-medium">{k.jamaah_nama}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{k.paket_nama}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(k.nominal)}</td>
                  <td className="p-4 text-center whitespace-nowrap text-ink-soft">{tanggalID(k.created_at)}</td>
                  <td className="p-4 text-center">
                    <StatusPil peta={STATUS_KOMISI} nilai={k.status} bawaan="AKRUAL" />
                    {k.status === 'AKRUAL' && !k.jamaah_lunas && (
                      <p className="text-[10px] text-ink-soft mt-1">Menunggu jamaah lunas</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
