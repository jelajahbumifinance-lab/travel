import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID } from '../lib/format';
import { unduhCSV } from '../lib/csv';
import { StatusPil, STATUS_PENDAFTARAN, STATUS_KOMISI, Aksi } from '../components/ui';
import SearchSelect from '../components/SearchSelect';

const JENIS_MITRA_LABEL = { INDIVIDU: 'Individu', PERUSAHAAN: 'Perusahaan' };

const STATUS_LEAD = {
  BARU: { label: 'Baru', nada: 'info' },
  DIHUBUNGI: { label: 'Dihubungi', nada: 'warn' },
  TERTARIK: { label: 'Tertarik', nada: 'warn' },
  TIDAK_TERTARIK: { label: 'Tidak Tertarik', nada: 'mute' },
  JADI_JAMAAH: { label: 'Jadi Jamaah', nada: 'ok' },
};

const LEAD_FORM_KOSONG = { nama: '', no_hp: '', email: '', paket_id: '', catatan: '' };

const PROFIL_KOSONG = {
  full_name: '', phone: '', alamat: '', nik: '', jenis_mitra: 'INDIVIDU', nama_perusahaan: '', npwp: '',
  nama_bank: '', nomor_rekening: '', nama_pemilik_rekening: '',
};

// Sama persis polanya dengan grafik arus kas di Dashboard.jsx staf —
// portal ini seharusnya terasa seperti "dashboard", bukan sekadar
// kumpulan tabel, walau datanya beda (komisi milik agen, bukan buku
// kas seluruh JBI).
const CHART_AKRUAL_COLOR = '#F0791A';
const CHART_CAIR_COLOR = '#0D8088';

