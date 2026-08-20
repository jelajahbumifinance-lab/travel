import { useEffect, useState, useCallback } from 'react';
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

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nama: '', jenis: 'UMRAH', tanggal_berangkat: '', harga_default: '', status: 'DIBUKA' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('paket')
      .select('id, nama, jenis, tanggal_berangkat, harga_default, status, is_active')
      .eq('is_active', true)
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

  function openAdd() {
    setEditingId(null);
    setForm({ nama: '', jenis: 'UMRAH', tanggal_berangkat: '', harga_default: '', status: 'DIBUKA' });
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
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.nama.trim()) {
      setFormError('Nama paket wajib diisi.');
      return;
    }
    const payload = {
      nama: form.nama.trim(),
      jenis: form.jenis,
      tanggal_berangkat: form.tanggal_berangkat || null,
      harga_default: Number(String(form.harga_default).replace(/\D/g, '')) || 0,
      status: form.status,
    };
    setSubmitting(true);
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
    if (!window.confirm(`Nonaktifkan paket "${p.nama}"? Pendaftaran & pembayaran yang sudah ada tetap tersimpan.`)) return;
    const { error: err } = await supabase.from('paket').update({ is_active: false }).eq('id', p.id);
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
              {!loading && paket.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Belum ada paket keberangkatan.</td></tr>
              )}
              {paket.map((p) => (
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
                      {canWrite && <Aksi jenis="bahaya" onClick={() => handleNonaktifkan(p)}>Nonaktifkan</Aksi>}
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
              {formError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah paket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
