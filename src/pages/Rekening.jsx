import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, formatRibuan } from '../lib/format';
import { AksiIkon, IkonUbah, IkonNonaktifkan, Pil } from '../components/ui';

export default function Rekening() {
  const { profile } = useAuth();
  const canWrite = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'BANK', bank_name: '', account_number: '', opening_balance: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [accRes, balRes] = await Promise.all([
      supabase.from('accounts').select('id, name, type, bank_name, account_number, opening_balance, is_active').order('name'),
      supabase.from('v_account_balances').select('account_id, current_balance'),
    ]);
    if (accRes.error || balRes.error) {
      setError(accRes.error?.message || balRes.error?.message);
      setLoading(false);
      return;
    }
    const balMap = {};
    (balRes.data || []).forEach((b) => { balMap[b.account_id] = b.current_balance; });
    setAccounts((accRes.data || []).map((a) => ({ ...a, current_balance: balMap[a.id] ?? a.opening_balance })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ name: '', type: 'BANK', bank_name: '', account_number: '', opening_balance: '0' });
    setFormError('');
    setShowForm(true);
  }

  function openEdit(a) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      type: a.type,
      bank_name: a.bank_name || '',
      account_number: a.account_number || '',
      opening_balance: formatRibuan(String(a.opening_balance)),
    });
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Nama akun wajib diisi.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      bank_name: form.type === 'BANK' ? form.bank_name.trim() || null : null,
      account_number: form.type === 'BANK' ? form.account_number.trim() || null : null,
      opening_balance: Number(String(form.opening_balance).replace(/\D/g, '')) || 0,
    };
    setSubmitting(true);
    const { error: opError } = editingId
      ? await supabase.from('accounts').update(payload).eq('id', editingId)
      : await supabase.from('accounts').insert(payload);
    setSubmitting(false);
    if (opError) {
      setFormError(opError.message);
      return;
    }
    setShowForm(false);
    load();
  }

  async function handleDeactivate(a) {
    if (!window.confirm(`Nonaktifkan akun "${a.name}"? Riwayat transaksinya tetap tersimpan, tapi akun ini tidak akan muncul lagi sebagai pilihan baru.`)) return;
    const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', a.id);
    if (error) { window.alert('Gagal: ' + error.message); return; }
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Kas &amp; Rekening</h1>
          <p className="text-ink-soft text-sm mt-1">Kelola akun kas tunai dan rekening bank JBI.</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openAdd}
            className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm"
          >
            + Tambah Akun
          </button>
        )}
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading && <p className="text-sm text-ink-soft">Memuat...</p>}
        {!loading && accounts.length === 0 && (
          <div className="card rounded-xl2 p-10 text-center text-ink-soft text-sm sm:col-span-2">
            Belum ada akun kas/rekening.
          </div>
        )}
        {accounts.map((a) => (
          <div key={a.id} className={`card rounded-xl2 p-5 ${!a.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-semibold">{a.name}</p>
                <p className="text-[11px] text-ink-soft">
                  {a.type === 'CASH' ? 'Kas Tunai' : `${a.bank_name || 'Bank'} · ${a.account_number || '-'}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!a.is_active && <Pil nada="mute">Nonaktif</Pil>}
                {canWrite && a.is_active && (
                  <>
                    <AksiIkon label={`Ubah ${a.name}`} onClick={() => openEdit(a)}>
                      <IkonUbah />
                    </AksiIkon>
                    <AksiIkon jenis="bahaya" label={`Nonaktifkan ${a.name}`} onClick={() => handleDeactivate(a)}>
                      <IkonNonaktifkan />
                    </AksiIkon>
                  </>
                )}
              </div>
            </div>
            <p className="tabular text-xl font-semibold">{rupiah(a.current_balance)}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{editingId ? 'Edit Akun' : 'Tambah Akun'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jenis Akun</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                >
                  <option value="BANK">Rekening Bank</option>
                  <option value="CASH">Kas Tunai</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Akun</label>
                <input
                  type="text"
                  placeholder="mis. BSI JBI Operasional, Kas Tunai"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              {form.type === 'BANK' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Bank</label>
                    <input
                      type="text"
                      placeholder="mis. BSI"
                      value={form.bank_name}
                      onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                      className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nomor Rekening</label>
                    <input
                      type="text"
                      value={form.account_number}
                      onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value.replace(/\D/g, '') }))}
                      className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Saldo Awal</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.opening_balance}
                  onChange={(e) => setForm((f) => ({ ...f, opening_balance: formatRibuan(e.target.value) }))}
                  className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <p className="text-[11px] text-ink-soft mt-1">
                  {editingId
                    ? 'Mengubah ini akan menggeser saldo berjalan akun — pastikan memang perlu dikoreksi.'
                    : 'Saldo yang sudah ada di rekening ini sebelum mulai dicatat di sistem.'}
                </p>
              </div>
              {formError && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{formError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah akun'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
