import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { tanggalID } from '../lib/format';

const ROLE_OPTIONS = [
  { value: 'kasir', label: 'Kasir' },
  { value: 'admin_keuangan', label: 'Admin Keuangan' },
  { value: 'direktur', label: 'Direktur' },
  { value: 'agen', label: 'Agen / Mitra' },
];

export default function UndangStaf() {
  const [form, setForm] = useState({ email: '', full_name: '', role: 'kasir' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState('');
  const [aktifkanId, setAktifkanId] = useState(null); // id yang sedang diproses

  // Agen yang daftar sendiri lewat /daftar-agen masuk dengan is_active=false
  // (lihat sql/0007_daftar_agen_mandiri.sql) — daftar ini yang membuat
  // mereka terlihat supaya bisa disetujui, bukan menunggu selamanya tanpa
  // ada yang tahu.
  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    setPendingError('');
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, created_at')
      .eq('role', 'agen')
      .eq('is_active', false)
      .order('created_at', { ascending: false });
    if (err) {
      setPendingError(err.message);
      setPendingLoading(false);
      return;
    }
    setPending(data || []);
    setPendingLoading(false);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  async function handleAktifkan(p) {
    setAktifkanId(p.id);
    const { error: err } = await supabase.from('profiles').update({ is_active: true }).eq('id', p.id);
    setAktifkanId(null);
    if (err) {
      window.alert('Gagal mengaktifkan: ' + err.message);
      return;
    }
    loadPending();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!form.email.trim() || !form.full_name.trim()) {
      setError('Email dan nama wajib diisi.');
      return;
    }

    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke('invite-staff', {
      body: { email: form.email.trim(), full_name: form.full_name.trim(), role: form.role },
    });
    setSubmitting(false);

    // supabase.functions.invoke membungkus error HTTP non-2xx ke fnError,
    // tapi body respons error (pesan dari server) tetap ada di fnError.context.
    if (fnError) {
      let msg = fnError.message;
      try {
        const body = await fnError.context.json();
        if (body?.error) msg = body.error;
      } catch (_) { /* biarkan msg default */ }
      setError(msg);
      return;
    }

    setResult(data);
    setForm((f) => ({ ...f, email: '', full_name: '' }));
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Undang Staf &amp; Agen</h1>
        <p className="text-ink-soft text-sm mt-1">Buat akun baru, atau setujui agen yang mendaftar sendiri.</p>
      </div>

      <div className="mb-4">
        <h2 className="font-display font-semibold mb-3">Menunggu Persetujuan</h2>
        {pendingError && (
          <div className="card rounded-xl2 p-4 mb-3 border-l-4 border-l-brick-500 text-sm text-brick-600">{pendingError}</div>
        )}
        {pendingLoading && <p className="text-sm text-ink-soft">Memuat...</p>}
        {!pendingLoading && pending.length === 0 && !pendingError && (
          <div className="card rounded-xl2 p-5 text-sm text-ink-soft">Tidak ada pendaftaran agen yang menunggu.</div>
        )}
        {!pendingLoading && pending.length > 0 && (
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="card rounded-xl2 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.full_name}</p>
                  <p className="text-[11px] text-ink-soft truncate">
                    {p.email}{p.phone ? ` · ${p.phone}` : ''} · Daftar {tanggalID(p.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAktifkan(p)}
                  disabled={aktifkanId === p.id}
                  className="shrink-0 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md2 text-sm"
                >
                  {aktifkanId === p.id ? '...' : 'Aktifkan'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="font-display font-semibold mb-3">Undang Akun Baru</h2>
      <div className="card rounded-xl2 p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="field w-full rounded-md2 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="field w-full rounded-md2 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1.5">Peran</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="field w-full rounded-md2 px-4 py-2.5 text-sm"
            >
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {error && (
            <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
          >
            {submitting ? 'Membuat akun...' : 'Buat akun & undang'}
          </button>
        </form>

        {result && (
          <div className="mt-5 pt-5 border-t border-rule">
            <p className="text-sm font-semibold text-teal-700 mb-2">Akun berhasil dibuat!</p>
            <p className="text-xs text-ink-soft mb-3">
              Bagikan informasi ini ke orang yang bersangkutan (mis. lewat WhatsApp) supaya mereka bisa login.
            </p>
            <div className="bg-paper rounded-md2 p-4 space-y-1.5 border border-rule">
              <p className="text-sm"><span className="text-ink-soft">Email:</span> <span className="tabular font-semibold">{result.email}</span></p>
              <p className="text-sm"><span className="text-ink-soft">Password sementara:</span> <span className="tabular font-semibold">{result.temp_password}</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
