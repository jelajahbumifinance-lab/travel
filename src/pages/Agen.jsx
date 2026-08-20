import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah } from '../lib/format';
import { Pil, Aksi } from '../components/ui';

export default function Agen() {
  const { profile } = useAuth();
  // Kasir boleh melihat daftar ini untuk konteks, tapi mengaktifkan/
  // menonaktifkan akun tetap wewenang admin_keuangan/direktur — RLS
  // (profiles_update_admin) sudah menegakkan ini juga di database.
  const canManage = ['direktur', 'admin_keuangan'].includes(profile?.role);
  const [agenList, setAgenList] = useState([]);
  const [jumlahJamaah, setJumlahJamaah] = useState({});
  const [komisiAgregat, setKomisiAgregat] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prosesId, setProsesId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [agenRes, jamaahRes, komisiRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone, is_active, created_at').eq('role', 'agen').order('full_name'),
      supabase.from('jamaah').select('agen_id').not('agen_id', 'is', null),
      supabase.from('v_komisi_agen').select('agen_id, nominal, status'),
    ]);
    if (agenRes.error || jamaahRes.error || komisiRes.error) {
      setError(agenRes.error?.message || jamaahRes.error?.message || komisiRes.error?.message);
      setLoading(false);
      return;
    }
    setAgenList(agenRes.data || []);

    const petaJamaah = {};
    (jamaahRes.data || []).forEach((j) => { petaJamaah[j.agen_id] = (petaJamaah[j.agen_id] || 0) + 1; });
    setJumlahJamaah(petaJamaah);

    const petaKomisi = {};
    (komisiRes.data || []).forEach((k) => {
      if (!petaKomisi[k.agen_id]) petaKomisi[k.agen_id] = { akrual: 0, cair: 0 };
      if (k.status === 'AKRUAL') petaKomisi[k.agen_id].akrual += Number(k.nominal);
      if (k.status === 'CAIR') petaKomisi[k.agen_id].cair += Number(k.nominal);
    });
    setKomisiAgregat(petaKomisi);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ringkasan = useMemo(() => ({
    total: agenList.length,
    aktif: agenList.filter((a) => a.is_active).length,
  }), [agenList]);

  async function toggleAktif(a) {
    const aksiTeks = a.is_active ? 'menonaktifkan' : 'mengaktifkan';
    if (!window.confirm(`Yakin ${aksiTeks} akun agen "${a.full_name}"?`)) return;
    setProsesId(a.id);
    const { error: err } = await supabase.from('profiles').update({ is_active: !a.is_active }).eq('id', a.id);
    setProsesId(null);
    if (err) { window.alert('Gagal: ' + err.message); return; }
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Agen &amp; Mitra</h1>
        <p className="text-ink-soft text-sm mt-1">Semua agen yang terdaftar — baik lewat pendaftaran mandiri maupun Undang Staf.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Total Agen</p>
          <p className="tabular text-xl font-semibold mt-0.5">{ringkasan.total}</p>
        </div>
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Aktif</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-teal-700">{ringkasan.aktif}</p>
        </div>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Nama</th>
                <th className="p-4">Kontak</th>
                <th className="p-4 whitespace-nowrap text-center">Jamaah</th>
                <th className="p-4 whitespace-nowrap text-right">Komisi Akrual</th>
                <th className="p-4 whitespace-nowrap text-right">Komisi Cair</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                {canManage && <th className="p-4 whitespace-nowrap text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={canManage ? 7 : 6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && agenList.length === 0 && (
                <tr><td colSpan={canManage ? 7 : 6} className="p-10 text-center text-ink-soft">Belum ada agen terdaftar.</td></tr>
              )}
              {agenList.map((a) => {
                const komisi = komisiAgregat[a.id] || { akrual: 0, cair: 0 };
                return (
                  <tr key={a.id} className={!a.is_active ? 'opacity-60' : ''}>
                    <td className="p-4 font-medium">{a.full_name}</td>
                    <td className="p-4 text-ink-soft">
                      <p>{a.email || '-'}</p>
                      <p className="text-[11px]">{a.phone || '-'}</p>
                    </td>
                    <td className="p-4 text-center tabular">{jumlahJamaah[a.id] || 0}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-orange-600">{rupiah(komisi.akrual)}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(komisi.cair)}</td>
                    <td className="p-4 text-center">
                      <Pil nada={a.is_active ? 'ok' : 'warn'}>{a.is_active ? 'Aktif' : 'Menunggu/Nonaktif'}</Pil>
                    </td>
                    {canManage && (
                      <td className="p-4 text-center whitespace-nowrap">
                        <Aksi jenis={a.is_active ? 'bahaya' : 'utama'} onClick={() => toggleAktif(a)} disabled={prosesId === a.id}>
                          {a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </Aksi>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
