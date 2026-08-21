import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const JENIS_MITRA_LABEL = { INDIVIDU: 'Individu', PERUSAHAAN: 'Perusahaan' };

const PROFIL_KOSONG = {
  full_name: '', phone: '', alamat: '', nik: '', jenis_mitra: 'INDIVIDU', nama_perusahaan: '', npwp: '',
  nama_bank: '', nomor_rekening: '', nama_pemilik_rekening: '',
};

export default function PortalAgenProfil() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profilForm, setProfilForm] = useState(PROFIL_KOSONG);
  const [profilError, setProfilError] = useState('');
  const [savingProfil, setSavingProfil] = useState(false);
  const [tersimpan, setTersimpan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setProfilForm({
      full_name: data?.full_name || '',
      phone: data?.phone || '',
      alamat: data?.alamat || '',
      nik: data?.nik || '',
      jenis_mitra: data?.jenis_mitra || 'INDIVIDU',
      nama_perusahaan: data?.nama_perusahaan || '',
      npwp: data?.npwp || '',
      nama_bank: data?.nama_bank || '',
      nomor_rekening: data?.nomor_rekening || '',
      nama_pemilik_rekening: data?.nama_pemilik_rekening || '',
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmitProfil(e) {
    e.preventDefault();
    setProfilError('');
    setTersimpan(false);
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
    setTersimpan(true);
    refreshProfile();
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
    <div className="w-full max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Profil Saya</h1>
        <p className="text-ink-soft text-sm mt-1">Data ini dilihat admin JBI untuk mengenal mitra dan mencairkan komisi.</p>
      </div>

      <div className="card rounded-xl2 p-6">
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
          {tersimpan && !profilError && <p className="text-xs font-semibold text-teal-700 bg-teal-100 rounded-md2 px-3 py-2">Profil tersimpan.</p>}
          <button type="submit" disabled={savingProfil} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
            {savingProfil ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </form>
      </div>
    </div>
  );
}
