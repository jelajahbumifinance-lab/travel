import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Aksi, GrupAksi, Pil } from '../components/ui';

const JENIS_LABEL = {
  MASKAPAI: 'Maskapai',
  HOTEL: 'Hotel',
  VISA: 'Visa Agent',
  LAND_ARRANGER: 'Land Arranger',
  MUTHAWIF: 'Muthawif',
  LAINNYA: 'Lainnya',
};

export default function Vendor() {
  const { profile } = useAuth();
  const canWrite = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nama: '', jenis: '', kontak: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('vendor')
      .select('id, nama, jenis, kontak, is_active')
      .eq('is_active', true)
      .order('nama');
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setVendors(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Saran datalist: label bawaan + jenis apapun yang staf sudah pernah
  // ketik sendiri sebelumnya (supaya konsisten, tidak menciptakan
  // variasi ejaan baru terus-menerus untuk jenis yang sama).
  const jenisSaran = useMemo(() => {
    const set = new Set(Object.values(JENIS_LABEL));
    vendors.forEach((v) => { if (v.jenis) set.add(JENIS_LABEL[v.jenis] || v.jenis); });
    return Array.from(set);
  }, [vendors]);

  function openAdd() {
    setEditingId(null);
    setForm({ nama: '', jenis: '', kontak: '' });
    setFormError('');
    setShowForm(true);
  }

  function openEdit(v) {
    setEditingId(v.id);
    setForm({ nama: v.nama, jenis: JENIS_LABEL[v.jenis] || v.jenis, kontak: v.kontak || '' });
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.nama.trim() || !form.jenis.trim()) {
      setFormError('Nama dan jenis vendor wajib diisi.');
      return;
    }
    const payload = { nama: form.nama.trim(), jenis: form.jenis.trim(), kontak: form.kontak.trim() || null };
    setSubmitting(true);
    const { error: opError } = editingId
      ? await supabase.from('vendor').update(payload).eq('id', editingId)
      : await supabase.from('vendor').insert(payload);
    setSubmitting(false);
    if (opError) {
      setFormError(opError.message);
      return;
    }
    setShowForm(false);
    load();
  }

  async function handleNonaktifkan(v) {
    if (!window.confirm(`Nonaktifkan vendor "${v.nama}"? Riwayat realisasi biaya yang sudah ada tetap tersimpan.`)) return;
    const { error: err } = await supabase.from('vendor').update({ is_active: false }).eq('id', v.id);
    if (err) { window.alert('Gagal: ' + err.message); return; }
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Vendor</h1>
          <p className="text-ink-soft text-sm mt-1">Maskapai, hotel, visa agent, land arranger, dan muthawif.</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openAdd}
            className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
          >
            + Tambah Vendor
          </button>
        )}
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Nama Vendor</th>
                <th className="p-4 whitespace-nowrap">Jenis</th>
                <th className="p-4">Kontak</th>
                {canWrite && <th className="p-4 whitespace-nowrap text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={canWrite ? 4 : 3} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && vendors.length === 0 && (
                <tr><td colSpan={canWrite ? 4 : 3} className="p-10 text-center text-ink-soft">Belum ada vendor.</td></tr>
              )}
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="p-4 font-medium">{v.nama}</td>
                  <td className="p-4 whitespace-nowrap"><Pil nada="info">{JENIS_LABEL[v.jenis] || v.jenis}</Pil></td>
                  <td className="p-4 text-ink-soft">{v.kontak || '-'}</td>
                  {canWrite && (
                    <td className="p-4 whitespace-nowrap">
                      <GrupAksi>
                        <Aksi onClick={() => openEdit(v)}>Ubah</Aksi>
                        <Aksi jenis="bahaya" onClick={() => handleNonaktifkan(v)}>Nonaktifkan</Aksi>
                      </GrupAksi>
                    </td>
                  )}
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
              <h2 className="font-display text-lg font-semibold">{editingId ? 'Edit Vendor' : 'Tambah Vendor'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Vendor</label>
                <input
                  type="text"
                  placeholder="mis. Saudia Airlines, Hotel Al Marwa"
                  value={form.nama}
                  onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis</label>
                <input
                  type="text"
                  list="jenis-vendor-saran"
                  placeholder="mis. Hotel, Katering, Percetakan..."
                  value={form.jenis}
                  onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <datalist id="jenis-vendor-saran">
                  {jenisSaran.map((j) => <option key={j} value={j} />)}
                </datalist>
                <p className="text-[11px] text-ink-soft mt-1">Ketik bebas — beberapa saran umum sudah muncul otomatis.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Kontak (opsional)</label>
                <input
                  type="text"
                  placeholder="Nama PIC / no. telepon / email"
                  value={form.kontak}
                  onChange={(e) => setForm((f) => ({ ...f, kontak: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              {formError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah vendor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
