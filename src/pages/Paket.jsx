import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID, formatRibuan } from '../lib/format';
import { Aksi, GrupAksi, Pil } from '../components/ui';

const JENIS_LABEL = {
  UMRAH: 'Umrah',
  HAJI: 'Haji',
  TOUR_DOMESTIK: 'Tour Domestik',
  TOUR_LUAR_NEGERI: 'Tour Luar Negeri',
};

const STATUS_PAKET = {
  DIBUKA: { label: 'Dibuka', nada: 'ok' },
  DITUTUP: { label: 'Ditutup', nada: 'warn' },
  BERANGKAT: { label: 'Berangkat', nada: 'info' },
  SELESAI: { label: 'Selesai', nada: 'mute' },
};

export default function Paket() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canWrite = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const [paket, setPaket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // "Nonaktifkan" bukan hapus — paketnya tetap ada, cuma disembunyikan
  // dari daftar aktif (dan otomatis lenyap dari landing page publik).
  // Sebelum ini tidak ada cara melihatnya lagi setelah dinonaktifkan —
  // terasa seperti "hilang". Toggle ini membuatnya tetap terlihat &
  // bisa diaktifkan kembali kalau salah klik.
  const [filterAktif, setFilterAktif] = useState('AKTIF');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nama: '', jenis: 'UMRAH', tanggal_berangkat: '', harga_default: '', status: 'DIBUKA' });

  // Flyer promosi (opsional) — gambar yang staf desain sendiri, tampil
  // sebagai banner besar di kartu paket pada landing page publik /minat.
  // flyerPreviewUrl menampilkan salah satu dari: url flyer lama (saat
  // edit), blob preview file baru yang baru dipilih, atau '' kalau
  // dihapus — flyerFile cuma diisi kalau ada file BARU yang perlu
  // diunggah saat submit.
  const [flyerFile, setFlyerFile] = useState(null);
  const [flyerPreviewUrl, setFlyerPreviewUrl] = useState('');
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [flyerError, setFlyerError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('paket')
      .select('id, nama, jenis, tanggal_berangkat, harga_default, status, is_active, flyer_url')
      .order('tanggal_berangkat', { ascending: true, nullsFirst: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setPaket(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const paketTerlihat = useMemo(
    () => paket.filter((p) => (filterAktif === 'AKTIF' ? p.is_active : !p.is_active)),
    [paket, filterAktif]
  );

  function openAdd() {
    setEditingId(null);
    setForm({ nama: '', jenis: 'UMRAH', tanggal_berangkat: '', harga_default: '', status: 'DIBUKA' });
    setFlyerFile(null);
    setFlyerPreviewUrl('');
    setFlyerError('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      nama: p.nama,
      jenis: p.jenis,
      tanggal_berangkat: p.tanggal_berangkat || '',
      harga_default: formatRibuan(String(p.harga_default)),
      status: p.status,
    });
    setFlyerFile(null);
    setFlyerPreviewUrl(p.flyer_url || '');
    setFlyerError('');
    setFormError('');
    setShowForm(true);
  }

  function handleFlyerChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlyerError('');
    if (!file.type.startsWith('image/')) {
      setFlyerError('File harus berupa gambar.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFlyerError('Ukuran gambar maksimal 5MB.');
      return;
    }
    setFlyerFile(file);
    setFlyerPreviewUrl(URL.createObjectURL(file));
  }

  function handleHapusFlyer() {
    setFlyerFile(null);
    setFlyerPreviewUrl('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.nama.trim()) {
      setFormError('Nama paket wajib diisi.');
      return;
    }
    setSubmitting(true);

    // flyerPreviewUrl sudah mewakili keadaan akhir yang diinginkan (url
    // lama dipertahankan, atau '' kalau dihapus) — cuma perlu diunggah
    // dulu kalau ada file BARU yang dipilih (flyerFile terisi).
    let flyerUrl = flyerPreviewUrl || null;
    if (flyerFile) {
      setUploadingFlyer(true);
      const ext = flyerFile.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('paket-flyer').upload(path, flyerFile, { upsert: false });
      setUploadingFlyer(false);
      if (upErr) {
        setSubmitting(false);
        setFormError('Gagal mengunggah flyer: ' + upErr.message);
        return;
      }
      flyerUrl = supabase.storage.from('paket-flyer').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      nama: form.nama.trim(),
      jenis: form.jenis,
      tanggal_berangkat: form.tanggal_berangkat || null,
      harga_default: Number(String(form.harga_default).replace(/\D/g, '')) || 0,
      status: form.status,
      flyer_url: flyerUrl,
    };
    const { error: opError } = editingId
      ? await supabase.from('paket').update(payload).eq('id', editingId)
      : await supabase.from('paket').insert(payload);
    setSubmitting(false);
    if (opError) {
      setFormError(opError.message);
      return;
    }
    setShowForm(false);
    load();
  }

  async function handleNonaktifkan(p) {
    if (!window.confirm(`Nonaktifkan paket "${p.nama}"? Pendaftaran & pembayaran yang sudah ada tetap tersimpan — paket ini masih bisa diaktifkan lagi lewat tab "Nonaktif".`)) return;
    const { error: err } = await supabase.from('paket').update({ is_active: false }).eq('id', p.id);
    if (err) { window.alert('Gagal: ' + err.message); return; }
    load();
  }

  async function handleAktifkanKembali(p) {
    const { error: err } = await supabase.from('paket').update({ is_active: true }).eq('id', p.id);
    if (err) { window.alert('Gagal: ' + err.message); return; }
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Paket Keberangkatan</h1>
          <p className="text-ink-soft text-sm mt-1">
            Daftar paket Umrah, Haji, dan tour — jadi dasar pendaftaran jamaah di menu Tagihan.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openAdd}
            className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
          >
            + Tambah Paket
          </button>
        )}
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilterAktif('AKTIF')}
          className={`text-xs font-semibold px-4 py-2 rounded-md2 ${filterAktif === 'AKTIF' ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}
        >
          Aktif
        </button>
        <button
          type="button"
          onClick={() => setFilterAktif('NONAKTIF')}
          className={`text-xs font-semibold px-4 py-2 rounded-md2 ${filterAktif === 'NONAKTIF' ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}
        >
          Nonaktif
        </button>
      </div>

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Nama Paket</th>
                <th className="p-4 whitespace-nowrap">Jenis</th>
                <th className="p-4 whitespace-nowrap">Tanggal Berangkat</th>
                <th className="p-4 whitespace-nowrap text-right">Harga Default</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && paketTerlihat.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-ink-soft">
                    {filterAktif === 'AKTIF' ? 'Belum ada paket keberangkatan.' : 'Tidak ada paket yang dinonaktifkan.'}
                  </td>
                </tr>
              )}
              {paketTerlihat.map((p) => (
                <tr key={p.id}>
                  <td className="p-4 font-medium">
                    <button
                      type="button"
                      onClick={() => navigate(`/paket/${p.id}/rab`)}
                      className="text-accent-text hover:underline text-left"
                      title="Buka RAB & realisasi biaya paket ini"
                    >
                      {p.nama}
                    </button>
                  </td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{JENIS_LABEL[p.jenis] || p.jenis}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{p.tanggal_berangkat ? tanggalID(p.tanggal_berangkat) : '-'}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(p.harga_default)}</td>
                  <td className="p-4 text-center">
                    <Pil nada={STATUS_PAKET[p.status]?.nada || 'mute'}>{STATUS_PAKET[p.status]?.label || p.status}</Pil>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <GrupAksi>
                      <Aksi jenis="utama" onClick={() => navigate(`/paket/${p.id}/rab`)}>Kelola RAB</Aksi>
                      <Aksi onClick={() => navigate(`/paket/${p.id}/manifest`)}>Manifest</Aksi>
                      <Aksi onClick={() => navigate(`/paket/${p.id}/operasional`)}>Roomlist &amp; Itinerary</Aksi>
                      {canWrite && <Aksi onClick={() => openEdit(p)}>Ubah</Aksi>}
                      {canWrite && p.is_active && <Aksi jenis="bahaya" onClick={() => handleNonaktifkan(p)}>Nonaktifkan</Aksi>}
                      {canWrite && !p.is_active && <Aksi jenis="utama" onClick={() => handleAktifkanKembali(p)}>Aktifkan Kembali</Aksi>}
                    </GrupAksi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{editingId ? 'Edit Paket' : 'Tambah Paket'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Paket</label>
                <input
                  type="text"
                  placeholder="mis. Umrah Reguler September 2026"
                  value={form.nama}
                  onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis</label>
                <select
                  value={form.jenis}
                  onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                >
                  {Object.entries(JENIS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tanggal Berangkat</label>
                <input
                  type="date"
                  value={form.tanggal_berangkat}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal_berangkat: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Harga Default</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.harga_default}
                  onChange={(e) => setForm((f) => ({ ...f, harga_default: formatRibuan(e.target.value) }))}
                  className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <p className="text-[11px] text-ink-soft mt-1">Dipakai sebagai isian awal total tagihan saat mendaftarkan jamaah — masih bisa diubah per jamaah.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                >
                  {Object.entries(STATUS_PAKET).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Flyer Promosi (opsional)</label>
                {flyerPreviewUrl && (
                  <div className="mb-2 relative">
                    <img src={flyerPreviewUrl} alt="Pratinjau flyer" className="w-full rounded-md2 border border-rule object-cover max-h-48" />
                    <button
                      type="button"
                      onClick={handleHapusFlyer}
                      className="absolute top-2 right-2 bg-brick-600 hover:bg-brick-700 text-white text-xs font-semibold px-2.5 py-1 rounded-md2"
                    >
                      Hapus
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFlyerChange}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md2 file:border-0 file:bg-accent-soft file:text-accent-text file:text-xs file:font-semibold"
                />
                <p className="text-[11px] text-ink-soft mt-1">Tampil sebagai gambar besar di kartu paket pada landing page publik. Maksimal 5MB.</p>
                {flyerError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2 mt-1">{flyerError}</p>}
              </div>
              {formError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {uploadingFlyer ? 'Mengunggah flyer...' : submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah paket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
