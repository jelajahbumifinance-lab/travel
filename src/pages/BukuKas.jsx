import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID, formatRibuan } from '../lib/format';
import { Aksi, GrupAksi, StatusPil, STATUS_TRANSAKSI } from '../components/ui';

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const PER_HALAMAN = 25;

export default function BukuKas() {
  const { profile, user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [totalBaris, setTotalBaris] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('IN');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ account_id: '', category_id: '', amount: '', date: todayISO(), description: '' });
  const [editingId, setEditingId] = useState(null);
  const [voidingError, setVoidingError] = useState('');

  const [tambahKategoriBaru, setTambahKategoriBaru] = useState(false);
  const [namaKategoriBaru, setNamaKategoriBaru] = useState('');
  const [errorKategoriBaru, setErrorKategoriBaru] = useState('');
  const [menyimpanKategoriBaru, setMenyimpanKategoriBaru] = useState(false);

  // Kasir boleh mencatat transaksi baru (lihat RLS transactions_insert_staf),
  // tapi mengubah/membatalkan transaksi yang sudah tersimpan adalah wewenang
  // admin_keuangan & direktur saja — tombolnya disembunyikan sesuai itu,
  // dan database menegakkan batas yang sama lewat RLS bila tombolnya
  // diakali dari luar aplikasi.
  const canWrite = ['direktur', 'admin_keuangan', 'kasir'].includes(profile?.role);
  const canManage = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const dari = (halaman - 1) * PER_HALAMAN;
    const [accRes, catRes, trxRes] = await Promise.all([
      supabase.from('accounts').select('id, name, type').eq('is_active', true).order('name'),
      supabase.from('transaction_categories').select('id, name, type').eq('is_active', true).order('name'),
      supabase
        .from('transactions')
        .select(
          'id, date, type, amount, description, status, account_id, category_id, accounts(name), transaction_categories(name)',
          { count: 'exact' }
        )
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(dari, dari + PER_HALAMAN - 1),
    ]);

    if (accRes.error || catRes.error || trxRes.error) {
      setError(accRes.error?.message || catRes.error?.message || trxRes.error?.message);
      setLoading(false);
      return;
    }

    setAccounts(accRes.data || []);
    setCategories(catRes.data || []);
    setTransactions(trxRes.data || []);
    setTotalBaris(trxRes.count ?? 0);
    setLoading(false);
  }, [halaman]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function openForm(type) {
    setEditingId(null);
    setFormType(type);
    setForm({ account_id: accounts[0]?.id || '', category_id: '', amount: '', date: todayISO(), description: '' });
    setFormError('');
    setTambahKategoriBaru(false);
    setNamaKategoriBaru('');
    setErrorKategoriBaru('');
    setShowForm(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setFormType(t.type);
    setForm({
      account_id: t.account_id || '',
      category_id: t.category_id || '',
      amount: formatRibuan(String(t.amount)),
      date: t.date,
      description: t.description,
    });
    setFormError('');
    setTambahKategoriBaru(false);
    setNamaKategoriBaru('');
    setErrorKategoriBaru('');
    setShowForm(true);
  }

  // Kategori baru langsung tersimpan sebagai baris resmi di
  // transaction_categories (bukan cuma teks lokal di form ini), supaya
  // begitu ditambahkan ia langsung tersedia juga untuk transaksi
  // berikutnya, dan ikut terhitung di RAB & Laporan seperti kategori lain.
  async function simpanKategoriBaru() {
    const nama = namaKategoriBaru.trim();
    if (!nama) {
      setErrorKategoriBaru('Nama kategori wajib diisi.');
      return;
    }
    setMenyimpanKategoriBaru(true);
    const { data, error } = await supabase
      .from('transaction_categories')
      .insert({ name: nama, type: formType, is_active: true })
      .select('id, name, type')
      .single();
    setMenyimpanKategoriBaru(false);
    if (error) {
      setErrorKategoriBaru(
        error.message.includes('duplicate') ? 'Sudah ada kategori dengan nama itu.' : error.message
      );
      return;
    }
    setCategories((prev) => [...prev, data]);
    setForm((f) => ({ ...f, category_id: data.id }));
    setTambahKategoriBaru(false);
    setNamaKategoriBaru('');
    setErrorKategoriBaru('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const amountNumber = Number(String(form.amount).replace(/\D/g, ''));
    if (!form.account_id || !form.category_id || !amountNumber || !form.description.trim()) {
      setFormError('Semua field wajib diisi, nominal harus lebih dari nol.');
      return;
    }

    setSubmitting(true);
    let opError;
    if (editingId) {
      const { error } = await supabase
        .from('transactions')
        .update({
          account_id: form.account_id,
          category_id: form.category_id,
          amount: amountNumber,
          date: form.date,
          description: form.description.trim(),
        })
        .eq('id', editingId);
      opError = error;
    } else {
      const { error } = await supabase.from('transactions').insert({
        account_id: form.account_id,
        category_id: form.category_id,
        type: formType,
        amount: amountNumber,
        date: form.date,
        description: form.description.trim(),
        created_by: user.id,
      });
      opError = error;
    }
    setSubmitting(false);

    if (opError) {
      setFormError(opError.message);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    loadAll();
  }

  async function handleVoid(t) {
    const reason = window.prompt('Masukkan alasan pembatalan transaksi ini:');
    if (!reason || !reason.trim()) return;
    setVoidingError('');
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'VOID', void_reason: reason.trim() })
      .eq('id', t.id);
    if (error) {
      setVoidingError(error.message);
      return;
    }
    loadAll();
  }

  const filteredCategories = categories.filter((c) => c.type === formType);

  const totalHalaman = Math.max(1, Math.ceil(totalBaris / PER_HALAMAN));
  const halamanAman = Math.min(halaman, totalHalaman);
  const awal = (halamanAman - 1) * PER_HALAMAN;

  function gantiHalaman(n) {
    setHalaman(Math.min(Math.max(1, n), totalHalaman));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Buku Kas</h1>
          <p className="text-ink-soft text-sm mt-1">Catat pemasukan dan pengeluaran operasional JBI.</p>
        </div>
        {canWrite && accounts.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openForm('IN')}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-md2 text-sm"
            >
              + Pemasukan
            </button>
            <button
              type="button"
              onClick={() => openForm('OUT')}
              className="bg-brick-500 hover:bg-brick-600 text-white font-semibold py-2 px-4 rounded-md2 text-sm"
            >
              − Pengeluaran
            </button>
          </div>
        )}
      </div>

      {canWrite && accounts.length === 0 && !loading && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-accent text-sm">
          Belum ada akun kas/rekening. Buat satu dulu di menu <b>Kas &amp; Rekening</b> sebelum mencatat transaksi.
        </div>
      )}

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}
      {voidingError && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">
          Gagal membatalkan: {voidingError}
        </div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4 whitespace-nowrap">Tanggal</th>
                <th className="p-4 whitespace-nowrap">Kategori</th>
                <th className="p-4">Keterangan</th>
                <th className="p-4 whitespace-nowrap">Akun</th>
                <th className="p-4 whitespace-nowrap text-right">Nominal</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                {canManage && <th className="p-4 whitespace-nowrap text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={canManage ? 7 : 6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={canManage ? 7 : 6} className="p-10 text-center text-ink-soft">Belum ada transaksi.</td></tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id} className={t.status === 'VOID' ? 'opacity-50' : ''}>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{tanggalID(t.date)}</td>
                  <td className="p-4 whitespace-nowrap font-medium">{t.transaction_categories?.name || '-'}</td>
                  <td className="p-4 max-w-xs truncate">{t.description}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{t.accounts?.name || '-'}</td>
                  <td className={`tabular p-4 text-right font-semibold whitespace-nowrap ${t.type === 'IN' ? 'text-teal-700' : 'text-brick-600'}`}>
                    {t.type === 'IN' ? '+' : '−'}{rupiah(t.amount)}
                  </td>
                  <td className="p-4 text-center">
                    <StatusPil peta={STATUS_TRANSAKSI} nilai={t.status} bawaan="APPROVED" />
                  </td>
                  {canManage && (
                    <td className="p-4 whitespace-nowrap">
                      {t.status === 'APPROVED' && (
                        <GrupAksi>
                          <Aksi onClick={() => openEdit(t)}>Ubah</Aksi>
                          <Aksi jenis="bahaya" onClick={() => handleVoid(t)}>Batalkan</Aksi>
                        </GrupAksi>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalHalaman > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-rule print:hidden">
            <p className="text-xs text-ink-soft tabular">
              Menampilkan {awal + 1}–{Math.min(awal + transactions.length, totalBaris)} dari {totalBaris} transaksi
            </p>
            <div className="flex items-center gap-1">
              <Aksi onClick={() => gantiHalaman(halamanAman - 1)} disabled={halamanAman === 1 || loading}>← Sebelumnya</Aksi>
              <span className="text-xs text-ink-soft tabular px-2">{halamanAman} / {totalHalaman}</span>
              <Aksi onClick={() => gantiHalaman(halamanAman + 1)} disabled={halamanAman === totalHalaman || loading}>Berikutnya →</Aksi>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">
                {editingId ? 'Edit Transaksi' : formType === 'IN' ? 'Catat Pemasukan' : 'Catat Pengeluaran'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Akun</label>
                <select
                  value={form.account_id}
                  onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                >
                  <option value="">Pilih akun</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Tanggal</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Kategori</label>
                {!tambahKategoriBaru ? (
                  <select
                    value={form.category_id}
                    onChange={(e) => {
                      if (e.target.value === '__BARU__') {
                        setTambahKategoriBaru(true);
                        setErrorKategoriBaru('');
                        return;
                      }
                      setForm((f) => ({ ...f, category_id: e.target.value }));
                    }}
                    className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                  >
                    <option value="">Pilih kategori</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="__BARU__">+ Tambah kategori baru…</option>
                  </select>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder={`mis. Sumbangan Donatur (${formType === 'IN' ? 'Pemasukan' : 'Pengeluaran'})`}
                        value={namaKategoriBaru}
                        onChange={(e) => setNamaKategoriBaru(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter di sini tidak boleh men-submit form transaksi
                          // yang membungkusnya — itu akan menyimpan transaksi
                          // dengan kategori masih kosong.
                          if (e.key === 'Enter') { e.preventDefault(); simpanKategoriBaru(); }
                        }}
                        className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                      />
                      {errorKategoriBaru && (
                        <p className="text-[11px] font-semibold text-brick-600 mt-1">{errorKategoriBaru}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={simpanKategoriBaru}
                      disabled={menyimpanKategoriBaru}
                      className="bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold px-3 py-2.5 rounded-md2 text-sm shrink-0"
                    >
                      {menyimpanKategoriBaru ? '…' : 'Tambah'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTambahKategoriBaru(false); setNamaKategoriBaru(''); setErrorKategoriBaru(''); }}
                      className="text-ink-soft hover:text-ink px-1 py-2.5 shrink-0"
                      aria-label="Batal, kembali ke daftar kategori"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nominal</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: formatRibuan(e.target.value) }))}
                  className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Keterangan</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none"
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
                {submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Simpan transaksi'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
