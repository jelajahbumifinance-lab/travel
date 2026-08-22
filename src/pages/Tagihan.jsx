import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID, formatRibuan } from '../lib/format';
import { Aksi, GrupAksi, StatusPil, STATUS_PENDAFTARAN } from '../components/ui';
import Kuitansi from '../components/Kuitansi';
import SearchSelect from '../components/SearchSelect';

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Jamaah & agen bisa membengkak tak terbatas (ribuan baris setelah bertahun
// beroperasi) — dicari ke server per ketikan, bukan ditarik penuh ke
// browser seperti paket/vendor yang jumlahnya wajar dimuat sekaligus.
async function fetchJamaahOptions(query) {
  let q = supabase.from('jamaah').select('id, nama, no_hp');
  if (query.trim()) q = q.ilike('nama', `%${query.trim()}%`);
  const { data } = await q.order('nama').limit(20);
  return (data || []).map((j) => ({ value: j.id, label: j.nama, sub: j.no_hp || undefined }));
}

async function fetchAgenOptions(query) {
  let q = supabase.from('profiles').select('id, full_name').eq('role', 'agen').eq('is_active', true);
  if (query.trim()) q = q.ilike('full_name', `%${query.trim()}%`);
  const { data } = await q.order('full_name').limit(20);
  return (data || []).map((a) => ({ value: a.id, label: a.full_name }));
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'BELUM_BAYAR', label: 'Belum bayar' },
  { value: 'DICICIL', label: 'Dicicil' },
  { value: 'LEWAT_TEMPO', label: 'Lewat tempo' },
  { value: 'LUNAS', label: 'Lunas' },
];

