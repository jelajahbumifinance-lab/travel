import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah } from '../lib/format';
import { Pil, Aksi } from '../components/ui';
import { StatTile, WARNA_STAT, IconUsers, IconCheckCircle } from '../components/StatTile';

const JENIS_MITRA_LABEL = { INDIVIDU: 'Individu', PERUSAHAAN: 'Perusahaan' };

export default function Agen() {
  const { profile } = useAuth();
  // Kasir boleh melihat daftar ini untuk konteks, tapi mengaktifkan/
  // menonaktifkan akun dan mengubah profil tetap wewenang admin_keuangan/
  // direktur — RLS (profiles_update_admin) sudah menegakkan ini juga.
  const canManage = ['direktur', 'admin_keuangan'].includes(profile?.role);
  const [agenList, setAgenList] = useState([]);
  const [jumlahJamaah, setJumlahJamaah] = useState({});
  const [komisiAgregat, setKomisiAgregat] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prosesId, setProsesId] = useState(null);

  const [detailTarget, setDetailTarget] = useState(null);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [agenRes, jamaahRes, komisiRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'agen').order('full_name'),
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

  function openDetail(a) {
    setDetailTarget(a);
    setForm({
      full_name: a.full_name || '',
      phone: a.phone || '',
      alamat: a.alamat || '',
      nik: a.nik || '',
      jenis_mitra: a.jenis_mitra || 'INDIVIDU',
      nama_perusahaan: a.nama_perusahaan || '',
      npwp: a.npwp || '',
      nama_bank: a.nama_bank || '',
      nomor_rekening: a.nomor_rekening || '',
      nama_pemilik_rekening: a.nama_pemilik_rekening || '',
    });
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.full_name.trim()) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      alamat: form.alamat.trim() || null,
      nik: form.nik.trim() || null,
      jenis_mitra: form.jenis_mitra,
      nama_perusahaan: form.jenis_mitra === 'PERUSAHAAN' ? (form.nama_perusahaan.trim() || null) : null,
      npwp: form.npwp.trim() || null,
      nama_bank: form.nama_bank.trim() || null,
      nomor_rekening: form.nomor_rekening.trim() || null,
      nama_pemilik_rekening: form.nama_pemilik_rekening.trim() || null,
    };
    const { error: err } = await supabase.from('profiles').update(payload).eq('id', detailTarget.id);
    setSaving(false);
    if (err) { setFormError(err.message); return; }
    setDetailTarget(null);
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Agen &amp; Mitra</h1>
        <p className="text-ink-soft text-sm mt-1">Semua agen yang terdaftar — baik lewat pendaftaran mandiri maupun Undang Staf.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <StatTile warna={WARNA_STAT.sky} Icon={IconUsers} label="Total Agen" value={ringkasan.total} />
        <StatTile warna={WARNA_STAT.teal} Icon={IconCheckCircle} label="Aktif" value={ringkasan.aktif} />
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
                <th className="p-4 whitespace-nowrap">Rekening</th>
                <th className="p-4 whitespace-nowrap text-center">Jamaah</th>
                <th className="p-4 whitespace-nowrap text-right">Komisi Akrual</th>
                <th className="p-4 whitespace-nowrap text-right">Komisi Cair</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={8} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && agenList.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-ink-soft">Belum ada agen terdaftar.</td></tr>
              )}
              {agenList.map((a) => {
                const komisi = komisiAgregat[a.id] || { akrual: 0, cair: 0 };
                return (
                  <tr key={a.id} className={!a.is_active ? 'opacity-60' : ''}>
                    <td className="p-4">
                      <button type="button" onClick={() => openDetail(a)} className="font-medium text-accent-text hover:underline text-left">
                        {a.full_name}
                      </button>
                      {a.jenis_mitra && <p className="text-[11px] text-ink-soft">{JENIS_MITRA_LABEL[a.jenis_mitra]}{a.nama_perusahaan ? ` · ${a.nama_perusahaan}` : ''}</p>}
                    </td>
                    <td className="p-4 text-ink-soft">
                      <p>{a.email || '-'}</p>
                      <p className="text-[11px]">{a.phone || '-'}</p>
                    </td>
                    <td className="p-4 text-ink-soft">
                      {a.nomor_rekening ? (
                        <>
                          <p>{a.nama_bank || '-'}</p>
                          <p className="text-[11px] tabular">{a.nomor_rekening}</p>
                        </>
                      ) : (
                        <Pil nada="warn">Belum diisi</Pil>
                      )}
                    </td>
                    <td className="p-4 text-center tabular">{jumlahJamaah[a.id] || 0}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-orange-600">{rupiah(komisi.akrual)}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(komisi.cair)}</td>
                    <td className="p-4 text-center">
                      <Pil nada={a.is_active ? 'ok' : 'warn'}>{a.is_active ? 'Aktif' : 'Menunggu/Nonaktif'}</Pil>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      {canManage && (
                        <Aksi jenis={a.is_active ? 'bahaya' : 'utama'} onClick={() => toggleAktif(a)} disabled={prosesId === a.id}>
                          {a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </Aksi>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailTarget && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Profil — {detailTarget.full_name}</h2>
              <button type="button" onClick={() => setDetailTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <fieldset disabled={!canManage} className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Lengkap</label>
                  <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Email</label>
                  <input type="text" value={detailTarget.email || '-'} disabled className="field w-full rounded-md2 px-4 py-2.5 text-sm opacity-60" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP / WhatsApp</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Alamat</label>
                  <textarea rows={2} value={form.alamat} onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">NIK</label>
                  <input type="text" inputMode="numeric" value={form.nik} onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value.replace(/\D/g, '') }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Mitra</label>
                  <select value={form.jenis_mitra} onChange={(e) => setForm((f) => ({ ...f, jenis_mitra: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                    {Object.entries(JENIS_MITRA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {form.jenis_mitra === 'PERUSAHAAN' && (
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Perusahaan</label>
                    <input type="text" value={form.nama_perusahaan} onChange={(e) => setForm((f) => ({ ...f, nama_perusahaan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">NPWP</label>
                  <input type="text" value={form.npwp} onChange={(e) => setForm((f) => ({ ...f, npwp: e.target.value }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>

                <div className="pt-2 border-t border-rule">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">Rekening Pencairan Komisi</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Bank</label>
                      <input type="text" value={form.nama_bank} onChange={(e) => setForm((f) => ({ ...f, nama_bank: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nomor Rekening</label>
                      <input type="text" value={form.nomor_rekening} onChange={(e) => setForm((f) => ({ ...f, nomor_rekening: e.target.value.replace(/\D/g, '') }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Pemilik Rekening</label>
                      <input type="text" value={form.nama_pemilik_rekening} onChange={(e) => setForm((f) => ({ ...f, nama_pemilik_rekening: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                    </div>
                  </div>
                </div>

                {formError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>}
                {canManage && (
                  <button type="submit" disabled={saving} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                    {saving ? 'Menyimpan...' : 'Simpan perubahan'}
                  </button>
                )}
              </form>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
}
