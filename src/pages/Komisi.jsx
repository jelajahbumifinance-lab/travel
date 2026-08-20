import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID, formatRibuan } from '../lib/format';
import { Aksi, GrupAksi, Pil, StatusPil, STATUS_KOMISI } from '../components/ui';
import SearchSelect from '../components/SearchSelect';

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'AKRUAL', label: 'Akrual (belum diajukan)' },
  { value: 'DIAJUKAN', label: 'Diajukan agen' },
  { value: 'CAIR', label: 'Sudah cair' },
  { value: 'BATAL', label: 'Dibatalkan' },
];

export default function Komisi() {
  const { profile } = useAuth();
  const canManage = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const [aturan, setAturan] = useState([]);
  const [komisi, setKomisi] = useState([]);
  const [paketList, setPaketList] = useState([]);
  const [agenList, setAgenList] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showAturanForm, setShowAturanForm] = useState(false);
  const [aturanForm, setAturanForm] = useState({ paket_id: '', agen_id: '', tipe: 'PERSEN', nilai: '' });
  const [aturanError, setAturanError] = useState('');
  const [savingAturan, setSavingAturan] = useState(false);

  const [cairTarget, setCairTarget] = useState(null);
  const [cairForm, setCairForm] = useState({ account_id: '', category_id: '', date: todayISO(), description: '' });
  const [cairError, setCairError] = useState('');
  const [savingCair, setSavingCair] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [aturanRes, komisiRes, paketRes, agenRes, accRes, catRes] = await Promise.all([
      supabase.from('aturan_komisi').select('id, paket_id, agen_id, tipe, nilai'),
      supabase.from('v_komisi_agen').select('*').order('created_at', { ascending: false }),
      supabase.from('paket').select('id, nama').eq('is_active', true).order('nama'),
      supabase.from('profiles').select('id, full_name, nama_bank, nomor_rekening, nama_pemilik_rekening').eq('role', 'agen').eq('is_active', true).order('full_name'),
      supabase.from('accounts').select('id, name').eq('is_active', true).order('name'),
      supabase.from('transaction_categories').select('id, name, type').eq('is_active', true).eq('type', 'OUT').order('name'),
    ]);
    if (aturanRes.error || komisiRes.error || paketRes.error || agenRes.error || accRes.error || catRes.error) {
      setError(aturanRes.error?.message || komisiRes.error?.message || paketRes.error?.message || agenRes.error?.message || accRes.error?.message || catRes.error?.message);
      setLoading(false);
      return;
    }
    setAturan(aturanRes.data || []);
    setKomisi(komisiRes.data || []);
    setPaketList(paketRes.data || []);
    setAgenList(agenRes.data || []);
    setAccounts(accRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const paketMap = useMemo(() => Object.fromEntries(paketList.map((p) => [p.id, p.nama])), [paketList]);
  const agenMap = useMemo(() => Object.fromEntries(agenList.map((a) => [a.id, a.full_name])), [agenList]);
  const agenById = useMemo(() => Object.fromEntries(agenList.map((a) => [a.id, a])), [agenList]);

  const filteredKomisi = useMemo(
    () => (statusFilter ? komisi.filter((k) => k.status === statusFilter) : komisi),
    [komisi, statusFilter]
  );

  const totalAkrual = komisi.filter((k) => k.status === 'AKRUAL').reduce((s, k) => s + Number(k.nominal), 0);
  const totalCair = komisi.filter((k) => k.status === 'CAIR').reduce((s, k) => s + Number(k.nominal), 0);

  // ---- Aturan komisi ----
  function openAturanForm() {
    setAturanForm({ paket_id: paketList[0]?.id || '', agen_id: '', tipe: 'PERSEN', nilai: '' });
    setAturanError('');
    setShowAturanForm(true);
  }

  async function handleSubmitAturan(e) {
    e.preventDefault();
    setAturanError('');
    // Input PERSEN pakai <input type="number"> polos (titik = desimal).
    // Input NOMINAL pakai formatRibuan ala Indonesia (titik = pemisah ribuan,
    // mis. "2.000.000") — kalau dua-duanya diparse dengan cara yang sama,
    // "2.000.000" terbaca sebagai angka tidak valid (titik desimal ganda)
    // dan Number(...) menghasilkan NaN meski field terlihat terisi.
    const nilai = aturanForm.tipe === 'PERSEN'
      ? Number(aturanForm.nilai)
      : Number(String(aturanForm.nilai).replace(/\D/g, ''));
    if (!aturanForm.paket_id || !nilai) {
      setAturanError('Paket dan nilai komisi wajib diisi.');
      return;
    }
    setSavingAturan(true);
    const { error: opError } = await supabase.from('aturan_komisi').insert({
      paket_id: aturanForm.paket_id,
      agen_id: aturanForm.agen_id || null,
      tipe: aturanForm.tipe,
      nilai,
    });
    setSavingAturan(false);
    if (opError) {
      setAturanError(opError.message);
      return;
    }
    setShowAturanForm(false);
    load();
  }

  async function handleHapusAturan(id) {
    if (!window.confirm('Hapus aturan komisi ini? Akrual yang sudah tercatat sebelumnya tidak ikut berubah.')) return;
    const { error: err } = await supabase.from('aturan_komisi').delete().eq('id', id);
    if (err) { window.alert('Gagal: ' + err.message); return; }
    load();
  }

  // ---- Cairkan komisi ----
  function openCair(k) {
    const defaultCategory = categories.find((c) => c.name.toLowerCase().includes('komisi'))?.id || categories[0]?.id || '';
    setCairTarget(k);
    setCairForm({
      account_id: accounts[0]?.id || '',
      category_id: defaultCategory,
      date: todayISO(),
      description: `Komisi — ${k.agen_nama} — ${k.jamaah_nama}`,
    });
    setCairError('');
  }

  async function handleCair(e) {
    e.preventDefault();
    setCairError('');
    if (!cairForm.account_id || !cairForm.category_id) {
      setCairError('Akun dan kategori wajib diisi.');
      return;
    }
    setSavingCair(true);
    const { error: rpcError } = await supabase.rpc('record_pencairan_komisi', {
      p_komisi_id: cairTarget.id,
      p_account_id: cairForm.account_id,
      p_category_id: cairForm.category_id,
      p_date: cairForm.date,
      p_description: cairForm.description.trim() || `Komisi — ${cairTarget.agen_nama}`,
    });
    setSavingCair(false);
    if (rpcError) {
      setCairError(rpcError.message);
      return;
    }
    setCairTarget(null);
    load();
  }

  async function handleBatalkanKomisi(k) {
    const reason = window.prompt('Alasan pembatalan komisi ini?');
    if (!reason || !reason.trim()) return;
    const { error: rpcError } = await supabase.rpc('void_komisi', { p_komisi_id: k.id, p_reason: reason.trim() });
    if (rpcError) {
      window.alert('Gagal membatalkan: ' + rpcError.message);
      return;
    }
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Komisi Agen &amp; Mitra</h1>
        <p className="text-ink-soft text-sm mt-1">Aturan komisi per paket/agen, akrual otomatis, dan pencairan.</p>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Total Akrual (belum cair)</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-orange-600">{rupiah(totalAkrual)}</p>
        </div>
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Total Sudah Cair</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-teal-700">{rupiah(totalCair)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold">Aturan Komisi</h2>
        {canManage && (
          <button type="button" onClick={openAturanForm} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
            + Tambah Aturan
          </button>
        )}
      </div>
      <div className="card rounded-xl2 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Paket</th>
                <th className="p-4">Agen</th>
                <th className="p-4 whitespace-nowrap text-right">Komisi</th>
                {canManage && <th className="p-4 whitespace-nowrap text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {!loading && aturan.length === 0 && (
                <tr><td colSpan={canManage ? 4 : 3} className="p-10 text-center text-ink-soft">Belum ada aturan komisi.</td></tr>
              )}
              {aturan.map((a) => (
                <tr key={a.id}>
                  <td className="p-4 font-medium">{paketMap[a.paket_id] || '-'}</td>
                  <td className="p-4">{a.agen_id ? (agenMap[a.agen_id] || 'Agen tidak dikenal') : <Pil nada="info">Semua Agen</Pil>}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap">
                    {a.tipe === 'PERSEN' ? `${a.nilai}%` : rupiah(a.nilai)}
                  </td>
                  {canManage && (
                    <td className="p-4 whitespace-nowrap text-center">
                      <Aksi jenis="bahaya" onClick={() => handleHapusAturan(a.id)}>Hapus</Aksi>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 className="font-display font-semibold">Akrual &amp; Pencairan</h2>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field rounded-md2 px-3 py-2 text-sm sm:w-56">
          {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Agen</th>
                <th className="p-4">Jamaah</th>
                <th className="p-4 whitespace-nowrap">Paket</th>
                <th className="p-4 whitespace-nowrap text-right">Nominal</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                {canManage && <th className="p-4 whitespace-nowrap text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={canManage ? 6 : 5} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && filteredKomisi.length === 0 && (
                <tr><td colSpan={canManage ? 6 : 5} className="p-10 text-center text-ink-soft">Belum ada komisi tercatat.</td></tr>
              )}
              {filteredKomisi.map((k) => (
                <tr key={k.id}>
                  <td className="p-4 font-medium">{k.agen_nama}</td>
                  <td className="p-4">{k.jamaah_nama}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{k.paket_nama}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(k.nominal)}</td>
                  <td className="p-4 text-center">
                    <StatusPil peta={STATUS_KOMISI} nilai={k.status} bawaan="AKRUAL" />
                    {(k.status === 'AKRUAL' || k.status === 'DIAJUKAN') && !k.jamaah_lunas && (
                      <p className="text-[10px] text-ink-soft mt-1">Menunggu pelunasan</p>
                    )}
                  </td>
                  {canManage && (
                    <td className="p-4 whitespace-nowrap">
                      {(k.status === 'AKRUAL' || k.status === 'DIAJUKAN') && (
                        <GrupAksi>
                          <Aksi
                            jenis="utama"
                            onClick={() => openCair(k)}
                            disabled={!k.jamaah_lunas}
                            title={
                              k.jamaah_lunas
                                ? 'Cairkan komisi ini'
                                : `Baru bisa dicairkan setelah jamaah lunas — sisa ${rupiah(k.jamaah_total_tagihan - k.jamaah_terbayar)}`
                            }
                          >
                            Cairkan
                          </Aksi>
                          <Aksi jenis="bahaya" onClick={() => handleBatalkanKomisi(k)}>Batalkan</Aksi>
                        </GrupAksi>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah Aturan Komisi */}
      {showAturanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAturanForm(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Tambah Aturan Komisi</h2>
              <button type="button" onClick={() => setShowAturanForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmitAturan} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Paket</label>
                <SearchSelect
                  value={aturanForm.paket_id}
                  onChange={(v) => setAturanForm((f) => ({ ...f, paket_id: v }))}
                  options={paketList.map((p) => ({ value: p.id, label: p.nama }))}
                  placeholder="Ketik nama paket..."
                  allowEmpty={false}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Agen (opsional)</label>
                <SearchSelect
                  value={aturanForm.agen_id}
                  onChange={(v) => setAturanForm((f) => ({ ...f, agen_id: v }))}
                  options={agenList.map((a) => ({ value: a.id, label: a.full_name }))}
                  placeholder="Ketik nama agen..."
                  emptyLabel="Semua agen (default paket ini)"
                />
                {agenList.length === 0 && (
                  <p className="text-[11px] text-ink-soft mt-1">Belum ada akun agen — bisa dikosongkan dulu sebagai aturan default paket.</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tipe</label>
                <select value={aturanForm.tipe} onChange={(e) => setAturanForm((f) => ({ ...f, tipe: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="PERSEN">Persentase dari total tagihan</option>
                  <option value="NOMINAL">Nominal tetap per jamaah</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">
                  {aturanForm.tipe === 'PERSEN' ? 'Persentase (%)' : 'Nominal'}
                </label>
                {aturanForm.tipe === 'PERSEN' ? (
                  <input type="number" step="0.1" min="0" max="100" value={aturanForm.nilai} onChange={(e) => setAturanForm((f) => ({ ...f, nilai: e.target.value }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                ) : (
                  <input type="text" inputMode="numeric" value={aturanForm.nilai} onChange={(e) => setAturanForm((f) => ({ ...f, nilai: formatRibuan(e.target.value) }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                )}
              </div>
              <p className="text-[11px] text-ink-soft">
                Berlaku untuk pendaftaran baru sejak aturan ini dibuat — tidak berlaku surut ke pendaftaran yang sudah ada.
              </p>
              {aturanError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{aturanError}</p>}
              <button type="submit" disabled={savingAturan} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingAturan ? 'Menyimpan...' : 'Tambah aturan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cairkan Komisi */}
      {cairTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setCairTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Cairkan Komisi</h2>
              <button type="button" onClick={() => setCairTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <p className="text-sm text-ink-soft mb-4">
              {cairTarget.agen_nama} — {cairTarget.jamaah_nama} — <span className="tabular font-semibold text-ink">{rupiah(cairTarget.nominal)}</span>
            </p>
            {(() => {
              const rek = agenById[cairTarget.agen_id];
              return rek?.nomor_rekening ? (
                <div className="bg-teal-100 rounded-md2 p-3 mb-4 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1">Rekening Tujuan</p>
                  <p>{rek.nama_bank || '-'} · <span className="tabular font-semibold">{rek.nomor_rekening}</span></p>
                  <p className="text-ink-soft">a.n. {rek.nama_pemilik_rekening || rek.full_name}</p>
                </div>
              ) : (
                <div className="card rounded-md2 p-3 mb-4 text-xs border-l-4 border-l-accent">
                  Agen ini belum mengisi nomor rekening — cek manual sebelum transfer.
                </div>
              );
            })()}
            <form onSubmit={handleCair} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Kategori</label>
                <select value={cairForm.category_id} onChange={(e) => setCairForm((f) => ({ ...f, category_id: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="">Pilih kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Dibayar dari Akun</label>
                <select value={cairForm.account_id} onChange={(e) => setCairForm((f) => ({ ...f, account_id: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="">Pilih akun</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tanggal</label>
                <input type="date" value={cairForm.date} onChange={(e) => setCairForm((f) => ({ ...f, date: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Keterangan</label>
                <input type="text" value={cairForm.description} onChange={(e) => setCairForm((f) => ({ ...f, description: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              {cairError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{cairError}</p>}
              <button type="submit" disabled={savingCair} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingCair ? 'Memproses...' : 'Cairkan komisi'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