function KomisiChart({ data }) {
  const width = 640;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (data.every((d) => d.akrual === 0 && d.cair === 0)) {
    return <p className="text-xs text-ink-soft h-40 flex items-center">Belum ada komisi tercatat.</p>;
  }

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.akrual, d.cair)));
  const groupW = chartW / data.length;
  const barW = Math.min(22, groupW * 0.32);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" role="img" aria-label="Grafik komisi 6 bulan terakhir">
      {data.map((d, i) => {
        const cx = padding.left + groupW * i + groupW / 2;
        const akrualH = (d.akrual / maxVal) * chartH;
        const cairH = (d.cair / maxVal) * chartH;
        return (
          <g key={d.label}>
            <rect x={cx - barW - 2} y={padding.top + chartH - akrualH} width={barW} height={akrualH} rx={3} fill={CHART_AKRUAL_COLOR} />
            <rect x={cx + 2} y={padding.top + chartH - cairH} width={barW} height={cairH} rx={3} fill={CHART_CAIR_COLOR} />
            <text x={cx} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--ink-soft))">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

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

  const [mengajukanId, setMengajukanId] = useState(null);

  const [riwayatTarget, setRiwayatTarget] = useState(null); // baris jamaah
  const [riwayatRows, setRiwayatRows] = useState([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);

  // Calon jamaah (leads) yang dicatat sendiri oleh agen — lihat
  // sql/0017_crm_agen.sql. Terpisah dari jamaah yang sudah benar-benar
  // terdaftar (tabel di atas), ini baru sebatas prospek.
  const [leadRows, setLeadRows] = useState([]);
  const [paketList, setPaketList] = useState([]);
  const [showAddLead, setShowAddLead] = useState(false);
  const [leadForm, setLeadForm] = useState(LEAD_FORM_KOSONG);
  const [leadError, setLeadError] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  // Update status/catatan calon jamaah sendiri (mis. "sudah mau DP,
  // tolong didaftarkan") — lihat sql/0020_leads_update_agen.sql. Agen
  // tidak bisa mencatat pembayaran sendiri, cuma mengabari staf.
  const [leadDetailTarget, setLeadDetailTarget] = useState(null);
  const [leadDetailStatus, setLeadDetailStatus] = useState('BARU');
  const [leadDetailCatatan, setLeadDetailCatatan] = useState('');
  const [leadDetailError, setLeadDetailError] = useState('');
  const [savingLeadDetail, setSavingLeadDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // RLS menyaring semuanya otomatis ke baris milik agen yang sedang login —
    // tidak ada filter agen_id eksplisit di query karena tidak perlu:
    // sql/0004_komisi_agen.sql bagian 6 dan sql/0017_crm_agen.sql sudah
    // membatasinya di level database.
    const [pendaftaranRes, komisiRes, profilRes, leadsRes, paketRes] = await Promise.all([
      supabase.from('v_pendaftaran_status').select('*').order('created_at', { ascending: false }),
      supabase.from('v_komisi_agen').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('leads').select('*, paket:minat_paket_id(nama)').order('created_at', { ascending: false }),
      supabase.from('paket').select('id, nama').eq('is_active', true).order('nama'),
    ]);
    if (pendaftaranRes.error || komisiRes.error || profilRes.error) {
      setError(pendaftaranRes.error?.message || komisiRes.error?.message || profilRes.error?.message);
      setLoading(false);
      return;
    }
    setJamaahRows(pendaftaranRes.data || []);
    setKomisiRows(komisiRes.data || []);
    setProfilLengkap(profilRes.data);
    setLeadRows(leadsRes.data || []);
    setPaketList(paketRes.data || []);
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

  async function ajukanPencairan(k) {
    if (!window.confirm(`Ajukan pencairan komisi ${rupiah(k.nominal)} untuk ${k.jamaah_nama}? Admin JBI akan memprosesnya.`)) return;
    setMengajukanId(k.id);
    const { error: err } = await supabase.rpc('ajukan_pencairan_komisi', { p_komisi_id: k.id });
    setMengajukanId(null);
    if (err) { window.alert('Gagal mengajukan: ' + err.message); return; }
    load();
  }

  async function bukaRiwayat(row) {
    setRiwayatTarget(row);
    setRiwayatLoading(true);
    const { data } = await supabase
      .from('cicilan')
      .select('id, nominal, tanggal, no_kuitansi, is_void')
      .eq('pendaftaran_id', row.id)
      .order('tanggal', { ascending: false });
    setRiwayatRows(data || []);
    setRiwayatLoading(false);
  }

  function openAddLead() {
    setLeadForm(LEAD_FORM_KOSONG);
    setLeadError('');
    setShowAddLead(true);
  }

  async function handleAddLead(e) {
    e.preventDefault();
    setLeadError('');
    if (!leadForm.nama.trim() || !leadForm.no_hp.trim()) {
      setLeadError('Nama dan No. HP wajib diisi.');
      return;
    }
    setSavingLead(true);
    const { error: err } = await supabase.from('leads').insert({
      nama: leadForm.nama.trim(),
      no_hp: leadForm.no_hp.trim(),
      email: leadForm.email.trim() || null,
      minat_paket_id: leadForm.paket_id || null,
      catatan: leadForm.catatan.trim() || null,
      agen_id: user.id,
      sumber: 'AGEN',
      status: 'BARU',
    });
    setSavingLead(false);
    if (err) {
      setLeadError(err.message);
      return;
    }
    setShowAddLead(false);
    load();
  }

  function openLeadDetail(row) {
    setLeadDetailTarget(row);
    setLeadDetailStatus(row.status);
    setLeadDetailCatatan(row.catatan || '');
    setLeadDetailError('');
  }

  async function handleSaveLeadDetail(e) {
    e.preventDefault();
    if (!leadDetailTarget) return;
    setLeadDetailError('');
    setSavingLeadDetail(true);
    const { error: err } = await supabase
      .from('leads')
      .update({ status: leadDetailStatus, catatan: leadDetailCatatan.trim() || null })
      .eq('id', leadDetailTarget.id);
    setSavingLeadDetail(false);
    if (err) {
      setLeadDetailError(err.message);
      return;
    }
    setLeadDetailTarget(null);
    load();
  }

  function eksporLaporan() {
    unduhCSV(
      'laporan-agen.csv',
      ['Jamaah', 'Paket', 'Total Tagihan', 'Sisa', 'Status Pendaftaran'],
      jamaahRows.map((r) => [r.jamaah_nama, r.paket_nama, r.total_tagihan, r.sisa, r.computed_status])
    );
  }

  const totalAkrual = komisiRows.filter((k) => k.status === 'AKRUAL').reduce((s, k) => s + Number(k.nominal), 0);
  const totalCair = komisiRows.filter((k) => k.status === 'CAIR').reduce((s, k) => s + Number(k.nominal), 0);

  const chartData = useMemo(() => {
    const buckets = {};
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets[key] = { label: d.toLocaleDateString('id-ID', { month: 'short' }), akrual: 0, cair: 0 };
      labels.push(key);
    }
    komisiRows.forEach((k) => {
      if (k.status === 'BATAL') return;
      const key = String(k.created_at).slice(0, 7);
      if (!buckets[key]) return;
      buckets[key].akrual += Number(k.nominal) || 0;
      if (k.status === 'CAIR') buckets[key].cair += Number(k.nominal) || 0;
    });
    return labels.map((k) => buckets[k]);
  }, [komisiRows]);

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
        <div className="flex gap-2">
          <button type="button" onClick={eksporLaporan} className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-2 px-4 rounded-md2 text-sm">
            ⭳ Ekspor Laporan
          </button>
          <button type="button" onClick={openEditProfil} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
            Lengkapi Profil
          </button>
        </div>
      </div>

      {rekeningBelumDiisi && (
        <div className="card rounded-xl2 p-4 mb-6 border-l-4 border-l-accent text-sm">
          <b>Nomor rekening belum diisi.</b> Lengkapi profil Anda supaya admin JBI tahu ke mana komisi harus dicairkan.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Jamaah Terdaftar</p>
          <p className="tabular text-xl font-semibold mt-0.5">{jamaahRows.length}</p>
        </div>
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Komisi Belum Cair</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-orange-600">{rupiah(totalAkrual)}</p>
        </div>
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Komisi Sudah Cair</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-teal-700">{rupiah(totalCair)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div className="card rounded-xl2 p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-semibold">Profil Saya</p>
            <button type="button" onClick={openEditProfil} className="text-xs font-semibold text-accent-text hover:underline">
              Lengkapi →
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium truncate">{profilLengkap?.full_name || '-'}</p>
              <p className="text-[11px] text-ink-soft">
                {JENIS_MITRA_LABEL[profilLengkap?.jenis_mitra] || 'Jenis mitra belum diisi'}
                {profilLengkap?.nama_perusahaan ? ` · ${profilLengkap.nama_perusahaan}` : ''}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-ink-soft">No. HP</p>
              <p className="text-sm">{profilLengkap?.phone || '-'}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-ink-soft shrink-0">Rekening</p>
              <p className="text-sm text-right truncate">
                {profilLengkap?.nomor_rekening ? `${profilLengkap.nama_bank || ''} · ${profilLengkap.nomor_rekening}` : 'Belum diisi'}
              </p>
            </div>
          </div>
        </div>

        <div className="card rounded-xl2 p-4 lg:col-span-2">
          <p className="font-display font-semibold mb-2">Komisi per Bulan (6 Bulan Terakhir)</p>
          <div className="flex items-center gap-4 mb-2 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" /> Akrual</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" /> Cair</span>
          </div>
          <KomisiChart data={chartData} />
        </div>
      </div>

      <div className="card rounded-xl2 p-4 mb-8">
        <p className="font-display font-semibold mb-3">Aktivitas Terbaru</p>
        <div className="space-y-3">
          {komisiRows.length === 0 && <p className="text-xs text-ink-soft">Belum ada komisi tercatat.</p>}
          {komisiRows.slice(0, 8).map((k) => (
            <div key={k.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-md2 flex items-center justify-center text-xs font-bold shrink-0 ${k.status === 'CAIR' ? 'bg-teal-100 text-teal-700' : k.status === 'BATAL' ? 'bg-rule text-ink-soft' : 'bg-orange-100 text-orange-600'}`}>
                {k.status === 'CAIR' ? '✓' : k.status === 'BATAL' ? '✕' : '+'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{k.jamaah_nama} — {k.paket_nama}</p>
                <p className="text-[11px] text-ink-soft">{tanggalID(k.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="tabular text-sm font-semibold">{rupiah(k.nominal)}</p>
                <StatusPil peta={STATUS_KOMISI} nilai={k.status} bawaan="AKRUAL" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold">Calon Jamaah Saya</h2>
        <button type="button" onClick={openAddLead} className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-1.5 px-3 rounded-md2 text-xs">
          + Tambah Calon Jamaah
        </button>
      </div>
      <div className="card rounded-xl2 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Nama</th>
                <th className="p-4 whitespace-nowrap">Minat Paket</th>
                <th className="p-4 whitespace-nowrap">Tanggal</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {leadRows.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-ink-soft">Belum ada calon jamaah yang Anda catat.</td></tr>
              )}
              {leadRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-4">
                    <p className="font-medium">{r.nama}</p>
                    <p className="text-[11px] text-ink-soft">{r.no_hp}</p>
                  </td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{r.paket?.nama || '-'}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{tanggalID(r.created_at)}</td>
                  <td className="p-4 text-center">
                    <StatusPil peta={STATUS_LEAD} nilai={r.status} bawaan="BARU" />
                  </td>
                  <td className="p-4 text-center">
                    {r.status === 'JADI_JAMAAH' ? (
                      <span className="text-[11px] text-ink-soft">—</span>
                    ) : (
                      <Aksi onClick={() => openLeadDetail(r)}>Update</Aksi>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <th className="p-4 whitespace-nowrap text-center">Riwayat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {jamaahRows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Belum ada jamaah yang Anda daftarkan.</td></tr>
              )}
              {jamaahRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-4 font-medium">{r.jamaah_nama}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{r.paket_nama}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(r.total_tagihan)}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap font-semibold">{rupiah(Math.max(0, r.sisa))}</td>
                  <td className="p-4 text-center"><StatusPil peta={STATUS_PENDAFTARAN} nilai={r.computed_status} bawaan="BELUM_BAYAR" /></td>
                  <td className="p-4 text-center"><Aksi onClick={() => bukaRiwayat(r)}>Lihat</Aksi></td>
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
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {komisiRows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Belum ada komisi tercatat.</td></tr>
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
                  <td className="p-4 text-center whitespace-nowrap">
                    {k.status === 'AKRUAL' && k.jamaah_lunas && (
                      <Aksi jenis="utama" onClick={() => ajukanPencairan(k)} disabled={mengajukanId === k.id}>
                        {mengajukanId === k.id ? '...' : 'Ajukan Pencairan'}
                      </Aksi>
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

      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddLead(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Tambah Calon Jamaah</h2>
              <button type="button" onClick={() => setShowAddLead(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama</label>
                <input type="text" value={leadForm.nama} onChange={(e) => setLeadForm((f) => ({ ...f, nama: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP</label>
                <input type="text" value={leadForm.no_hp} onChange={(e) => setLeadForm((f) => ({ ...f, no_hp: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Email (opsional)</label>
                <input type="email" value={leadForm.email} onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Minat Paket (opsional)</label>
                <SearchSelect
                  value={leadForm.paket_id}
                  onChange={(v) => setLeadForm((f) => ({ ...f, paket_id: v }))}
                  options={paketList.map((p) => ({ value: p.id, label: p.nama }))}
                  placeholder="Belum tahu paket"
                  emptyLabel="Belum tahu paket"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan (opsional)</label>
                <textarea rows={2} value={leadForm.catatan} onChange={(e) => setLeadForm((f) => ({ ...f, catatan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              {leadError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{leadError}</p>}
              <button type="submit" disabled={savingLead} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingLead ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {leadDetailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setLeadDetailTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{leadDetailTarget.nama}</h2>
              <button type="button" onClick={() => setLeadDetailTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <p className="text-xs text-ink-soft mb-4">
              Kabari staf JBI kalau ada perkembangan — mis. sudah siap DP — lewat catatan di bawah. Pendaftaran &amp; pembayaran tetap diproses staf lewat Tagihan.
            </p>
            <form onSubmit={handleSaveLeadDetail} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Status</label>
                <select value={leadDetailStatus} onChange={(e) => setLeadDetailStatus(e.target.value)} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="BARU">Baru</option>
                  <option value="DIHUBUNGI">Sudah Dihubungi</option>
                  <option value="TERTARIK">Tertarik / Siap DP</option>
                  <option value="TIDAK_TERTARIK">Tidak Berminat</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan untuk Staf</label>
                <textarea rows={3} value={leadDetailCatatan} onChange={(e) => setLeadDetailCatatan(e.target.value)} placeholder="mis. Sudah mau DP Rp 5.000.000, minta didaftarkan." className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              {leadDetailError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{leadDetailError}</p>}
              <button type="submit" disabled={savingLeadDetail} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingLeadDetail ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {riwayatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setRiwayatTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold">Riwayat Pembayaran</h2>
                <p className="text-xs text-ink-soft mt-0.5">{riwayatTarget.jamaah_nama} — {riwayatTarget.paket_nama}</p>
              </div>
              <button type="button" onClick={() => setRiwayatTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            {riwayatLoading && <p className="text-sm text-ink-soft">Memuat...</p>}
            {!riwayatLoading && riwayatRows.length === 0 && <p className="text-sm text-ink-soft">Belum ada pembayaran tercatat.</p>}
            {!riwayatLoading && riwayatRows.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {riwayatRows.map((c) => (
                  <div key={c.id} className={`flex items-center justify-between border-b border-rule pb-2 ${c.is_void ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-sm font-medium tabular">{rupiah(c.nominal)}</p>
                      <p className="text-[11px] text-ink-soft">{tanggalID(c.tanggal)} · {c.no_kuitansi}{c.is_void && ' · Dibatalkan'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
