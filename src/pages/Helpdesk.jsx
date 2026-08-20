import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { tanggalID } from '../lib/format';
import { Pil } from '../components/ui';

const STATUS_TIKET = {
  BUKA: { label: 'Baru', nada: 'info' },
  DIPROSES: { label: 'Diproses', nada: 'warn' },
  SELESAI: { label: 'Selesai', nada: 'ok' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  ...Object.entries(STATUS_TIKET).map(([value, s]) => ({ value, label: s.label })),
];

/** Helpdesk staf — balas tiket bantuan yang dibuka agen dari Portal Agen. */
export default function Helpdesk() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [activeTiket, setActiveTiket] = useState(null);
  const [pesanRows, setPesanRows] = useState([]);
  const [pesanLoading, setPesanLoading] = useState(false);
  const [balasan, setBalasan] = useState('');
  const [sending, setSending] = useState(false);
  const [detailError, setDetailError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('tiket_bantuan')
      .select('*, agen:agen_id(full_name)')
      .order('updated_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const ringkasan = useMemo(() => {
    const hasil = {};
    for (const key of Object.keys(STATUS_TIKET)) hasil[key] = 0;
    for (const r of rows) hasil[r.status] = (hasil[r.status] || 0) + 1;
    return hasil;
  }, [rows]);

  async function bukaTiket(row) {
    setActiveTiket(row);
    setDetailError('');
    setBalasan('');
    setPesanLoading(true);
    const { data } = await supabase
      .from('tiket_pesan')
      .select('*, pengirim:pengirim_id(full_name, role)')
      .eq('tiket_id', row.id)
      .order('created_at', { ascending: true });
    setPesanRows(data || []);
    setPesanLoading(false);
  }

  async function kirimBalasan(e) {
    e.preventDefault();
    if (!activeTiket || !balasan.trim()) return;
    setDetailError('');
    setSending(true);
    const { error: err } = await supabase.from('tiket_pesan').insert({
      tiket_id: activeTiket.id,
      pengirim_id: user.id,
      isi: balasan.trim(),
    });
    setSending(false);
    if (err) {
      setDetailError(err.message);
      return;
    }
    setBalasan('');
    bukaTiket(activeTiket);
    load();
  }

  async function ubahStatus(status) {
    if (!activeTiket) return;
    setDetailError('');
    const { error: err } = await supabase.from('tiket_bantuan').update({ status }).eq('id', activeTiket.id);
    if (err) {
      setDetailError(err.message);
      return;
    }
    setActiveTiket((t) => ({ ...t, status }));
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Helpdesk Agen</h1>
        <p className="text-ink-soft text-sm mt-1">Pertanyaan &amp; kendala yang dilaporkan agen/mitra.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {Object.entries(STATUS_TIKET).map(([key, s]) => (
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

      <div className="card rounded-xl2 p-4 mb-4">
        <label className="text-[11px] font-semibold text-ink-soft block mb-1">Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field w-full sm:w-64 rounded-md2 px-3 py-2 text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
                <th className="p-4 whitespace-nowrap">Agen</th>
                <th className="p-4 whitespace-nowrap">Terakhir Diperbarui</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={4} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-ink-soft">Tidak ada tiket yang cocok.</td></tr>
              )}
              {filteredRows.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-accent-soft/40" onClick={() => bukaTiket(r)}>
                  <td className="p-4 font-medium">{r.subjek}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{r.agen?.full_name || '-'}</td>
                  <td className="p-4 whitespace-nowrap text-ink-soft">{tanggalID(r.updated_at)}</td>
                  <td className="p-4 text-center">
                    <Pil nada={STATUS_TIKET[r.status]?.nada || 'mute'}>{STATUS_TIKET[r.status]?.label || r.status}</Pil>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeTiket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveTiket(null); }}>
          <div className="card rounded-xl2 w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-lg font-semibold">{activeTiket.subjek}</h2>
              <button type="button" onClick={() => setActiveTiket(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <p className="text-xs text-ink-soft mb-4">{activeTiket.agen?.full_name}</p>

            <div className="flex gap-2 mb-4">
              {Object.entries(STATUS_TIKET).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => ubahStatus(key)}
                  className={`text-xs font-semibold py-1.5 px-3 rounded-md2 ${activeTiket.status === key ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[120px]">
              {pesanLoading && <p className="text-sm text-ink-soft">Memuat percakapan...</p>}
              {!pesanLoading && pesanRows.length === 0 && <p className="text-sm text-ink-soft">Belum ada pesan.</p>}
              {!pesanLoading && pesanRows.map((p) => {
                const dariAgen = p.pengirim?.role === 'agen';
                return (
                  <div key={p.id} className={`max-w-[80%] rounded-md2 px-3 py-2 text-sm ${dariAgen ? 'bg-paper-raised border border-rule' : 'bg-accent-soft ml-auto'}`}>
                    <p className="text-[10px] font-semibold text-ink-soft mb-0.5">{p.pengirim?.full_name} · {tanggalID(p.created_at)}</p>
                    <p className="whitespace-pre-wrap">{p.isi}</p>
                  </div>
                );
              })}
            </div>

            {detailError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2 mb-3">{detailError}</p>}

            <form onSubmit={kirimBalasan} className="flex gap-2">
              <input
                type="text"
                value={balasan}
                onChange={(e) => setBalasan(e.target.value)}
                placeholder="Tulis balasan..."
                className="field flex-1 rounded-md2 px-4 py-2.5 text-sm"
              />
              <button type="submit" disabled={sending || !balasan.trim()} className="bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-md2 text-sm">
                Kirim
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
