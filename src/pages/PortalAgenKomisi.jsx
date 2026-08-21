import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rupiah, tanggalID } from '../lib/format';
import { StatusPil, STATUS_KOMISI, Aksi } from '../components/ui';

export default function PortalAgenKomisi() {
  const [komisiRows, setKomisiRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mengajukanId, setMengajukanId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('v_komisi_agen').select('*').order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setKomisiRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function ajukanPencairan(k) {
    if (!window.confirm(`Ajukan pencairan komisi ${rupiah(k.nominal)} untuk ${k.jamaah_nama}? Admin JBI akan memprosesnya.`)) return;
    setMengajukanId(k.id);
    const { error: err } = await supabase.rpc('ajukan_pencairan_komisi', { p_komisi_id: k.id });
    setMengajukanId(null);
    if (err) { window.alert('Gagal mengajukan: ' + err.message); return; }
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Komisi Saya</h1>
        <p className="text-ink-soft text-sm mt-1">Komisi dari jamaah yang Anda daftarkan.</p>
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
                <th className="p-4 whitespace-nowrap text-right">Nominal</th>
                <th className="p-4 whitespace-nowrap text-center">Tanggal</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && komisiRows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Belum ada komisi tercatat.</td></tr>
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
                  <td className="p-4 text-center whitespace-nowrap">
                    {k.status === 'AKRUAL' && k.jamaah_lunas && (
                      <Aksi jenis="utama" onClick={() => ajukanPencairan(k)} disabled={mengajukanId === k.id}>
                        {mengajukanId === k.id ? '...' : 'Ajukan Pencairan'}
                      </Aksi>
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
