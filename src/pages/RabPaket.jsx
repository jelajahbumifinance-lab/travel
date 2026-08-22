import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID, formatRibuan } from '../lib/format';
import { Aksi, GrupAksi, Pil } from '../components/ui';
import SearchSelect from '../components/SearchSelect';
import { StatTile, WARNA_STAT, IconWallet, IconTrendUp, IconTrendDown, IconTarget } from '../components/StatTile';

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const KOMPONEN_LABEL = {
  TIKET: 'Tiket Pesawat',
  HOTEL: 'Hotel',
  VISA: 'Visa & Dokumen',
  MUTHAWIF: 'Muthawif & Handling',
  TRANSPORTASI: 'Transportasi',
  CATERING: 'Catering',
  PERLENGKAPAN: 'Perlengkapan',
  LAIN_LAIN: 'Lain-lain',
};

export default function RabPaket() {
  const { paketId } = useParams();
  const { profile } = useAuth();
  const canManage = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const [paket, setPaket] = useState(null);
  const [ringkasan, setRingkasan] = useState(null);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState({ komponen: 'TIKET', catatan: '', anggaran: '' });
  const [itemFormError, setItemFormError] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  const [historyTarget, setHistoryTarget] = useState(null); // rab item
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [payTarget, setPayTarget] = useState(null); // rab item
  const [payForm, setPayForm] = useState({ vendor_id: '', account_id: '', category_id: '', amount: '', date: todayISO(), description: '' });
  const [payError, setPayError] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [paketRes, ringkasanRes, itemsRes, vendorRes, accRes, catRes] = await Promise.all([
      supabase.from('paket').select('id, nama, jenis, tanggal_berangkat, status').eq('id', paketId).maybeSingle(),
      supabase.from('v_paket_ringkasan').select('*').eq('paket_id', paketId).maybeSingle(),
      supabase.from('v_rab_realisasi').select('*').eq('paket_id', paketId).order('komponen'),
      supabase.from('vendor').select('id, nama, jenis').eq('is_active', true).order('nama'),
      supabase.from('accounts').select('id, name').eq('is_active', true).order('name'),
      supabase.from('transaction_categories').select('id, name, type').eq('is_active', true).eq('type', 'OUT').order('name'),
    ]);
    if (paketRes.error || itemsRes.error || vendorRes.error || accRes.error || catRes.error) {
      setError(paketRes.error?.message || itemsRes.error?.message || vendorRes.error?.message || accRes.error?.message || catRes.error?.message);
      setLoading(false);
      return;
    }
    setPaket(paketRes.data);
    setRingkasan(ringkasanRes.data || { total_tagihan_terkumpul: 0, total_diterima: 0, total_anggaran: 0, total_realisasi_biaya: 0 });
    setItems(itemsRes.data || []);
    setVendors(vendorRes.data || []);
    setAccounts(accRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  }, [paketId]);

  useEffect(() => { load(); }, [load]);

  // ---- Item RAB ----
  function openAddItem() {
    setEditingItemId(null);
    setItemForm({ komponen: 'TIKET', catatan: '', anggaran: '' });
    setItemFormError('');
    setShowItemForm(true);
  }

  function openEditItem(it) {
    setEditingItemId(it.id);
    setItemForm({ komponen: it.komponen, catatan: it.catatan || '', anggaran: formatRibuan(String(it.anggaran)) });
    setItemFormError('');
    setShowItemForm(true);
  }

  async function handleSubmitItem(e) {
    e.preventDefault();
    setItemFormError('');
    const anggaran = Number(String(itemForm.anggaran).replace(/\D/g, ''));
    const payload = { paket_id: paketId, komponen: itemForm.komponen, catatan: itemForm.catatan.trim() || null, anggaran };
    setSavingItem(true);
    const { error: opError } = editingItemId
      ? await supabase.from('rab_item').update(payload).eq('id', editingItemId)
      : await supabase.from('rab_item').insert(payload);
    setSavingItem(false);
    if (opError) {
      setItemFormError(opError.message);
      return;
    }
    setShowItemForm(false);
    load();
  }

  // ---- Riwayat realisasi ----
  async function openHistory(it) {
    setHistoryTarget(it);
    setHistoryLoading(true);
    const { data, error: err } = await supabase
      .from('realisasi_biaya')
      .select('id, nominal, tanggal, is_void, void_reason, vendor_id, vendor(nama)')
      .eq('rab_item_id', it.id)
      .order('tanggal', { ascending: false });
    setHistoryRows(err ? [] : data || []);
    setHistoryLoading(false);
  }

  async function handleVoidRealisasi(r) {
    const reason = window.prompt('Alasan pembatalan realisasi biaya ini?');
    if (!reason || !reason.trim()) return;
    const { error: rpcError } = await supabase.rpc('void_realisasi_biaya', { p_realisasi_id: r.id, p_reason: reason.trim() });
    if (rpcError) {
      window.alert('Gagal membatalkan: ' + rpcError.message);
      return;
    }
    openHistory(historyTarget);
    load();
  }

  // ---- Catat realisasi ----
  function openPay(it) {
    setPayTarget(it);
    setPayForm({
      vendor_id: '',
      account_id: accounts[0]?.id || '',
      category_id: categories.find((c) => c.name.toLowerCase().includes(KOMPONEN_LABEL[it.komponen]?.split(' ')[0].toLowerCase()))?.id || categories[0]?.id || '',
      amount: '',
      date: todayISO(),
      description: `${KOMPONEN_LABEL[it.komponen] || it.komponen} — ${paket?.nama || ''}`,
    });
    setPayError('');
  }

  async function handlePay(e) {
    e.preventDefault();
    setPayError('');
    const amount = Number(String(payForm.amount).replace(/\D/g, ''));
    if (!amount || !payForm.account_id || !payForm.category_id) {
      setPayError('Nominal, kategori, dan akun wajib diisi.');
      return;
    }
    setSavingPay(true);
    const { error: rpcError } = await supabase.rpc('record_realisasi_biaya', {
      p_rab_item_id: payTarget.id,
      p_vendor_id: payForm.vendor_id || null,
      p_account_id: payForm.account_id,
      p_category_id: payForm.category_id,
      p_amount: amount,
      p_date: payForm.date,
      p_description: payForm.description.trim() || KOMPONEN_LABEL[payTarget.komponen],
    });
    setSavingPay(false);
    if (rpcError) {
      setPayError(rpcError.message);
      return;
    }
    setPayTarget(null);
    load();
  }

  if (loading) return <div className="text-sm text-ink-soft">Memuat...</div>;
  if (error) {
    return (
      <div className="card rounded-xl2 p-5 border-l-4 border-l-brick-500">
        <p className="font-semibold text-brick-600">Gagal memuat RAB</p>
        <p className="text-xs text-ink-soft mt-1">{error}</p>
      </div>
    );
  }
  if (!paket) {
    return <div className="card rounded-xl2 p-5 text-sm text-ink-soft">Paket tidak ditemukan.</div>;
  }

  const marginKas = Number(ringkasan.total_diterima) - Number(ringkasan.total_realisasi_biaya);
  const totalRealisasiPct = ringkasan.total_anggaran > 0
    ? Math.min(100, Math.round((ringkasan.total_realisasi_biaya / ringkasan.total_anggaran) * 100))
    : 0;

  return (
    <div className="w-full">
      <Link to="/paket" className="text-xs font-semibold text-accent-text hover:underline">← Kembali ke Paket Keberangkatan</Link>

      <div className="mt-3 mb-6">
        <h1 className="font-display text-2xl font-semibold">{paket.nama}</h1>
        <p className="text-ink-soft text-sm mt-1">
          RAB &amp; realisasi biaya per komponen{paket.tanggal_berangkat ? ` — berangkat ${tanggalID(paket.tanggal_berangkat)}` : ''}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatTile warna={WARNA_STAT.sky} Icon={IconWallet} label="Tagihan Terkumpul" value={rupiah(ringkasan.total_tagihan_terkumpul)} />
        <StatTile warna={WARNA_STAT.teal} Icon={IconTrendUp} label="Diterima (Kas Masuk)" value={rupiah(ringkasan.total_diterima)} />
        <StatTile warna={WARNA_STAT.orange} Icon={IconTarget} label="Total Anggaran RAB" value={rupiah(ringkasan.total_anggaran)} />
        <StatTile warna={WARNA_STAT.brick} Icon={IconTrendDown} label="Realisasi Biaya" value={rupiah(ringkasan.total_realisasi_biaya)}>
          <div className="h-1.5 rounded-full bg-rule overflow-hidden mt-2">
            <div className={`h-full ${totalRealisasiPct > 90 ? 'bg-brick-500' : 'bg-accent'}`} style={{ width: `${totalRealisasiPct}%` }} />
          </div>
        </StatTile>
        <StatTile
          warna={marginKas >= 0 ? WARNA_STAT.teal : WARNA_STAT.brick}
          Icon={IconWallet}
          label="Margin Kas (Diterima − Realisasi)"
          value={rupiah(marginKas)}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold">Item RAB</h2>
        {canManage && (
          <button type="button" onClick={openAddItem} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
            + Tambah Item
          </button>
        )}
      </div>

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Komponen</th>
                <th className="p-4">Catatan</th>
                <th className="p-4 whitespace-nowrap text-right">Anggaran</th>
                <th className="p-4 whitespace-nowrap text-right">Realisasi</th>
                <th className="p-4 whitespace-nowrap text-right">Sisa</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {items.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Belum ada item RAB untuk paket ini.</td></tr>
              )}
              {items.map((it) => {
                const overBudget = Number(it.sisa_anggaran) < 0;
                return (
                  <tr key={it.id}>
                    <td className="p-4 font-medium whitespace-nowrap">{KOMPONEN_LABEL[it.komponen] || it.komponen}</td>
                    <td className="p-4 text-ink-soft">{it.catatan || '-'}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap">{rupiah(it.anggaran)}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-brick-600">{rupiah(it.realisasi)}</td>
                    <td className={`tabular p-4 text-right whitespace-nowrap font-semibold ${overBudget ? 'text-brick-600' : ''}`}>
                      {overBudget ? `− ${rupiah(Math.abs(it.sisa_anggaran))}` : rupiah(it.sisa_anggaran)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <GrupAksi>
                        <Aksi onClick={() => openHistory(it)}>Riwayat</Aksi>
                        {canManage && <Aksi onClick={() => openEditItem(it)}>Ubah</Aksi>}
                        {canManage && <Aksi jenis="utama" onClick={() => openPay(it)}>Bayar</Aksi>}
                      </GrupAksi>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah/Edit Item RAB */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowItemForm(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{editingItemId ? 'Edit Item RAB' : 'Tambah Item RAB'}</h2>
              <button type="button" onClick={() => setShowItemForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmitItem} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Komponen</label>
                <select value={itemForm.komponen} onChange={(e) => setItemForm((f) => ({ ...f, komponen: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  {Object.entries(KOMPONEN_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan (opsional)</label>
                <input type="text" value={itemForm.catatan} onChange={(e) => setItemForm((f) => ({ ...f, catatan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Anggaran</label>
                <input type="text" inputMode="numeric" value={itemForm.anggaran} onChange={(e) => setItemForm((f) => ({ ...f, anggaran: formatRibuan(e.target.value) }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              {itemFormError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{itemFormError}</p>}
              <button type="submit" disabled={savingItem} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingItem ? 'Menyimpan...' : editingItemId ? 'Simpan perubahan' : 'Tambah item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Catat Realisasi */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setPayTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Catat Realisasi Biaya</h2>
              <button type="button" onClick={() => setPayTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <p className="text-sm text-ink-soft mb-4">{KOMPONEN_LABEL[payTarget.komponen] || payTarget.komponen} — sisa anggaran <span className="tabular font-semibold text-ink">{rupiah(payTarget.sisa_anggaran)}</span></p>
            <form onSubmit={handlePay} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Vendor (opsional)</label>
                <SearchSelect
                  value={payForm.vendor_id}
                  onChange={(v) => setPayForm((f) => ({ ...f, vendor_id: v }))}
                  options={vendors.map((v) => ({ value: v.id, label: v.nama }))}
                  placeholder="Ketik nama vendor..."
                  emptyLabel="Tanpa vendor tertentu"
                />
                {vendors.length === 0 && <p className="text-[11px] text-ink-soft mt-1">Belum ada vendor — bisa ditambah di menu Vendor.</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nominal</label>
                <input type="text" inputMode="numeric" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: formatRibuan(e.target.value) }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Kategori</label>
                <select value={payForm.category_id} onChange={(e) => setPayForm((f) => ({ ...f, category_id: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="">Pilih kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Dibayar dari Akun</label>
                <select value={payForm.account_id} onChange={(e) => setPayForm((f) => ({ ...f, account_id: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="">Pilih akun</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tanggal</label>
                <input type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Keterangan</label>
                <input type="text" value={payForm.description} onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              {payError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{payError}</p>}
              <button type="submit" disabled={savingPay} className="w-full bg-brick-500 hover:bg-brick-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingPay ? 'Menyimpan...' : 'Catat realisasi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Riwayat Realisasi */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setHistoryTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold">Riwayat Realisasi</h2>
                <p className="text-xs text-ink-soft mt-0.5">{KOMPONEN_LABEL[historyTarget.komponen] || historyTarget.komponen}</p>
              </div>
              <button type="button" onClick={() => setHistoryTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            {historyLoading && <p className="text-sm text-ink-soft">Memuat...</p>}
            {!historyLoading && historyRows.length === 0 && <p className="text-sm text-ink-soft">Belum ada realisasi biaya untuk item ini.</p>}
            {!historyLoading && historyRows.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {historyRows.map((r) => (
                  <div key={r.id} className={`flex items-center justify-between border-b border-rule pb-2 ${r.is_void ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-sm font-medium tabular">{rupiah(r.nominal)}</p>
                      <p className="text-[11px] text-ink-soft">
                        {tanggalID(r.tanggal)}{r.vendor?.nama ? ` · ${r.vendor.nama}` : ''}
                        {r.is_void && ` · Dibatalkan: ${r.void_reason || '-'}`}
                      </p>
                    </div>
                    {canManage && !r.is_void && (
                      <button type="button" onClick={() => handleVoidRealisasi(r)} className="text-xs font-semibold text-brick-600 hover:underline shrink-0">
                        Batalkan
                      </button>
                    )}
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
