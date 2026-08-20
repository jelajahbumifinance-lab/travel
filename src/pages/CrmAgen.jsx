import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { tanggalID } from '../lib/format';
import { Aksi, GrupAksi, Pil } from '../components/ui';
import SearchSelect from '../components/SearchSelect';

const STATUS_LEAD = {
  BARU: { label: 'Baru', nada: 'info' },
  DIHUBUNGI: { label: 'Dihubungi', nada: 'warn' },
  TERTARIK: { label: 'Tertarik', nada: 'warn' },
  TIDAK_TERTARIK: { label: 'Tidak Tertarik', nada: 'mute' },
  JADI_JAMAAH: { label: 'Jadi Jamaah', nada: 'ok' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  ...Object.entries(STATUS_LEAD).map(([value, s]) => ({ value, label: s.label })),
];

const FORM_KOSONG = { agen_id: '', nama: '', no_hp: '', email: '', paket_id: '', catatan: '' };

async function fetchAgenOptions(query) {
  let q = supabase.from('profiles').select('id, full_name').eq('role', 'agen').eq('is_active', true);
  if (query.trim()) q = q.ilike('full_name', `%${query.trim()}%`);
  const { data } = await q.order('full_name').limit(20);
  return (data || []).map((a) => ({ value: a.id, label: a.full_name }));
}

/**
 * Calon jamaah yang dibawa agen — sengaja dipisah dari menu Leads biasa
 * (lihat sql/0017_crm_agen.sql). Agen bisa mencatat sendiri lewat Portal
 * Agen; halaman ini untuk staf memantau semuanya dan membantu mencatat
 * atas nama agen yang sedang sibuk.
 */
export default function CrmAgen() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canWrite = ['direktur', 'admin_keuangan', 'kasir'].includes(profile?.role);

  const [rows, setRows] = useState([]);
  const [paketList, setPaketList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agenFilter, setAgenFilter] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(FORM_KOSONG);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailTarget, setDetailTarget] = useState(null);
  const [detailCatatan, setDetailCatatan] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [leadsRes, paketRes] = await Promise.all([
      supabase.from('leads').select('*, paket:minat_paket_id(nama), agen:agen_id(full_name)').eq('sumber', 'AGEN').order('created_at', { ascending: false }),
      supabase.from('paket').select('id, nama').eq('is_active', true).order('nama'),
    ]);
    if (leadsRes.error) {
      setError(leadsRes.error.message);
      setLoading(false);
      return;
    }
    setRows(leadsRes.data || []);
    setPaketList(paketRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (agenFilter && r.agen_id !== agenFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.nama?.toLowerCase().includes(q) && !r.no_hp?.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, agenFilter, search]);

  const ringkasan = useMemo(() => {
    const hasil = {};
    for (const key of Object.keys(STATUS_LEAD)) hasil[key] = 0;
    for (const r of rows) hasil[r.status] = (hasil[r.status] || 0) + 1;
    return hasil;
  }, [rows]);

  function openAdd() {
    setForm(FORM_KOSONG);
    setFormError('');
    setShowAdd(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    if (!form.agen_id) {
      setFormError('Pilih agen yang merujuk.');
      return;
    }
    if (!form.nama.trim() || !form.no_hp.trim()) {
      setFormError('Nama dan No. HP wajib diisi.');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('leads').insert({
      nama: form.nama.trim(),
      no_hp: form.no_hp.trim(),
      email: form.email.trim() || null,
      minat_paket_id: form.paket_id || null,
      agen_id: form.agen_id,
      sumber: 'AGEN',
      catatan: form.catatan.trim() || null,
      status: 'BARU',
    });
    setSaving(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setShowAdd(false);
    load();
  }

  function openDetail(row) {
    setDetailTarget(row);
    setDetailCatatan(row.catatan || '');
    setDetailError('');
  }

  async function ubahStatus(status) {
    if (!detailTarget) return;
    setDetailError('');
    setSavingDetail(true);
    const { error: err } = await supabase
      .from('leads')
      .update({ status, catatan: detailCatatan.trim() || null })
      .eq('id', detailTarget.id);
    setSavingDetail(false);
    if (err) {
      setDetailError(err.message);
      return;
    }
    setDetailTarget(null);
    load();
  }

  async function simpanCatatan() {
    if (!detailTarget) return;
    setDetailError('');
    setSavingDetail(true);
    const { error: err } = await supabase
      .from('leads')
      .update({ catatan: detailCatatan.trim() || null })
      .eq('id', detailTarget.id);
    setSavingDetail(false);
    if (err) {
      setDetailError(err.message);
      return;
    }
    setDetailTarget(null);
    load();
  }

  function daftarkanSebagaiJamaah() {
    if (!detailTarget) return;
    navigate('/tagihan', {
      state: {
        prefillDaftar: {
          nama: detailTarget.nama,
          no_hp: detailTarget.no_hp,
          paket_id: detailTarget.minat_paket_id || '',
          agen_id: detailTarget.agen_id || '',
          agen_nama: detailTarget.agen?.full_name || '',
          lead_id: detailTarget.id,
        },
      },
    });
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">CRM Agen</h1>
          <p className="text-ink-soft text-sm mt-1">Calon jamaah yang dirujuk oleh agen/mitra.</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openAdd}
            className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
          >
            + Catat Calon Jamaah
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {Object.entries(STATUS_LEAD).map(([key, s]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            className={`card rounded-xl2 p-3 text-left ${statusFilter === key ? 'ring-2 ring-accent' : ''}`}
          >
            <p className="text-[11px] text-ink-soft mb-1">{s.label}</p>
            <p className="tabular text-xl font-bold">{ringkasan[key] || 0}</p>
          </button>
        ))}
      </div>

      <div className="card rounded-xl2 p-4 mb-4 space-y-3">
        <input
          type="search"
          placeholder="Cari nama / No. HP"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field w-full rounded-md2 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="field w-full rounded-md2 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Agen</label>
            <SearchSelect
              value={agenFilter}
              onChange={setAgenFilter}
              fetchOptions={fetchAgenOptions}
              placeholder="Semua agen"
              emptyLabel="Semua agen"
            />
          </div>
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
                <th className="p-4 whitespace-nowrap">Agen</th>
                <th className="p-4 whitespace-nowrap">Minat Paket</th>
                <th className="p-4 whitespace-nowrap">Tanggal</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Tidak ada calon jamaah yang cocok.</td></tr>
              )}
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-4">
                    <p className="font-medium">{r.nama}</p>
                    <p className="text-[11px] text-ink-soft">{r.no_hp}</p>
                  </td>
                  <td className="p-4 whitespace-nowrap">{r.agen?.full_name || '-'}</td>
                  <td className="p-4 whitespace-nowrap">{r.paket?.nama || '-'}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{tanggalID(r.created_at)}</td>
                  <td className="p-4 text-center">
                    <Pil nada={STATUS_LEAD[r.status]?.nada || 'mute'}>{STATUS_LEAD[r.status]?.label || r.status}</Pil>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <GrupAksi>
                      <Aksi onClick={() => openDetail(r)}>Detail</Aksi>
                    </GrupAksi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Catat Calon Jamaah */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Catat Calon Jamaah</h2>
              <button type="button" onClick={() => setShowAdd(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Agen yang Merujuk</label>
                <SearchSelect
                  value={form.agen_id}
                  onChange={(v) => setForm((f) => ({ ...f, agen_id: v }))}
                  fetchOptions={fetchAgenOptions}
                  placeholder="Cari nama agen"
                  emptyLabel="— Pilih agen —"
                  allowEmpty={false}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Calon Jamaah</label>
                <input type="text" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP</label>
                <input type="text" value={form.no_hp} onChange={(e) => setForm((f) => ({ ...f, no_hp: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Email (opsional)</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Minat Paket (opsional)</label>
                <SearchSelect
                  value={form.paket_id}
                  onChange={(v) => setForm((f) => ({ ...f, paket_id: v }))}
                  options={paketList.map((p) => ({ value: p.id, label: p.nama }))}
                  placeholder="Belum tahu paket"
                  emptyLabel="Belum tahu paket"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan (opsional)</label>
                <textarea rows={2} value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              {formError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>}
              <button type="submit" disabled={saving} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detail */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">{detailTarget.nama}</h2>
              <button type="button" onClick={() => setDetailTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>

            <div className="space-y-1 text-sm mb-4">
              <p><span className="text-ink-soft">No. HP:</span> {detailTarget.no_hp}</p>
              {detailTarget.email && <p><span className="text-ink-soft">Email:</span> {detailTarget.email}</p>}
              <p><span className="text-ink-soft">Agen:</span> {detailTarget.agen?.full_name || '-'}</p>
              <p><span className="text-ink-soft">Minat Paket:</span> {detailTarget.paket?.nama || '-'}</p>
              <p><span className="text-ink-soft">Tanggal Masuk:</span> {tanggalID(detailTarget.created_at)}</p>
              <p className="flex items-center gap-2"><span className="text-ink-soft">Status:</span> <Pil nada={STATUS_LEAD[detailTarget.status]?.nada || 'mute'}>{STATUS_LEAD[detailTarget.status]?.label}</Pil></p>
            </div>

            {canWrite && (
              <>
                <div className="mb-4">
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan</label>
                  <textarea rows={3} value={detailCatatan} onChange={(e) => setDetailCatatan(e.target.value)} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
                </div>

                {detailError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2 mb-3">{detailError}</p>}

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button type="button" disabled={savingDetail} onClick={() => ubahStatus('DIHUBUNGI')} className="text-xs font-semibold py-2 rounded-md2 bg-accent-soft text-accent-text disabled:opacity-60">Tandai Dihubungi</button>
                  <button type="button" disabled={savingDetail} onClick={() => ubahStatus('TERTARIK')} className="text-xs font-semibold py-2 rounded-md2 bg-accent-soft text-accent-text disabled:opacity-60">Tandai Tertarik</button>
                  <button type="button" disabled={savingDetail} onClick={() => ubahStatus('TIDAK_TERTARIK')} className="text-xs font-semibold py-2 rounded-md2 bg-brick-100 text-brick-600 disabled:opacity-60">Tidak Tertarik</button>
                  <button type="button" disabled={savingDetail} onClick={simpanCatatan} className="text-xs font-semibold py-2 rounded-md2 bg-paper-raised border border-rule disabled:opacity-60">Simpan Catatan</button>
                </div>

                {detailTarget.status !== 'JADI_JAMAAH' && (
                  <button
                    type="button"
                    onClick={daftarkanSebagaiJamaah}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-md2 text-sm mt-1"
                  >
                    Daftarkan sebagai Jamaah →
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
