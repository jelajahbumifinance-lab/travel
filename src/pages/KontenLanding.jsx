import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Aksi, GrupAksi, Pil } from '../components/ui';

const TESTIMONI_KOSONG = { nama: '', keterangan: '', isi: '', urutan: '0' };
const GALERI_KOSONG = { keterangan: '', urutan: '0' };

// Path objek di bucket `landing-media` diekstrak dari public URL-nya —
// dipakai untuk ikut menghapus file lama saat foto diganti/dihapus,
// supaya bucket tidak terus menumpuk file yatim.
function pathDariUrl(url) {
  if (!url) return null;
  const marker = '/landing-media/';
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

async function unggahFoto(file) {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('landing-media').upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  return supabase.storage.from('landing-media').getPublicUrl(path).data.publicUrl;
}

async function hapusFotoLama(url) {
  const path = pathDariUrl(url);
  if (path) await supabase.storage.from('landing-media').remove([path]);
}

/**
 * Kelola isi section testimoni & galeri foto di landing page publik
 * (/minat) — hanya direktur/admin_keuangan. Dua entitas independen
 * (testimoni, galeri_foto) ditampilkan sebagai dua kartu terpisah di
 * satu halaman karena keduanya kecil dan selalu dikelola bersamaan.
 */
export default function KontenLanding() {
  const [testimoniList, setTestimoniList] = useState([]);
  const [galeriList, setGaleriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [t, g] = await Promise.all([
      supabase.from('testimoni').select('*').order('urutan', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('galeri_foto').select('*').order('urutan', { ascending: true }).order('created_at', { ascending: false }),
    ]);
    if (t.error || g.error) {
      setError(t.error?.message || g.error?.message);
      setLoading(false);
      return;
    }
    setTestimoniList(t.data || []);
    setGaleriList(g.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Testimoni &amp; Galeri</h1>
        <p className="text-ink-soft text-sm mt-1">
          Isi section testimoni dan galeri foto di landing page publik (/minat). Hanya baris yang &quot;Tampil&quot; yang muncul ke pengunjung.
        </p>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <SeksiTestimoni list={testimoniList} loading={loading} onChange={load} setError={setError} />
      <div className="mt-8">
        <SeksiGaleri list={galeriList} loading={loading} onChange={load} setError={setError} />
      </div>
    </div>
  );
}

function SeksiTestimoni({ list, loading, onChange, setError }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(TESTIMONI_KOSONG);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function openAdd() {
    setEditingId(null);
    setForm(TESTIMONI_KOSONG);
    setFotoFile(null);
    setFotoPreviewUrl('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setForm({ nama: t.nama, keterangan: t.keterangan || '', isi: t.isi, urutan: String(t.urutan) });
    setFotoFile(null);
    setFotoPreviewUrl(t.foto_url || '');
    setFormError('');
    setShowForm(true);
  }

  function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFormError('File harus berupa gambar.'); return; }
    if (file.size > 5 * 1024 * 1024) { setFormError('Ukuran gambar maksimal 5MB.'); return; }
    setFormError('');
    setFotoFile(file);
    setFotoPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.nama.trim() || !form.isi.trim()) {
      setFormError('Nama dan isi testimoni wajib diisi.');
      return;
    }
    setSubmitting(true);

    let fotoUrl = fotoPreviewUrl || null;
    if (fotoFile) {
      setUploading(true);
      try {
        fotoUrl = await unggahFoto(fotoFile);
      } catch (err) {
        setUploading(false);
        setSubmitting(false);
        setFormError('Gagal mengunggah foto: ' + err.message);
        return;
      }
      setUploading(false);
    }

    const payload = {
      nama: form.nama.trim(),
      keterangan: form.keterangan.trim() || null,
      isi: form.isi.trim(),
      foto_url: fotoUrl,
      urutan: Number(form.urutan) || 0,
    };
    const { error: opErr } = editingId
      ? await supabase.from('testimoni').update(payload).eq('id', editingId)
      : await supabase.from('testimoni').insert(payload);
    setSubmitting(false);
    if (opErr) { setFormError(opErr.message); return; }
    setShowForm(false);
    onChange();
  }

  async function toggleAktif(t) {
    const { error: err } = await supabase.from('testimoni').update({ is_active: !t.is_active }).eq('id', t.id);
    if (err) { setError(err.message); return; }
    onChange();
  }

  async function handleHapus(t) {
    if (!window.confirm(`Hapus testimoni dari "${t.nama}"? Tidak bisa dibatalkan.`)) return;
    const { error: err } = await supabase.from('testimoni').delete().eq('id', t.id);
    if (err) { setError(err.message); return; }
    if (t.foto_url) await hapusFotoLama(t.foto_url);
    onChange();
  }

  return (
    <div>
      <div className="mb-3 flex justify-between items-end gap-3">
        <h2 className="font-display text-lg font-semibold">Testimoni Jamaah</h2>
        <button
          type="button"
          onClick={openAdd}
          className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
        >
          + Tambah Testimoni
        </button>
      </div>

      {loading && <p className="text-sm text-ink-soft">Memuat...</p>}
      {!loading && list.length === 0 && (
        <div className="card rounded-xl2 p-10 text-center text-ink-soft text-sm">Belum ada testimoni.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((t) => (
          <div key={t.id} className="card rounded-xl2 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {t.foto_url ? (
                <img src={t.foto_url} alt={t.nama} className="w-11 h-11 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-accent-soft text-accent-text flex items-center justify-center font-display font-semibold shrink-0">
                  {t.nama.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{t.nama}</p>
                {t.keterangan && <p className="text-xs text-ink-soft truncate">{t.keterangan}</p>}
              </div>
              <Pil nada={t.is_active ? 'ok' : 'mute'}>{t.is_active ? 'Tampil' : 'Disembunyikan'}</Pil>
            </div>
            <p className="text-sm text-ink-soft flex-1">&ldquo;{t.isi}&rdquo;</p>
            <GrupAksi>
              <Aksi onClick={() => openEdit(t)}>Ubah</Aksi>
              <Aksi onClick={() => toggleAktif(t)}>{t.is_active ? 'Sembunyikan' : 'Tampilkan'}</Aksi>
              <Aksi jenis="bahaya" onClick={() => handleHapus(t)}>Hapus</Aksi>
            </GrupAksi>
          </div>
        ))}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{editingId ? 'Ubah Testimoni' : 'Tambah Testimoni'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Jamaah</label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Keterangan (opsional)</label>
                <input
                  type="text"
                  placeholder="mis. Umrah Maret 2025"
                  value={form.keterangan}
                  onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Isi Testimoni</label>
                <textarea
                  rows={4}
                  value={form.isi}
                  onChange={(e) => setForm((f) => ({ ...f, isi: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Urutan Tampil</label>
                <input
                  type="number"
                  value={form.urutan}
                  onChange={(e) => setForm((f) => ({ ...f, urutan: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <p className="text-[11px] text-ink-soft mt-1">Angka lebih kecil tampil lebih dulu.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Foto (opsional)</label>
                {fotoPreviewUrl && (
                  <div className="mb-2">
                    <img src={fotoPreviewUrl} alt="Pratinjau" className="w-16 h-16 rounded-full object-cover border border-rule" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md2 file:border-0 file:bg-accent-soft file:text-accent-text file:text-xs file:font-semibold"
                />
                <p className="text-[11px] text-ink-soft mt-1">Maksimal 5MB. Kalau kosong, tampil sebagai inisial nama.</p>
              </div>
              {formError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {uploading ? 'Mengunggah foto...' : submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah testimoni'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SeksiGaleri({ list, loading, onChange, setError }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(GALERI_KOSONG);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function openAdd() {
    setEditingId(null);
    setForm(GALERI_KOSONG);
    setFotoFile(null);
    setFotoPreviewUrl('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(g) {
    setEditingId(g.id);
    setForm({ keterangan: g.keterangan || '', urutan: String(g.urutan) });
    setFotoFile(null);
    setFotoPreviewUrl(g.foto_url);
    setFormError('');
    setShowForm(true);
  }

  function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFormError('File harus berupa gambar.'); return; }
    if (file.size > 5 * 1024 * 1024) { setFormError('Ukuran gambar maksimal 5MB.'); return; }
    setFormError('');
    setFotoFile(file);
    setFotoPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!fotoFile && !fotoPreviewUrl) {
      setFormError('Foto wajib diisi.');
      return;
    }
    setSubmitting(true);

    let fotoUrl = fotoPreviewUrl;
    if (fotoFile) {
      setUploading(true);
      try {
        fotoUrl = await unggahFoto(fotoFile);
      } catch (err) {
        setUploading(false);
        setSubmitting(false);
        setFormError('Gagal mengunggah foto: ' + err.message);
        return;
      }
      setUploading(false);
    }

    const payload = {
      foto_url: fotoUrl,
      keterangan: form.keterangan.trim() || null,
      urutan: Number(form.urutan) || 0,
    };
    const { error: opErr } = editingId
      ? await supabase.from('galeri_foto').update(payload).eq('id', editingId)
      : await supabase.from('galeri_foto').insert(payload);
    setSubmitting(false);
    if (opErr) { setFormError(opErr.message); return; }
    setShowForm(false);
    onChange();
  }

  async function toggleAktif(g) {
    const { error: err } = await supabase.from('galeri_foto').update({ is_active: !g.is_active }).eq('id', g.id);
    if (err) { setError(err.message); return; }
    onChange();
  }

  async function handleHapus(g) {
    if (!window.confirm('Hapus foto ini dari galeri? Tidak bisa dibatalkan.')) return;
    const { error: err } = await supabase.from('galeri_foto').delete().eq('id', g.id);
    if (err) { setError(err.message); return; }
    await hapusFotoLama(g.foto_url);
    onChange();
  }

  return (
    <div>
      <div className="mb-3 flex justify-between items-end gap-3">
        <h2 className="font-display text-lg font-semibold">Galeri Foto</h2>
        <button
          type="button"
          onClick={openAdd}
          className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
        >
          + Tambah Foto
        </button>
      </div>

      {loading && <p className="text-sm text-ink-soft">Memuat...</p>}
      {!loading && list.length === 0 && (
        <div className="card rounded-xl2 p-10 text-center text-ink-soft text-sm">Belum ada foto galeri.</div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {list.map((g) => (
          <div key={g.id} className="card rounded-xl2 overflow-hidden flex flex-col">
            <div className="relative aspect-square">
              <img src={g.foto_url} alt={g.keterangan || 'Foto galeri'} className="w-full h-full object-cover" />
              <span className="absolute top-2 right-2">
                <Pil nada={g.is_active ? 'ok' : 'mute'}>{g.is_active ? 'Tampil' : 'Sembunyi'}</Pil>
              </span>
            </div>
            <div className="p-3 flex flex-col gap-2 flex-1">
              {g.keterangan && <p className="text-xs text-ink-soft flex-1">{g.keterangan}</p>}
              <GrupAksi>
                <Aksi onClick={() => openEdit(g)}>Ubah</Aksi>
                <Aksi onClick={() => toggleAktif(g)}>{g.is_active ? 'Sembunyikan' : 'Tampilkan'}</Aksi>
                <Aksi jenis="bahaya" onClick={() => handleHapus(g)}>Hapus</Aksi>
              </GrupAksi>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{editingId ? 'Ubah Foto' : 'Tambah Foto'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Foto</label>
                {fotoPreviewUrl && (
                  <div className="mb-2">
                    <img src={fotoPreviewUrl} alt="Pratinjau" className="w-full rounded-md2 border border-rule object-cover max-h-48" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md2 file:border-0 file:bg-accent-soft file:text-accent-text file:text-xs file:font-semibold"
                />
                <p className="text-[11px] text-ink-soft mt-1">Maksimal 5MB.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Keterangan (opsional)</label>
                <input
                  type="text"
                  placeholder="mis. Keberangkatan Umrah Maret 2025"
                  value={form.keterangan}
                  onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Urutan Tampil</label>
                <input
                  type="number"
                  value={form.urutan}
                  onChange={(e) => setForm((f) => ({ ...f, urutan: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <p className="text-[11px] text-ink-soft mt-1">Angka lebih kecil tampil lebih dulu.</p>
              </div>
              {formError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {uploading ? 'Mengunggah foto...' : submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah foto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