export default function Tagihan() {
  const { profile, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canWrite = ['direktur', 'admin_keuangan', 'kasir'].includes(profile?.role);
  const canVoid = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const [rows, setRows] = useState([]);
  const [paketList, setPaketList] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paketFilter, setPaketFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  // null = filter tanggal tidak aktif. Diisi id pendaftaran yang punya
  // pembayaran (cicilan) pada tanggal terpilih — bukan tanggal jatuh tempo
  // atau tanggal pendaftaran, sesuai yang diminta: "siapa yang bertransaksi
  // di tanggal itu".
  const [pendaftaranIdsOnDate, setPendaftaranIdsOnDate] = useState(null);
  const [dateFilterLoading, setDateFilterLoading] = useState(false);

  // Modal: daftarkan jamaah ke paket
  const [showDaftar, setShowDaftar] = useState(false);
  const [modeJamaahBaru, setModeJamaahBaru] = useState(true);
  const [daftarForm, setDaftarForm] = useState({
    jamaah_id: '', nama: '', nik: '', no_hp: '', jenis_kelamin: '', agen_id: '',
    paket_id: '', total_tagihan: '', jatuh_tempo_berikutnya: '',
  });
  // Kalau lead yang didaftarkan punya jumlah_pax > 1 (mis. 1 lead mewakili
  // rombongan keluarga), form ini jalan sebagai wizard "Jamaah X dari N" —
  // submit tidak langsung menutup modal, tapi lanjut ke jamaah berikutnya
  // dengan paket yang sama, sampai semua orang di rombongan tercatat.
  const [daftarPax, setDaftarPax] = useState({ ke: 1, total: 1 });
  const [daftarError, setDaftarError] = useState('');
  const [savingDaftar, setSavingDaftar] = useState(false);

  // Modal: catat pembayaran
  const [payTarget, setPayTarget] = useState(null); // baris v_pendaftaran_status
  const [payForm, setPayForm] = useState({ amount: '', category_id: '', account_id: '', date: todayISO(), description: '' });
  const [payError, setPayError] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  // Modal: riwayat pembayaran
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Modal: ubah data jamaah (nama/NIK/No. HP/jenis kelamin) — sebelum
  // ini tidak ada cara membetulkan data jamaah sama sekali setelah
  // didaftarkan, termasuk mengisi jenis_kelamin untuk jamaah lama.
  const [editJamaahTarget, setEditJamaahTarget] = useState(null); // baris v_pendaftaran_status
  const [editJamaahForm, setEditJamaahForm] = useState({ nama: '', nik: '', no_hp: '', jenis_kelamin: '' });
  const [editJamaahError, setEditJamaahError] = useState('');
  const [savingEditJamaah, setSavingEditJamaah] = useState(false);

  const [cetakData, setCetakData] = useState(null);
  const cetakTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [rowsRes, paketRes, accRes, catRes] = await Promise.all([
      supabase.from('v_pendaftaran_status').select('*').order('jatuh_tempo_berikutnya', { ascending: true, nullsFirst: false }),
      supabase.from('paket').select('id, nama, harga_default, status').eq('is_active', true).order('nama'),
      supabase.from('accounts').select('id, name').eq('is_active', true).order('name'),
      supabase.from('transaction_categories').select('id, name, type').eq('is_active', true).eq('type', 'IN').order('name'),
    ]);
    if (rowsRes.error || paketRes.error || accRes.error || catRes.error) {
      setError(rowsRes.error?.message || paketRes.error?.message || accRes.error?.message || catRes.error?.message);
      setLoading(false);
      return;
    }
    setRows(rowsRes.data || []);
    setPaketList(paketRes.data || []);
    setAccounts(accRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!cetakData) return;
    cetakTimer.current = setTimeout(() => window.print(), 150);
    return () => clearTimeout(cetakTimer.current);
  }, [cetakData]);

  // Dicari ke server tiap tanggal berganti (bukan disaring dari `rows`,
  // yang tidak punya info tanggal cicilan sama sekali — itu daftar
  // pendaftaran, satu baris per jamaah, bukan satu baris per pembayaran).
  useEffect(() => {
    if (!dateFilter) {
      setPendaftaranIdsOnDate(null);
      return;
    }
    let cancelled = false;
    setDateFilterLoading(true);
    supabase
      .from('cicilan')
      .select('pendaftaran_id')
      .eq('tanggal', dateFilter)
      .eq('is_void', false)
      .then(({ data }) => {
        if (cancelled) return;
        setPendaftaranIdsOnDate(new Set((data || []).map((c) => c.pendaftaran_id)));
        setDateFilterLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateFilter]);

  // Pilihan di filter "Paket" HARUS mencakup paket yang sudah nonaktif/
  // selesai juga — paketList (dipakai form "Daftarkan Jamaah" di bawah)
  // sengaja cuma paket aktif supaya tidak salah daftar ke paket yang sudah
  // ditutup, tapi itu jadi bikin filter ini tidak bisa mencari jamaah dari
  // paket yang sudah nonaktif padahal datanya masih ada di tabel. Diambil
  // langsung dari `rows` (v_pendaftaran_status, tidak difilter is_active)
  // supaya semua paket yang punya jamaah tetap bisa dicari.
  const daftarPaketFilter = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => { if (r.paket_id) map.set(r.paket_id, r.paket_nama); });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter && r.computed_status !== statusFilter) return false;
      if (paketFilter && r.paket_id !== paketFilter) return false;
      if (pendaftaranIdsOnDate && !pendaftaranIdsOnDate.has(r.id)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.jamaah_nama?.toLowerCase().includes(q) && !r.paket_nama?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, paketFilter, pendaftaranIdsOnDate, search]);

  // ---- Daftarkan jamaah ----
  function openDaftar(prefill) {
    setModeJamaahBaru(true);
    // Paket yang datang dari prefill (Leads/CRM Agen) langsung disetel ke
    // paket_id, tidak lewat pilihPaket() — jadi total_tagihan tidak ikut
    // terisi otomatis dari harga_default kalau tidak disamakan di sini juga.
    const paketPrefill = prefill?.paket_id ? paketList.find((p) => p.id === prefill.paket_id) : null;
    setDaftarForm({
      jamaah_id: '', nama: '', nik: '', no_hp: '', jenis_kelamin: '', agen_id: '', paket_id: '', total_tagihan: '', jatuh_tempo_berikutnya: '',
      ...prefill,
      total_tagihan: paketPrefill ? formatRibuan(String(paketPrefill.harga_default)) : (prefill?.total_tagihan || ''),
    });
    setDaftarPax({ ke: 1, total: Math.max(1, Number(prefill?.jumlah_pax) || 1) });
    setDaftarError('');
    setShowDaftar(true);
  }

  // Datang dari halaman Leads/CRM Agen — "Daftarkan sebagai Jamaah" membawa
  // data lead lewat state router, bukan query string (supaya tidak nyangkut
  // di riwayat/bookmark). Menunggu load() awal selesai (bukan langsung saat
  // mount) supaya paketList sudah terisi ketika openDaftar mengisi
  // total_tagihan dari harga_default paketnya. Dibersihkan lagi lewat
  // replace supaya refresh atau tombol kembali browser tidak diam-diam
  // membuka modal ini lagi.
  useEffect(() => {
    if (location.state?.prefillDaftar && !loading) {
      openDaftar(location.state.prefillDaftar);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loading]);

  function pilihPaket(paketId) {
    const p = paketList.find((x) => x.id === paketId);
    setDaftarForm((f) => ({ ...f, paket_id: paketId, total_tagihan: p ? formatRibuan(String(p.harga_default)) : f.total_tagihan }));
  }

  async function handleDaftar(e) {
    e.preventDefault();
    setDaftarError('');

    const totalTagihan = Number(String(daftarForm.total_tagihan).replace(/\D/g, ''));
    if (!daftarForm.paket_id || !totalTagihan) {
      setDaftarError('Pilih paket dan isi total tagihan.');
      return;
    }
    if (modeJamaahBaru && !daftarForm.nama.trim()) {
      setDaftarError('Nama jamaah wajib diisi.');
      return;
    }
    if (!modeJamaahBaru && !daftarForm.jamaah_id) {
      setDaftarError('Pilih jamaah yang sudah terdaftar.');
      return;
    }

    setSavingDaftar(true);

    let jamaahId = daftarForm.jamaah_id;
    if (modeJamaahBaru) {
      const { data: jamaahBaru, error: jamaahErr } = await supabase
        .from('jamaah')
        .insert({
          nama: daftarForm.nama.trim(),
          nik: daftarForm.nik.trim() || null,
          no_hp: daftarForm.no_hp.trim() || null,
          jenis_kelamin: daftarForm.jenis_kelamin || null,
          agen_id: daftarForm.agen_id || null,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (jamaahErr) {
        setSavingDaftar(false);
        setDaftarError(jamaahErr.message);
        return;
      }
      jamaahId = jamaahBaru.id;
    }

    const { error: pendaftaranErr } = await supabase.from('pendaftaran').insert({
      jamaah_id: jamaahId,
      paket_id: daftarForm.paket_id,
      total_tagihan: totalTagihan,
      jatuh_tempo_berikutnya: daftarForm.jatuh_tempo_berikutnya || null,
      created_by: user.id,
    });
    setSavingDaftar(false);
    if (pendaftaranErr) {
      setDaftarError(pendaftaranErr.message);
      return;
    }
    // Lead yang tadinya membawa form ini (lihat komponen Leads) sudah
    // benar-benar jadi jamaah — tandai supaya tidak muncul lagi di corong
    // leads yang masih perlu ditindaklanjuti.
    if (daftarForm.lead_id) {
      await supabase.from('leads').update({ status: 'JADI_JAMAAH' }).eq('id', daftarForm.lead_id);
    }

    if (daftarPax.ke < daftarPax.total) {
      // Masih ada anggota rombongan lain dari lead yang sama (jumlah_pax > 1)
      // — form dilanjutkan untuk orang berikutnya dengan paket yang sama,
      // bukan langsung ditutup, supaya staf tidak perlu buka form dari awal
      // satu-satu untuk tiap anggota.
      const paketSaatIni = paketList.find((p) => p.id === daftarForm.paket_id);
      setDaftarForm((f) => ({
        ...f,
        jamaah_id: '', nama: '', nik: '', no_hp: '', jenis_kelamin: '',
        total_tagihan: paketSaatIni ? formatRibuan(String(paketSaatIni.harga_default)) : f.total_tagihan,
      }));
      setDaftarPax((p) => ({ ...p, ke: p.ke + 1 }));
      load();
      return;
    }

    setShowDaftar(false);
    load();
  }

  // ---- Catat pembayaran ----
  function openPay(row) {
    const defaultCategory = categories.find((c) => c.name.toLowerCase().includes('dp'))?.id || categories[0]?.id || '';
    setPayTarget(row);
    setPayForm({
      amount: formatRibuan(String(row.sisa)),
      category_id: defaultCategory,
      account_id: accounts[0]?.id || '',
      date: todayISO(),
      description: `Cicilan — ${row.jamaah_nama} — ${row.paket_nama}`,
    });
    setPayError('');
  }

  async function handlePay(e) {
    e.preventDefault();
    setPayError('');
    const amount = Number(String(payForm.amount).replace(/\D/g, ''));
    if (!amount || !payForm.category_id || !payForm.account_id) {
      setPayError('Nominal, kategori, dan akun wajib diisi.');
      return;
    }
    setSavingPay(true);
    const { error: rpcError } = await supabase.rpc('record_cicilan_payment', {
      p_pendaftaran_id: payTarget.id,
      p_account_id: payForm.account_id,
      p_category_id: payForm.category_id,
      p_amount: amount,
      p_date: payForm.date,
      p_description: payForm.description.trim() || `Cicilan — ${payTarget.jamaah_nama}`,
    });
    setSavingPay(false);
    if (rpcError) {
      setPayError(rpcError.message);
      return;
    }
    setPayTarget(null);
    load();
  }

  // ---- Riwayat pembayaran ----
  async function openHistory(row) {
    setHistoryTarget(row);
    setHistoryLoading(true);
    setHistoryError('');
    const { data, error: histErr } = await supabase
      .from('cicilan')
      .select('id, nominal, tanggal, no_kuitansi, is_void, void_reason')
      .eq('pendaftaran_id', row.id)
      .order('tanggal', { ascending: false });
    if (histErr) {
      setHistoryError(histErr.message);
      setHistoryRows([]);
    } else {
      setHistoryRows(data || []);
    }
    setHistoryLoading(false);
  }

  function openEditJamaah(row) {
    setEditJamaahTarget(row);
    setEditJamaahForm({
      nama: row.jamaah_nama || '',
      nik: row.jamaah_nik || '',
      no_hp: row.jamaah_no_hp || '',
      jenis_kelamin: row.jamaah_jenis_kelamin || '',
    });
    setEditJamaahError('');
  }

  async function handleSubmitEditJamaah(e) {
    e.preventDefault();
    setEditJamaahError('');
    if (!editJamaahForm.nama.trim()) {
      setEditJamaahError('Nama wajib diisi.');
      return;
    }
    setSavingEditJamaah(true);
    const { error: err } = await supabase
      .from('jamaah')
      .update({
        nama: editJamaahForm.nama.trim(),
        nik: editJamaahForm.nik.trim() || null,
        no_hp: editJamaahForm.no_hp.trim() || null,
        jenis_kelamin: editJamaahForm.jenis_kelamin || null,
      })
      .eq('id', editJamaahTarget.jamaah_id);
    setSavingEditJamaah(false);
    if (err) {
      setEditJamaahError(err.message);
      return;
    }
    setEditJamaahTarget(null);
    load();
  }

  async function handleVoidPayment(c) {
    const reason = window.prompt('Alasan pembatalan pembayaran ini?');
    if (!reason || !reason.trim()) return;
    const { error: rpcError } = await supabase.rpc('void_cicilan_payment', { p_cicilan_id: c.id, p_reason: reason.trim() });
    if (rpcError) {
      window.alert('Gagal membatalkan: ' + rpcError.message);
      return;
    }
    openHistory(historyTarget);
    load();
  }

  function cetakKuitansi(c) {
    const terbayarSebelum = historyRows.filter((x) => !x.is_void && x.tanggal <= c.tanggal && x.id !== c.id).reduce((s, x) => s + Number(x.nominal), 0);
    setCetakData({
      noKuitansi: c.no_kuitansi,
      jamaahNama: historyTarget.jamaah_nama,
      paketNama: historyTarget.paket_nama,
      nominal: c.nominal,
      tanggal: c.tanggal,
      totalTagihan: historyTarget.total_tagihan,
      sisaSetelah: historyTarget.total_tagihan - terbayarSebelum - Number(c.nominal),
    });
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tagihan &amp; Cicilan Jamaah</h1>
          <p className="text-ink-soft text-sm mt-1">Pendaftaran jamaah ke paket, DP, dan cicilan bertahap.</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => openDaftar()}
            className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
          >
            + Daftarkan Jamaah
          </button>
        )}
      </div>

      <div className="card rounded-xl2 p-4 mb-4 space-y-3 print:hidden">
        <input
          type="search"
          placeholder="Cari nama jamaah / paket"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field w-full rounded-md2 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="field w-full rounded-md2 px-3 py-2 text-sm"
            >
              {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Paket</label>
            <SearchSelect
              value={paketFilter}
              onChange={setPaketFilter}
              options={daftarPaketFilter}
              placeholder="Semua paket"
              emptyLabel="Semua paket"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">
              Tanggal Transaksi{dateFilterLoading ? ' (mencari...)' : ''}
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="field w-full rounded-md2 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600 print:hidden">{error}</div>
      )}
      {canWrite && paketList.length === 0 && !loading && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-accent text-sm print:hidden">
          Belum ada paket keberangkatan. Buat dulu di menu <b>Paket Keberangkatan</b> sebelum mendaftarkan jamaah.
        </div>
      )}

      <div className="card rounded-xl2 overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Jamaah</th>
                <th className="p-4 whitespace-nowrap">Jenis Kelamin</th>
                <th className="p-4 whitespace-nowrap">Paket</th>
                <th className="p-4 whitespace-nowrap text-right">Total</th>
                <th className="p-4 whitespace-nowrap text-right">Terbayar</th>
                <th className="p-4 whitespace-nowrap text-right">Sisa</th>
                <th className="p-4 whitespace-nowrap text-center">Jatuh Tempo</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={9} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-ink-soft">Tidak ada pendaftaran yang cocok.</td></tr>
              )}
              {filteredRows.map((r) => {
                const lunas = r.computed_status === 'LUNAS' || r.computed_status === 'BATAL';
                return (
                  <tr key={r.id}>
                    <td className="p-4">
                      <p className="font-medium">{r.jamaah_nama}</p>
                      <p className="text-[11px] text-ink-soft">{r.jamaah_no_hp || '-'}</p>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {r.jamaah_jenis_kelamin === 'L' && <span className="text-xs font-semibold text-blue-600">Laki-laki</span>}
                      {r.jamaah_jenis_kelamin === 'P' && <span className="text-xs font-semibold text-pink-600">Perempuan</span>}
                      {!r.jamaah_jenis_kelamin && <span className="text-xs text-ink-soft">-</span>}
                    </td>
                    <td className="p-4 whitespace-nowrap">{r.paket_nama}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(r.total_tagihan)}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(r.terbayar)}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap font-semibold">{rupiah(Math.max(0, r.sisa))}</td>
                    <td className="p-4 text-center whitespace-nowrap text-ink-soft">{r.jatuh_tempo_berikutnya ? tanggalID(r.jatuh_tempo_berikutnya) : '-'}</td>
                    <td className="p-4 text-center">
                      <StatusPil peta={STATUS_PENDAFTARAN} nilai={r.computed_status} bawaan="BELUM_BAYAR" />
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <GrupAksi>
                        <Aksi onClick={() => openHistory(r)}>Riwayat</Aksi>
                        {canWrite && <Aksi onClick={() => openEditJamaah(r)}>Ubah</Aksi>}
                        {canWrite && !lunas && (
                          <Aksi jenis="utama" onClick={() => openPay(r)}>Bayar</Aksi>
                        )}
                      </GrupAksi>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Daftarkan Jamaah */}
      {showDaftar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowDaftar(false); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className={`flex items-center justify-between ${daftarPax.total > 1 ? 'mb-2' : 'mb-5'}`}>
              <h2 className="font-display text-lg font-semibold">Daftarkan Jamaah</h2>
              <button type="button" onClick={() => setShowDaftar(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            {daftarPax.total > 1 && (
              <p className="text-xs font-semibold text-accent-text bg-accent-soft inline-block px-2.5 py-1 rounded-md2 mb-4">
                Jamaah {daftarPax.ke} dari {daftarPax.total} — rombongan dari lead yang sama
              </p>
            )}

            <div className="flex gap-2 mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModeJamaahBaru(true)}
                className={`flex-1 py-2 rounded-md2 ${modeJamaahBaru ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}
              >
                Jamaah Baru
              </button>
              <button
                type="button"
                onClick={() => setModeJamaahBaru(false)}
                className={`flex-1 py-2 rounded-md2 ${!modeJamaahBaru ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}
              >
                Jamaah Terdaftar
              </button>
            </div>

            <form onSubmit={handleDaftar} className="space-y-4" noValidate>
              {modeJamaahBaru ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Jamaah</label>
                    <input
                      type="text"
                      value={daftarForm.nama}
                      onChange={(e) => setDaftarForm((f) => ({ ...f, nama: e.target.value }))}
                      className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">NIK (opsional)</label>
                    <input
                      type="text"
                      value={daftarForm.nik}
                      onChange={(e) => setDaftarForm((f) => ({ ...f, nik: e.target.value.replace(/\D/g, '') }))}
                      className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP / WhatsApp (opsional)</label>
                    <input
                      type="text"
                      value={daftarForm.no_hp}
                      onChange={(e) => setDaftarForm((f) => ({ ...f, no_hp: e.target.value }))}
                      className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Kelamin (opsional)</label>
                    <select
                      value={daftarForm.jenis_kelamin}
                      onChange={(e) => setDaftarForm((f) => ({ ...f, jenis_kelamin: e.target.value }))}
                      className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                    >
                      <option value="">— Belum diisi —</option>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                    <p className="text-[11px] text-ink-soft mt-1">Dipakai di menu Roomlist untuk membantu memisahkan jamaah yang bukan mahram.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Didaftarkan oleh Agen (opsional)</label>
                    <SearchSelect
                      value={daftarForm.agen_id}
                      onChange={(v) => setDaftarForm((f) => ({ ...f, agen_id: v, agen_nama: '' }))}
                      fetchOptions={fetchAgenOptions}
                      valueLabel={daftarForm.agen_nama}
                      placeholder="Ketik nama agen..."
                      emptyLabel="Langsung oleh staf (tanpa agen)"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Pilih Jamaah</label>
                  <SearchSelect
                    value={daftarForm.jamaah_id}
                    onChange={(v) => setDaftarForm((f) => ({ ...f, jamaah_id: v }))}
                    fetchOptions={fetchJamaahOptions}
                    placeholder="Ketik nama jamaah..."
                    allowEmpty={false}
                  />
                </div>
              )}

              <div className="pt-2 border-t border-rule">
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Paket</label>
                <SearchSelect
                  value={daftarForm.paket_id}
                  onChange={pilihPaket}
                  options={paketList.map((p) => ({ value: p.id, label: p.nama }))}
                  placeholder="Ketik nama paket..."
                  allowEmpty={false}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Total Tagihan</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={daftarForm.total_tagihan}
                  onChange={(e) => setDaftarForm((f) => ({ ...f, total_tagihan: formatRibuan(e.target.value) }))}
                  className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <p className="text-[11px] text-ink-soft mt-1">Terisi otomatis dari harga default paket, bisa disesuaikan per jamaah.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jatuh Tempo Cicilan Berikutnya (opsional)</label>
                <input
                  type="date"
                  value={daftarForm.jatuh_tempo_berikutnya}
                  onChange={(e) => setDaftarForm((f) => ({ ...f, jatuh_tempo_berikutnya: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>

              {daftarError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{daftarError}</p>
              )}
              <button
                type="submit"
                disabled={savingDaftar}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {savingDaftar
                  ? 'Menyimpan...'
                  : daftarPax.ke < daftarPax.total
                    ? `Simpan & Lanjut ke Jamaah ${daftarPax.ke + 1}`
                    : 'Daftarkan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Catat Pembayaran */}
      {payTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setPayTarget(null); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Catat Pembayaran</h2>
              <button type="button" onClick={() => setPayTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <div className="text-sm text-ink-soft mb-4">
              <p className="font-medium text-ink">{payTarget.jamaah_nama} — {payTarget.paket_nama}</p>
              <p className="mt-1">Sisa tagihan: <span className="tabular font-semibold text-ink">{rupiah(payTarget.sisa)}</span></p>
            </div>
            <form onSubmit={handlePay} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nominal Dibayar</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: formatRibuan(e.target.value) }))}
                  className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Kategori</label>
                <select
                  value={payForm.category_id}
                  onChange={(e) => setPayForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                >
                  <option value="">Pilih kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Masuk ke Akun</label>
                <select
                  value={payForm.account_id}
                  onChange={(e) => setPayForm((f) => ({ ...f, account_id: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                >
                  <option value="">Pilih akun</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tanggal Bayar</label>
                <input
                  type="date"
                  value={payForm.date}
                  onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Keterangan</label>
                <input
                  type="text"
                  value={payForm.description}
                  onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              {payError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{payError}</p>
              )}
              <button
                type="submit"
                disabled={savingPay}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {savingPay ? 'Menyimpan...' : 'Catat pembayaran'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Riwayat Pembayaran */}
      {historyTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setHistoryTarget(null); }}
        >
          <div className="card rounded-xl2 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold">Riwayat Pembayaran</h2>
                <p className="text-xs text-ink-soft mt-0.5">{historyTarget.jamaah_nama} — {historyTarget.paket_nama}</p>
              </div>
              <button type="button" onClick={() => setHistoryTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>

            {historyError && (
              <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2 mb-3">{historyError}</p>
            )}
            {historyLoading && <p className="text-sm text-ink-soft">Memuat...</p>}
            {!historyLoading && historyRows.length === 0 && (
              <p className="text-sm text-ink-soft">Belum ada pembayaran tercatat untuk pendaftaran ini.</p>
            )}
            {!historyLoading && historyRows.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {historyRows.map((c) => (
                  <div key={c.id} className={`flex items-center justify-between border-b border-rule pb-2 ${c.is_void ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-sm font-medium tabular">{rupiah(c.nominal)}</p>
                      <p className="text-[11px] text-ink-soft">
                        {tanggalID(c.tanggal)} · {c.no_kuitansi}
                        {c.is_void && ` · Dibatalkan: ${c.void_reason || '-'}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {!c.is_void && (
                        <button type="button" onClick={() => cetakKuitansi(c)} className="text-xs font-semibold text-accent-text hover:underline">
                          Cetak
                        </button>
                      )}
                      {canVoid && !c.is_void && (
                        <button type="button" onClick={() => handleVoidPayment(c)} className="text-xs font-semibold text-brick-600 hover:underline">
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Ubah Data Jamaah */}
      {editJamaahTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditJamaahTarget(null); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Ubah Data Jamaah</h2>
              <button type="button" onClick={() => setEditJamaahTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmitEditJamaah} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Jamaah</label>
                <input
                  type="text"
                  value={editJamaahForm.nama}
                  onChange={(e) => setEditJamaahForm((f) => ({ ...f, nama: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">NIK (opsional)</label>
                <input
                  type="text"
                  value={editJamaahForm.nik}
                  onChange={(e) => setEditJamaahForm((f) => ({ ...f, nik: e.target.value.replace(/\D/g, '') }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP / WhatsApp (opsional)</label>
                <input
                  type="text"
                  value={editJamaahForm.no_hp}
                  onChange={(e) => setEditJamaahForm((f) => ({ ...f, no_hp: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Kelamin (opsional)</label>
                <select
                  value={editJamaahForm.jenis_kelamin}
                  onChange={(e) => setEditJamaahForm((f) => ({ ...f, jenis_kelamin: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                >
                  <option value="">— Belum diisi —</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              {editJamaahError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{editJamaahError}</p>
              )}
              <button
                type="submit"
                disabled={savingEditJamaah}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {savingEditJamaah ? 'Menyimpan...' : 'Simpan perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Kuitansi data={cetakData} />
    </div>
  );
}
