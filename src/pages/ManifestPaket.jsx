import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { tanggalID } from '../lib/format';
import { unduhCSV } from '../lib/csv';
import { Aksi, Pil } from '../components/ui';

const STATUS_DOKUMEN_LABEL = {
  BELUM_LENGKAP: { label: 'Belum Lengkap', nada: 'mute' },
  LENGKAP: { label: 'Lengkap', nada: 'info' },
  PROSES_VISA: { label: 'Proses Visa', nada: 'warn' },
  VISA_TERBIT: { label: 'Visa Terbit', nada: 'ok' },
};

function bulanSelisih(dariISO, keISO) {
  if (!dariISO || !keISO) return null;
  const a = new Date(dariISO);
  const b = new Date(keISO);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

const FORM_KOSONG = {
  nama_paspor: '', no_paspor: '', tempat_lahir: '', tanggal_lahir: '',
  jenis_kelamin: '', tanggal_terbit_paspor: '', tanggal_berlaku_paspor: '', status_dokumen: 'BELUM_LENGKAP',
};

export default function ManifestPaket() {
  const { paketId } = useParams();
  const { profile } = useAuth();
  const canWrite = ['direktur', 'admin_keuangan', 'kasir'].includes(profile?.role);

  const [paket, setPaket] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editTarget, setEditTarget] = useState(null); // jamaah
  const [form, setForm] = useState(FORM_KOSONG);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [paketRes, pendaftaranRes] = await Promise.all([
      supabase.from('paket').select('id, nama, jenis, tanggal_berangkat').eq('id', paketId).maybeSingle(),
      supabase
        .from('pendaftaran')
        .select('id, status, jamaah(id, nama, nik, no_hp, nama_paspor, no_paspor, tempat_lahir, tanggal_lahir, jenis_kelamin, tanggal_terbit_paspor, tanggal_berlaku_paspor, status_dokumen)')
        .eq('paket_id', paketId)
        .neq('status', 'BATAL'),
    ]);
    if (paketRes.error || pendaftaranRes.error) {
      setError(paketRes.error?.message || pendaftaranRes.error?.message);
      setLoading(false);
      return;
    }
    setPaket(paketRes.data);
    setRows((pendaftaranRes.data || []).map((p) => p.jamaah).filter(Boolean));
    setLoading(false);
  }, [paketId]);

  useEffect(() => { load(); }, [load]);

  function openEdit(j) {
    setEditTarget(j);
    setForm({
      nama_paspor: j.nama_paspor || '',
      no_paspor: j.no_paspor || '',
      tempat_lahir: j.tempat_lahir || '',
      tanggal_lahir: j.tanggal_lahir || '',
      jenis_kelamin: j.jenis_kelamin || '',
      tanggal_terbit_paspor: j.tanggal_terbit_paspor || '',
      tanggal_berlaku_paspor: j.tanggal_berlaku_paspor || '',
      status_dokumen: j.status_dokumen || 'BELUM_LENGKAP',
    });
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    const payload = {
      nama_paspor: form.nama_paspor.trim() || null,
      no_paspor: form.no_paspor.trim() || null,
      tempat_lahir: form.tempat_lahir.trim() || null,
      tanggal_lahir: form.tanggal_lahir || null,
      jenis_kelamin: form.jenis_kelamin || null,
      tanggal_terbit_paspor: form.tanggal_terbit_paspor || null,
      tanggal_berlaku_paspor: form.tanggal_berlaku_paspor || null,
      status_dokumen: form.status_dokumen,
    };
    const { error: err } = await supabase.from('jamaah').update(payload).eq('id', editTarget.id);
    setSubmitting(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setEditTarget(null);
    load();
  }

  const rowsDenganPeringatan = useMemo(() => {
    return rows.map((j) => {
      const selisihBulan = paket?.tanggal_berangkat ? bulanSelisih(paket.tanggal_berangkat, j.tanggal_berlaku_paspor) : null;
      const pasporKurangDariEnamBulan = j.tanggal_berlaku_paspor && selisihBulan !== null && selisihBulan < 6;
      return { ...j, pasporKurangDariEnamBulan };
    });
  }, [rows, paket]);

  function ekspor() {
    unduhCSV(
      `manifest_${paket?.nama || 'paket'}.csv`,
      ['Nama', 'NIK', 'No HP', 'Nama Sesuai Paspor', 'No Paspor', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Kelamin', 'Berlaku Paspor Sampai', 'Status Dokumen'],
      rowsDenganPeringatan.map((j) => [
        j.nama, j.nik || '', j.no_hp || '', j.nama_paspor || '', j.no_paspor || '',
        j.tempat_lahir || '', j.tanggal_lahir || '', j.jenis_kelamin || '',
        j.tanggal_berlaku_paspor || '', STATUS_DOKUMEN_LABEL[j.status_dokumen]?.label || j.status_dokumen,
      ])
    );
  }

  if (loading) return <div className="text-sm text-ink-soft">Memuat...</div>;
  if (error) {
    return (
      <div className="card rounded-xl2 p-5 border-l-4 border-l-brick-500">
        <p className="font-semibold text-brick-600">Gagal memuat manifest</p>
        <p className="text-xs text-ink-soft mt-1">{error}</p>
      </div>
    );
  }
  if (!paket) return <div className="card rounded-xl2 p-5 text-sm text-ink-soft">Paket tidak ditemukan.</div>;

  return (
    <div className="w-full">
      <Link to="/paket" className="text-xs font-semibold text-accent-text hover:underline print:hidden">← Kembali ke Paket Keberangkatan</Link>

      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold">Manifest — {paket.nama}</h1>
          <p className="text-ink-soft text-sm mt-1">
            {paket.tanggal_berangkat ? `Berangkat ${tanggalID(paket.tanggal_berangkat)}` : 'Tanggal berangkat belum ditentukan'} · {rows.length} jamaah
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={ekspor} className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-2 px-4 rounded-md2 text-sm">
            ⭳ Ekspor CSV
          </button>
          <button type="button" onClick={() => window.print()} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
            🖨 Cetak
          </button>
        </div>
      </div>

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4 whitespace-nowrap print:hidden">#</th>
                <th className="p-4">Nama</th>
                <th className="p-4 whitespace-nowrap">No. Paspor</th>
                <th className="p-4 whitespace-nowrap">Tgl Lahir</th>
                <th className="p-4 whitespace-nowrap text-center">Status Dokumen</th>
                <th className="p-4 whitespace-nowrap text-center print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rowsDenganPeringatan.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Belum ada jamaah terdaftar di paket ini.</td></tr>
              )}
              {rowsDenganPeringatan.map((j, i) => (
                <tr key={j.id}>
                  <td className="p-4 text-ink-soft tabular print:hidden">{i + 1}</td>
                  <td className="p-4">
                    <p className="font-medium">{j.nama_paspor || j.nama}</p>
                    <p className="text-[11px] text-ink-soft">{j.nik || '-'} · {j.no_hp || '-'}</p>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <p>{j.no_paspor || '-'}</p>
                    {j.pasporKurangDariEnamBulan && (
                      <Pil nada="bad">Berlaku &lt; 6 bulan</Pil>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">
                    {j.tanggal_lahir ? tanggalID(j.tanggal_lahir) : '-'}{j.tempat_lahir ? `, ${j.tempat_lahir}` : ''}
                  </td>
                  <td className="p-4 text-center">
                    <Pil nada={STATUS_DOKUMEN_LABEL[j.status_dokumen]?.nada || 'mute'}>{STATUS_DOKUMEN_LABEL[j.status_dokumen]?.label || j.status_dokumen}</Pil>
                  </td>
                  <td className="p-4 text-center print:hidden">
                    {canWrite && <Aksi onClick={() => openEdit(j)}>Lengkapi Data</Aksi>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Data Paspor — {editTarget.nama}</h2>
              <button type="button" onClick={() => setEditTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Sesuai Paspor</label>
                <input type="text" value={form.nama_paspor} onChange={(e) => setForm((f) => ({ ...f, nama_paspor: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. Paspor</label>
                <input type="text" value={form.no_paspor} onChange={(e) => setForm((f) => ({ ...f, no_paspor: e.target.value.toUpperCase() }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tempat Lahir</label>
                  <input type="text" value={form.tempat_lahir} onChange={(e) => setForm((f) => ({ ...f, tempat_lahir: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tanggal Lahir</label>
                  <input type="date" value={form.tanggal_lahir} onChange={(e) => setForm((f) => ({ ...f, tanggal_lahir: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Kelamin</label>
                <select value={form.jenis_kelamin} onChange={(e) => setForm((f) => ({ ...f, jenis_kelamin: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="">Pilih</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Paspor Terbit</label>
                  <input type="date" value={form.tanggal_terbit_paspor} onChange={(e) => setForm((f) => ({ ...f, tanggal_terbit_paspor: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Paspor Berlaku s/d</label>
                  <input type="date" value={form.tanggal_berlaku_paspor} onChange={(e) => setForm((f) => ({ ...f, tanggal_berlaku_paspor: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Status Dokumen</label>
                <select value={form.status_dokumen} onChange={(e) => setForm((f) => ({ ...f, status_dokumen: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  {Object.entries(STATUS_DOKUMEN_LABEL).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </div>
              {formError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
