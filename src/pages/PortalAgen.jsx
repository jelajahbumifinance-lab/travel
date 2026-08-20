import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID } from '../lib/format';
import { StatusPil, STATUS_PENDAFTARAN, STATUS_KOMISI } from '../components/ui';

const JENIS_MITRA_LABEL = { INDIVIDU: 'Individu', PERUSAHAAN: 'Perusahaan' };

const PROFIL_KOSONG = {
  full_name: '', phone: '', alamat: '', nik: '', jenis_mitra: 'INDIVIDU', nama_perusahaan: '', npwp: '',
  nama_bank: '', nomor_rekening: '', nama_pemilik_rekening: '',
};

export default function PortalAgen() {
  const { user, refreshProfile } = useAuth();
  const [jamaahRows, setJamaahRows] = useState([]);
  const [komisiRows, setKomisiRows] = useState([]);
  const [profilLengkap, setProfilLengkap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showProfilForm, setShowProfilForm] = useState(false);
  const [profilForm, setProfilForm] = useState(PROFIL_KOSONG);
  const [profilError, setProfilError] = useState('');
  const [savingProfil, setSavingProfil] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // RLS menyaring keduanya otomatis ke baris milik agen yang sedang login —
    // tidak ada filter agen_id eksplisit di query karena tidak perlu:
    // sql/0004_komisi_agen.sql bagian 6 sudah membatasinya di level database.
    const [pendaftaranRes, komisiRes, profilRes] = await Promise.all([
      supabase.from('v_pendaftaran_status').select('*').order('created_at', { ascending: false }),
      supabase.from('v_komisi_agen').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    ]);
    if (pendaftaranRes.error || komisiRes.error || profilRes.error) {
      setError(pendaftaranRes.error?.message || komisiRes.error?.message || profilRes.error?.message);
      setLoading(false);
      return;
    }
    setJamaahRows(pendaftaranRes.data || []);
    setKomisiRows(komisiRes.data || []);
    setProfilLengkap(profilRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function openEditProfil() {
    setProfilForm({
      full_name: profilLengkap.full_name || '',
      phone: profilLengkap.phone || '',
      alamat: profilLengkap.alamat || '',
      nik: profilLengkap.nik || '',
      jenis_mitra: profilLengkap.jenis_mitra || 'INDIVIDU',
      nama_perusahaan: profilLengkap.nama_perusahaan || '',
      npwp: profilLengkap.npwp || '',
      nama_bank: profilLengkap.nama_bank || '',
      nomor_rekening: profilLengkap.nomor_rekening || '',
      nama_pemilik_rekening: profilLengkap.nama_pemilik_rekening || '',
    });
    setProfilError('');
    setShowProfilForm(true);
  }

  async function handleSubmitProfil(e) {
    e.preventDefault();
    setProfilError('');
    if (!profilForm.full_name.trim()) {
      setProfilError('Nama lengkap wajib diisi.');
      return;
    }
    setSavingProfil(true);
    const payload = {
      full_name: profilForm.full_name.trim(),
      phone: profilForm.phone.trim() || null,
      alamat: profilForm.alamat.trim() || null,
      nik: profilForm.nik.trim() || null,
      jenis_mitra: profilForm.jenis_mitra,
      nama_perusahaan: profilForm.jenis_mitra === 'PERUSAHAAN' ? (profilForm.nama_perusahaan.trim() || null) : null,
      npwp: profilForm.npwp.trim() || null,
      nama_bank: profilForm.nama_bank.trim() || null,
      nomor_rekening: profilForm.nomor_rekening.trim() || null,
      nama_pemilik_rekening: profilForm.nama_pemilik_rekening.trim() || null,
    };
    // role/is_active/jamaah_id sengaja tidak dikirim — trigger database
    // (fn_jaga_kolom_sensitif_profiles) akan mengabaikannya kalaupun
    // dikirim, jadi kolom itu tidak pernah bisa diubah lewat form ini.
    const { error: err } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setSavingProfil(false);
    if (err) {
      setProfilError(err.message);
      return;
    }
    setShowProfilForm(false);
    refreshProfile();
    load();
  }

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

  const rekeningBelumDiisi = !profilLengkap?.nomor_rekening;

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Portal Agen</h1>
          <p className="text-ink-soft text-sm mt-1">Jamaah yang Anda daftarkan dan komisi Anda.</p>
        </div>
        <button type="button" onClick={openEditProfil} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
          Lengkapi Profil
        </button>
      </div>

      {rekeningBelumDiisi && (
        <div className="card rounded-xl2 p-4 mb-6 border-l-4 border-l-accent text-sm">
          <b>Nomor rekening belum diisi.</b> Lengkapi profil Anda supaya admin JBI tahu ke mana komisi harus dicairkan.
        </div>
      )}

      <div className="card rounded-xl2 p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">Profil Saya</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">Nama</span><span>{profilLengkap?.full_name || '-'}</span></div>
          <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">No. HP</span><span>{profilLengkap?.phone || '-'}</span></div>
          <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">Jenis Mitra</span><span>{JENIS_MITRA_LABEL[profilLengkap?.jenis_mitra] || '-'}</span></div>
          {profilLengkap?.jenis_mitra === 'PERUSAHAAN' && (
            <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">Nama Perusahaan</span><span>{profilLengkap?.nama_perusahaan || '-'}</span></div>
          )}
          <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">NIK</span><span className="tabular">{profilLengkap?.nik || '-'}</span></div>
          <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">NPWP</span><span className="tabular">{profilLengkap?.npwp || '-'}</span></div>
          <div className="sm:col-span-2 flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">Alamat</span><span className="text-right">{profilLengkap?.alamat || '-'}</span></div>
          <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">Bank</span><span>{profilLengkap?.nama_bank || '-'}</span></div>
          <div className="flex justify-between border-b border-rule py-1.5"><span className="text-ink-soft">No. Rekening</span><span className="tabular">{profilLengkap?.nomor_rekening || '-'}</span></div>
          <div className="sm:col-span-2 flex justify-between py-1.5"><span className="text-ink-soft">Nama Pemilik Rekening</span><span>{profilLengkap?.nama_pemilik_rekening || '-'}</span></div>
        </div>
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

      {showProfilForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowProfilForm(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Lengkapi Profil</h2>
              <button type="button" onClick={() => setShowProfilForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmitProfil} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Lengkap</label>
                <input type="text" value={profilForm.full_name} onChange={(e) => setProfilForm((f) => ({ ...f, full_name: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP / WhatsApp</label>
                <input type="text" value={profilForm.phone} onChange={(e) => setProfilForm((f) => ({ ...f, phone: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Alamat</label>
                <textarea rows={2} value={profilForm.alamat} onChange={(e) => setProfilForm((f) => ({ ...f, alamat: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">NIK</label>
                <input type="text" inputMode="numeric" value={profilForm.nik} onChange={(e) => setProfilForm((f) => ({ ...f, nik: e.target.value.replace(/\D/g, '') }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Mitra</label>
                <select value={profilForm.jenis_mitra} onChange={(e) => setProfilForm((f) => ({ ...f, jenis_mitra: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  {Object.entries(JENIS_MITRA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {profilForm.jenis_mitra === 'PERUSAHAAN' && (
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Perusahaan</label>
                  <input type="text" value={profilForm.nama_perusahaan} onChange={(e) => setProfilForm((f) => ({ ...f, nama_perusahaan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">NPWP (opsional)</label>
                <input type="text" value={profilForm.npwp} onChange={(e) => setProfilForm((f) => ({ ...f, npwp: e.target.value }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>

              <div className="pt-2 border-t border-rule">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">Rekening Pencairan Komisi</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Bank</label>
                    <input type="text" placeholder="mis. BSI, BCA, Mandiri" value={profilForm.nama_bank} onChange={(e) => setProfilForm((f) => ({ ...f, nama_bank: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nomor Rekening</label>
                    <input type="text" value={profilForm.nomor_rekening} onChange={(e) => setProfilForm((f) => ({ ...f, nomor_rekening: e.target.value.replace(/\D/g, '') }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Pemilik Rekening</label>
                    <input type="text" value={profilForm.nama_pemilik_rekening} onChange={(e) => setProfilForm((f) => ({ ...f, nama_pemilik_rekening: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                    <p className="text-[11px] text-ink-soft mt-1">Isi kalau rekening bukan atas nama sendiri.</p>
                  </div>
                </div>
              </div>

              {profilError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{profilError}</p>}
              <button type="submit" disabled={savingProfil} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingProfil ? 'Menyimpan...' : 'Simpan profil'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
