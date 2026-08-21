import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { tanggalID } from '../lib/format';
import { StatusPil } from '../components/ui';

const STATUS_TIKET = {
  BUKA: { label: 'Baru', nada: 'info' },
  DIPROSES: { label: 'Diproses', nada: 'warn' },
  SELESAI: { label: 'Selesai', nada: 'ok' },
};

const TIKET_FORM_KOSONG = { subjek: '', pesan: '' };

/** Helpdesk — tiket bantuan ke staf JBI. Lihat sql/0021_helpdesk_agen.sql. */
export default function PortalAgenBantuan() {
  const { user } = useAuth();
  const [tiketRows, setTiketRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddTiket, setShowAddTiket] = useState(false);
  const [tiketForm, setTiketForm] = useState(TIKET_FORM_KOSONG);
  const [tiketFormError, setTiketFormError] = useState('');
  const [savingTiket, setSavingTiket] = useState(false);

  const [activeTiket, setActiveTiket] = useState(null);
  const [tiketPesanRows, setTiketPesanRows] = useState([]);
  const [tiketPesanLoading, setTiketPesanLoading] = useState(false);
  const [balasanTiket, setBalasanTiket] = useState('');
  const [sendingBalasan, setSendingBalasan] = useState(false);
  const [tiketDetailError, setTiketDetailError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('tiket_bantuan').select('*').order('updated_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setTiketRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAddTiket() {
    setTiketForm(TIKET_FORM_KOSONG);
    setTiketFormError('');
    setShowAddTiket(true);
  }

  async function handleAddTiket(e) {
    e.preventDefault();
    setTiketFormError('');
    if (!tiketForm.subjek.trim() || !tiketForm.pesan.trim()) {
      setTiketFormError('Subjek dan pesan wajib diisi.');
      return;
    }
    setSavingTiket(true);
    const { data: tiketBaru, error: tiketErr } = await supabase
      .from('tiket_bantuan')
      .insert({ agen_id: user.id, subjek: tiketForm.subjek.trim(), status: 'BUKA' })
      .select('id')
      .single();
    if (tiketErr) {
      setSavingTiket(false);
      setTiketFormError(tiketErr.message);
      return;
    }
    const { error: pesanErr } = await supabase
      .from('tiket_pesan')
      .insert({ tiket_id: tiketBaru.id, pengirim_id: user.id, isi: tiketForm.pesan.trim() });
    setSavingTiket(false);
    if (pesanErr) {
      setTiketFormError(pesanErr.message);
      return;
    }
    setShowAddTiket(false);
    load();
  }

  async function bukaTiket(row) {
    setActiveTiket(row);
    setTiketDetailError('');
    setBalasanTiket('');
    setTiketPesanLoading(true);
    const { data } = await supabase
      .from('tiket_pesan')
      .select('*, pengirim:pengirim_id(full_name, role)')
      .eq('tiket_id', row.id)
      .order('created_at', { ascending: true });
    setTiketPesanRows(data || []);
    setTiketPesanLoading(false);
  }

  async function kirimBalasanTiket(e) {
    e.preventDefault();
    if (!activeTiket || !balasanTiket.trim()) return;
    setTiketDetailError('');
    setSendingBalasan(true);
    const { error: err } = await supabase.from('tiket_pesan').insert({
      tiket_id: activeTiket.id,
      pengirim_id: user.id,
      isi: balasanTiket.trim(),
    });
    setSendingBalasan(false);
    if (err) {
      setTiketDetailError(err.message);
      return;
    }
    setBalasanTiket('');
    bukaTiket(activeTiket);
    load();
  }

  async function tandaiTiketSelesai() {
    if (!activeTiket) return;
    setTiketDetailError('');
    const { error: err } = await supabase.from('tiket_bantuan').update({ status: 'SELESAI' }).eq('id', activeTiket.id);
    if (err) {
      setTiketDetailError(err.message);
      return;
    }
    setActiveTiket((t) => ({ ...t, status: 'SELESAI' }));
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Bantuan</h1>
          <p className="text-ink-soft text-sm mt-1">Tanya atau lapor kendala ke staf JBI.</p>
        </div>
        <button type="button" onClick={openAddTiket} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
          + Buat Tiket
        </button>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Subjek</th>
                <th className="p-4 whitespace-nowrap">Terakhir Diperbarui</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={3} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && tiketRows.length === 0 && (
                <tr><td colSpan={3} className="p-10 text-center text-ink-soft">Belum ada tiket bantuan. Ada pertanyaan/kendala? Klik "+ Buat Tiket".</td></tr>
              )}
              {tiketRows.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-accent-soft/40" onClick={() => bukaTiket(t)}>
                  <td className="p-4 font-medium">{t.subjek}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{tanggalID(t.updated_at)}</td>
                  <td className="p-4 text-center">
                    <StatusPil peta={STATUS_TIKET} nilai={t.status} bawaan="BUKA" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddTiket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddTiket(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Buat Tiket Bantuan</h2>
              <button type="button" onClick={() => setShowAddTiket(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleAddTiket} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Subjek</label>
                <input type="text" value={tiketForm.subjek} onChange={(e) => setTiketForm((f) => ({ ...f, subjek: e.target.value }))} placeholder="mis. Tanya soal jadwal keberangkatan" className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Pesan</label>
                <textarea rows={4} value={tiketForm.pesan} onChange={(e) => setTiketForm((f) => ({ ...f, pesan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              {tiketFormError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{tiketFormError}</p>}
              <button type="submit" disabled={savingTiket} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingTiket ? 'Mengirim...' : 'Kirim'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTiket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveTiket(null); }}>
          <div className="card rounded-xl2 w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-lg font-semibold">{activeTiket.subjek}</h2>
              <button type="button" onClick={() => setActiveTiket(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <StatusPil peta={STATUS_TIKET} nilai={activeTiket.status} bawaan="BUKA" />
              {activeTiket.status !== 'SELESAI' && (
                <button type="button" onClick={tandaiTiketSelesai} className="text-xs font-semibold text-accent-text hover:underline">
                  Tandai Selesai
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[120px]">
              {tiketPesanLoading && <p className="text-sm text-ink-soft">Memuat percakapan...</p>}
              {!tiketPesanLoading && tiketPesanRows.length === 0 && <p className="text-sm text-ink-soft">Belum ada pesan.</p>}
              {!tiketPesanLoading && tiketPesanRows.map((p) => {
                const dariSaya = p.pengirim_id === user.id;
                return (
                  <div key={p.id} className={`max-w-[80%] rounded-md2 px-3 py-2 text-sm ${dariSaya ? 'bg-accent-soft ml-auto' : 'bg-paper-raised border border-rule'}`}>
                    <p className="text-[10px] font-semibold text-ink-soft mb-0.5">{dariSaya ? 'Saya' : (p.pengirim?.full_name || 'Staf JBI')} · {tanggalID(p.created_at)}</p>
                    <p className="whitespace-pre-wrap">{p.isi}</p>
                  </div>
                );
              })}
            </div>

            {tiketDetailError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2 mb-3">{tiketDetailError}</p>}

            {activeTiket.status !== 'SELESAI' ? (
              <form onSubmit={kirimBalasanTiket} className="flex gap-2">
                <input
                  type="text"
                  value={balasanTiket}
                  onChange={(e) => setBalasanTiket(e.target.value)}
                  placeholder="Tulis balasan..."
                  className="field flex-1 rounded-md2 px-4 py-2.5 text-sm"
                />
                <button type="submit" disabled={sendingBalasan || !balasanTiket.trim()} className="bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-md2 text-sm">
                  Kirim
                </button>
              </form>
            ) : (
              <p className="text-xs text-ink-soft text-center">Tiket ini sudah ditandai selesai.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
