import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { tanggalID } from '../lib/format';
import { unduhCSV } from '../lib/csv';
import { Aksi, GrupAksi, Pil } from '../components/ui';
import SearchSelect from '../components/SearchSelect';

// Nomor HP Indonesia ditulis dengan berbagai gaya (08xx, +62, 62, dengan
// spasi/strip) — dirapikan ke format 62xxx yang dipakai wa.me supaya
// link-nya selalu valid apa pun cara nomornya diketik.
function waLink(noHp) {
  const digits = String(noHp || '').replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits.startsWith('62') ? digits : `62${digits}`;
  return `https://wa.me/${normalized}`;
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const STATUS_LEAD = {
  BARU: { label: 'Baru', nada: 'info' },
  DIHUBUNGI: { label: 'Dihubungi', nada: 'warn' },
  TERTARIK: { label: 'Tertarik', nada: 'warn' },
  TIDAK_TERTARIK: { label: 'Tidak Tertarik', nada: 'mute' },
  JADI_JAMAAH: { label: 'Jadi Jamaah', nada: 'ok' },
};

const SUMBER_LABEL = {
  WEBSITE: 'Website',
  REFERENSI: 'Referensi',
  SOSIAL_MEDIA: 'Sosial Media',
  LAINNYA: 'Lainnya',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  ...Object.entries(STATUS_LEAD).map(([value, s]) => ({ value, label: s.label })),
];

const SUMBER_OPTIONS = [
  { value: '', label: 'Semua sumber' },
  ...Object.entries(SUMBER_LABEL).map(([value, label]) => ({ value, label })),
];

const FORM_KOSONG = { nama: '', no_hp: '', email: '', jenis_kelamin: '', paket_id: '', sumber: 'LAINNYA', jumlah_pax: '', follow_up_at: '', catatan: '' };

function LabelGender({ jenisKelamin }) {
  if (jenisKelamin === 'L') return <span className="italic text-[11px] text-blue-600 ml-1">Laki-laki</span>;
  if (jenisKelamin === 'P') return <span className="italic text-[11px] text-pink-600 ml-1">Perempuan</span>;
  return null;
}

const HALAMAN_UKURAN = 20;

export default function Leads() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canWrite = ['direktur', 'admin_keuangan', 'kasir'].includes(profile?.role);

  const [rows, setRows] = useState([]);
  const [paketList, setPaketList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sumberFilter, setSumberFilter] = useState('');
  const [dariTanggal, setDariTanggal] = useState('');
  const [sampaiTanggal, setSampaiTanggal] = useState('');
  const [halaman, setHalaman] = useState(1);

  const [terpilih, setTerpilih] = useState(() => new Set());
  const [statusMassal, setStatusMassal] = useState('DIHUBUNGI');
  const [menerapkanMassal, setMenerapkanMassal] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(FORM_KOSONG);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailTarget, setDetailTarget] = useState(null);
  const [detailCatatan, setDetailCatatan] = useState('');
  const [detailPax, setDetailPax] = useState('');
  const [detailFollowUp, setDetailFollowUp] = useState('');
  const [detailJenisKelamin, setDetailJenisKelamin] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // Leads dari agen ditampilkan terpisah di menu CRM Agen (lihat
    // sql/0017_crm_agen.sql) — di sini sengaja disaring keluar supaya
    // dua corong tidak tercampur.
    const [leadsRes, paketRes] = await Promise.all([
      supabase.from('leads').select('*, paket:minat_paket_id(nama)').neq('sumber', 'AGEN').order('created_at', { ascending: false }),
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
      if (sumberFilter && r.sumber !== sumberFilter) return false;
      // created_at tersimpan sebagai timestamptz (UTC) — dibandingkan
      // sebagai tanggal lokal (YYYY-MM-DD) supaya "20 Agu" tetap cocok
      // walau jamnya lewat tengah malam UTC.
      if (dariTanggal || sampaiTanggal) {
        const tgl = new Date(r.created_at);
        const tglLokal = tgl.getFullYear() + '-' + String(tgl.getMonth() + 1).padStart(2, '0') + '-' + String(tgl.getDate()).padStart(2, '0');
        if (dariTanggal && tglLokal < dariTanggal) return false;
        if (sampaiTanggal && tglLokal > sampaiTanggal) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.nama?.toLowerCase().includes(q) && !r.no_hp?.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, sumberFilter, dariTanggal, sampaiTanggal, search]);

  // Filter berganti -> balik ke halaman 1, supaya tidak "nyangkut" di
  // halaman yang jadi kosong gara-gara hasil pencarian baru lebih sedikit.
  useEffect(() => { setHalaman(1); }, [statusFilter, sumberFilter, dariTanggal, sampaiTanggal, search]);

  const totalHalaman = Math.max(1, Math.ceil(filteredRows.length / HALAMAN_UKURAN));
  const pageRows = useMemo(
    () => filteredRows.slice((halaman - 1) * HALAMAN_UKURAN, halaman * HALAMAN_UKURAN),
    [filteredRows, halaman]
  );

  const ringkasan = useMemo(() => {
    const hasil = {};
    for (const key of Object.keys(STATUS_LEAD)) hasil[key] = 0;
    for (const r of rows) hasil[r.status] = (hasil[r.status] || 0) + 1;
    return hasil;
  }, [rows]);

  const rasioKonversi = rows.length > 0 ? Math.round((ringkasan.JADI_JAMAAH / rows.length) * 100) : 0;

  function eksporCSV() {
    unduhCSV(
      'leads.csv',
      ['Nama', 'No. HP', 'Email', 'Minat Paket', 'Jumlah Pax', 'Sumber', 'Status', 'Follow-up Berikutnya', 'Catatan', 'Tanggal Masuk'],
      filteredRows.map((r) => [
        r.nama, r.no_hp, r.email || '', r.paket?.nama || '', r.jumlah_pax || '', SUMBER_LABEL[r.sumber] || r.sumber,
        STATUS_LEAD[r.status]?.label || r.status, r.follow_up_at ? tanggalID(r.follow_up_at) : '', r.catatan || '', tanggalID(r.created_at),
      ])
    );
  }

  function toggleTerpilih(id) {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTerpilihSemuaHalaman() {
    setTerpilih((prev) => {
      const idHalaman = pageRows.map((r) => r.id);
      const semuaTerpilih = idHalaman.every((id) => prev.has(id));
      const next = new Set(prev);
      if (semuaTerpilih) idHalaman.forEach((id) => next.delete(id));
      else idHalaman.forEach((id) => next.add(id));
      return next;
    });
  }

  async function terapkanStatusMassal() {
    if (terpilih.size === 0) return;
    setMenerapkanMassal(true);
    const { error: err } = await supabase.from('leads').update({ status: statusMassal }).in('id', Array.from(terpilih));
    setMenerapkanMassal(false);
    if (err) {
      window.alert('Gagal mengubah status: ' + err.message);
      return;
    }
    setTerpilih(new Set());
    load();
  }

  function openAdd() {
    setForm(FORM_KOSONG);
    setFormError('');
    setShowAdd(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    if (!form.nama.trim() || !form.no_hp.trim()) {
      setFormError('Nama dan No. HP wajib diisi.');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('leads').insert({
      nama: form.nama.trim(),
      no_hp: form.no_hp.trim(),
      email: form.email.trim() || null,
      jenis_kelamin: form.jenis_kelamin || null,
      minat_paket_id: form.paket_id || null,
      sumber: form.sumber,
      jumlah_pax: form.jumlah_pax ? Number(form.jumlah_pax) : null,
      follow_up_at: form.follow_up_at || null,
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
    setDetailPax(row.jumlah_pax || '');
    setDetailFollowUp(row.follow_up_at || '');
    setDetailJenisKelamin(row.jenis_kelamin || '');
    setDetailError('');
  }

  function detailPayload() {
    return {
      catatan: detailCatatan.trim() || null,
      jumlah_pax: detailPax ? Number(detailPax) : null,
      follow_up_at: detailFollowUp || null,
      jenis_kelamin: detailJenisKelamin || null,
    };
  }

  async function ubahStatus(status) {
    if (!detailTarget) return;
    setDetailError('');
    setSavingDetail(true);
    const { error: err } = await supabase.from('leads').update({ status, ...detailPayload() }).eq('id', detailTarget.id);
    setSavingDetail(false);
    if (err) {
      setDetailError(err.message);
      return;
    }
    setDetailTarget(null);
    load();
  }

  async function simpanPerubahan() {
    if (!detailTarget) return;
    setDetailError('');
    setSavingDetail(true);
    const { error: err } = await supabase.from('leads').update(detailPayload()).eq('id', detailTarget.id);
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
          jenis_kelamin: detailTarget.jenis_kelamin || '',
          paket_id: detailTarget.minat_paket_id || '',
          lead_id: detailTarget.id,
        },
      },
    });
  }

  const hariIni = todayISO();
  const semuaHalamanTerpilih = pageRows.length > 0 && pageRows.every((r) => terpilih.has(r.id));

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Leads / Calon Jamaah</h1>
          <p className="text-ink-soft text-sm mt-1">Prospek dari landing page atau dicatat manual staf.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={eksporCSV}
            className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-2 px-4 rounded-md2 text-sm"
          >
            ⭳ Ekspor CSV
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={openAdd}
              className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
            >
              + Catat Lead
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-2">
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
      <p className="text-xs text-ink-soft mb-4">
        Rasio konversi: <b className="text-ink">{rasioKonversi}%</b> jadi jamaah dari {rows.length} lead yang tercatat.
      </p>

      <div className="card rounded-xl2 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Cari</label>
            <input
              type="search"
              placeholder="Nama / No. HP"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field w-full rounded-md2 px-3 py-2 text-sm"
            />
          </div>
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
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Sumber</label>
            <select
              value={sumberFilter}
              onChange={(e) => setSumberFilter(e.target.value)}
              className="field w-full rounded-md2 px-3 py-2 text-sm"
            >
              {SUMBER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Masuk Dari</label>
            <input type="date" value={dariTanggal} onChange={(e) => setDariTanggal(e.target.value)} className="field w-full rounded-md2 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Sampai</label>
            <input type="date" value={sampaiTanggal} onChange={(e) => setSampaiTanggal(e.target.value)} className="field w-full rounded-md2 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      {canWrite && terpilih.size > 0 && (
        <div className="card rounded-xl2 p-3 mb-4 flex flex-wrap items-center gap-2 border-l-4 border-l-accent">
          <span className="text-sm font-semibold">{terpilih.size} dipilih</span>
          <select value={statusMassal} onChange={(e) => setStatusMassal(e.target.value)} className="field rounded-md2 px-3 py-1.5 text-sm">
            {Object.entries(STATUS_LEAD).filter(([k]) => k !== 'JADI_JAMAAH').map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <button
            type="button"
            onClick={terapkanStatusMassal}
            disabled={menerapkanMassal}
            className="bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-1.5 px-3 rounded-md2 text-sm"
          >
            {menerapkanMassal ? 'Menerapkan...' : 'Terapkan Status'}
          </button>
          <button type="button" onClick={() => setTerpilih(new Set())} className="text-xs font-semibold text-ink-soft hover:underline ml-auto">
            Batal pilih
          </button>
        </div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                {canWrite && (
                  <th className="p-4 w-10">
                    <input type="checkbox" checked={semuaHalamanTerpilih} onChange={toggleTerpilihSemuaHalaman} className="w-4 h-4" aria-label="Pilih semua di halaman ini" />
                  </th>
                )}
                <th className="p-4">Nama</th>
                <th className="p-4 whitespace-nowrap">Jenis Kelamin</th>
                <th className="p-4 whitespace-nowrap">Minat Paket</th>
                <th className="p-4 whitespace-nowrap text-center">Pax</th>
                <th className="p-4 whitespace-nowrap">Sumber</th>
                <th className="p-4 whitespace-nowrap">Tanggal Masuk</th>
                <th className="p-4 whitespace-nowrap">Follow-up</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={10} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr><td colSpan={10} className="p-10 text-center text-ink-soft">Tidak ada lead yang cocok.</td></tr>
              )}
              {pageRows.map((r) => {
                const wa = waLink(r.no_hp);
                const followUpLewat = r.follow_up_at && r.follow_up_at < hariIni && !['JADI_JAMAAH', 'TIDAK_TERTARIK'].includes(r.status);
                return (
                  <tr key={r.id} className={terpilih.has(r.id) ? 'bg-accent-soft/40' : ''}>
                    {canWrite && (
                      <td className="p-4">
                        <input type="checkbox" checked={terpilih.has(r.id)} onChange={() => toggleTerpilih(r.id)} className="w-4 h-4" aria-label={`Pilih ${r.nama}`} />
                      </td>
                    )}
                    <td className="p-4">
                      <p className="font-medium">{r.nama}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] text-ink-soft">{r.no_hp}</p>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat WhatsApp"
                            onClick={(e) => e.stopPropagation()}
                            className="text-teal-600 hover:text-teal-700"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M12 2C6.5 2 2 6.4 2 11.9c0 1.8.5 3.5 1.3 5L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.4 10-9.9S17.5 2 12 2Zm5.8 14.1c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-2.9-1.3-4.8-4.2-5-4.4-.1-.2-1.2-1.6-1.2-3s.8-2.2 1-2.5c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5.2.5.8 1.9.8 2 .1.2.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.4-.4.5-.1.1-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.6-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.7.8 2 .9.3.2.5.2.6.3.1.2.1.8-.1 1.5Z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {r.jenis_kelamin === 'L' && <span className="text-xs font-semibold text-blue-600">Laki-laki</span>}
                      {r.jenis_kelamin === 'P' && <span className="text-xs font-semibold text-pink-600">Perempuan</span>}
                      {!r.jenis_kelamin && <span className="text-xs text-ink-soft">-</span>}
                    </td>
                    <td className="p-4">
                      {r.paket?.nama || '-'}
                      {r.catatan && <p className="text-[11px] text-ink-soft mt-0.5 max-w-[220px] truncate" title={r.catatan}>{r.catatan}</p>}
                    </td>
                    <td className="tabular p-4 text-center">{r.jumlah_pax || '-'}</td>
                    <td className="p-4 whitespace-nowrap">{SUMBER_LABEL[r.sumber] || r.sumber}</td>
                    <td className="p-4 whitespace-nowrap text-ink-soft">{tanggalID(r.created_at)}</td>
                    <td className={`p-4 whitespace-nowrap ${followUpLewat ? 'text-brick-600 font-semibold' : 'text-ink-soft'}`}>
                      {r.follow_up_at ? tanggalID(r.follow_up_at) : '-'}{followUpLewat && ' · Lewat'}
                    </td>
                    <td className="p-4 text-center">
                      <Pil nada={STATUS_LEAD[r.status]?.nada || 'mute'}>{STATUS_LEAD[r.status]?.label || r.status}</Pil>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <GrupAksi>
                        <Aksi onClick={() => openDetail(r)}>Detail</Aksi>
                      </GrupAksi>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalHalaman > 1 && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-rule">
            <p className="text-xs text-ink-soft">Halaman {halaman} dari {totalHalaman} · {filteredRows.length} lead</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={halaman <= 1}
                onClick={() => setHalaman((h) => Math.max(1, h - 1))}
                className="text-xs font-semibold py-1.5 px-3 rounded-md2 bg-accent-soft text-accent-text disabled:opacity-40"
              >
                ← Sebelumnya
              </button>
              <button
                type="button"
                disabled={halaman >= totalHalaman}
                onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))}
                className="text-xs font-semibold py-1.5 px-3 rounded-md2 bg-accent-soft text-accent-text disabled:opacity-40"
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Catat Lead */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Catat Lead</h2>
              <button type="button" onClick={() => setShowAdd(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama</label>
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
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Kelamin (opsional)</label>
                <select value={form.jenis_kelamin} onChange={(e) => setForm((f) => ({ ...f, jenis_kelamin: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="">— Belum diisi —</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
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
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Sumber</label>
                <select value={form.sumber} onChange={(e) => setForm((f) => ({ ...f, sumber: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  {Object.entries(SUMBER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jumlah Pax (opsional)</label>
                  <input type="number" min="1" placeholder="mis. 4" value={form.jumlah_pax} onChange={(e) => setForm((f) => ({ ...f, jumlah_pax: e.target.value }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Follow-up Berikutnya</label>
                  <input type="date" value={form.follow_up_at} onChange={(e) => setForm((f) => ({ ...f, follow_up_at: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
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

      {/* Modal: Detail Lead */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">{detailTarget.nama}<LabelGender jenisKelamin={detailTarget.jenis_kelamin} /></h2>
              <button type="button" onClick={() => setDetailTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>

            <div className="space-y-1 text-sm mb-4">
              <p><span className="text-ink-soft">No. HP:</span> {detailTarget.no_hp}</p>
              {detailTarget.email && <p><span className="text-ink-soft">Email:</span> {detailTarget.email}</p>}
              <p><span className="text-ink-soft">Minat Paket:</span> {detailTarget.paket?.nama || '-'}</p>
              <p><span className="text-ink-soft">Sumber:</span> {SUMBER_LABEL[detailTarget.sumber] || detailTarget.sumber}</p>
              <p><span className="text-ink-soft">Tanggal Masuk:</span> {tanggalID(detailTarget.created_at)}</p>
              <p className="flex items-center gap-2"><span className="text-ink-soft">Status:</span> <Pil nada={STATUS_LEAD[detailTarget.status]?.nada || 'mute'}>{STATUS_LEAD[detailTarget.status]?.label}</Pil></p>
            </div>

            {canWrite && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jumlah Pax</label>
                    <input type="number" min="1" value={detailPax} onChange={(e) => setDetailPax(e.target.value)} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Follow-up Berikutnya</label>
                    <input type="date" value={detailFollowUp} onChange={(e) => setDetailFollowUp(e.target.value)} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Kelamin</label>
                  <select value={detailJenisKelamin} onChange={(e) => setDetailJenisKelamin(e.target.value)} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                    <option value="">— Belum diisi —</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan</label>
                  <textarea rows={3} value={detailCatatan} onChange={(e) => setDetailCatatan(e.target.value)} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
                </div>

                {detailError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2 mb-3">{detailError}</p>}

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button type="button" disabled={savingDetail} onClick={() => ubahStatus('DIHUBUNGI')} className="text-xs font-semibold py-2 rounded-md2 bg-accent-soft text-accent-text disabled:opacity-60">Tandai Dihubungi</button>
                  <button type="button" disabled={savingDetail} onClick={() => ubahStatus('TERTARIK')} className="text-xs font-semibold py-2 rounded-md2 bg-accent-soft text-accent-text disabled:opacity-60">Tandai Tertarik</button>
                  <button type="button" disabled={savingDetail} onClick={() => ubahStatus('TIDAK_TERTARIK')} className="text-xs font-semibold py-2 rounded-md2 bg-brick-100 text-brick-600 disabled:opacity-60">Tidak Tertarik</button>
                  <button type="button" disabled={savingDetail} onClick={simpanPerubahan} className="text-xs font-semibold py-2 rounded-md2 bg-paper-raised border border-rule disabled:opacity-60">Simpan Perubahan</button>
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
