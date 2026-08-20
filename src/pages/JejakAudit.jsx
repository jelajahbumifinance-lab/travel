import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { tanggalID } from '../lib/format';
import { Aksi, Pil } from '../components/ui';

const TABLE_LABEL = {
  transactions: 'Transaksi (Buku Kas)',
  cicilan: 'Cicilan Jamaah',
  realisasi_biaya: 'Realisasi Biaya',
  komisi_agen: 'Komisi Agen',
  pendaftaran: 'Pendaftaran Jamaah',
  jamaah: 'Jamaah',
  paket: 'Paket',
  rab_item: 'Item RAB',
  aturan_komisi: 'Aturan Komisi',
  vendor: 'Vendor',
  accounts: 'Akun/Rekening',
  transaction_categories: 'Kategori Transaksi',
};

const AKSI_LABEL = { INSERT: 'Dibuat', UPDATE: 'Diubah' };

const KOLOM_DIABAIKAN = new Set(['id', 'created_at', 'created_by']);

function formatNamaField(key) {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatNilai(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  if (typeof v === 'number') return v.toLocaleString('id-ID');
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return tanggalID(v.slice(0, 10));
  return String(v);
}

function ringkasPerubahan(row) {
  if (row.action === 'INSERT') {
    const entries = Object.entries(row.new_data || {}).filter(([k]) => !KOLOM_DIABAIKAN.has(k));
    return entries.slice(0, 3).map(([k, v]) => `${formatNamaField(k)}: ${formatNilai(v)}`).join(' · ');
  }
  const old = row.old_data || {};
  const baru = row.new_data || {};
  const berubah = Object.keys(baru)
    .filter((k) => !KOLOM_DIABAIKAN.has(k))
    .filter((k) => JSON.stringify(old[k]) !== JSON.stringify(baru[k]));
  if (berubah.length === 0) return 'Tidak ada perubahan nilai';
  return berubah.slice(0, 2).map((k) => `${formatNamaField(k)}: ${formatNilai(old[k])} → ${formatNilai(baru[k])}`).join(' · ');
}

const PER_HALAMAN = 30;

export default function JejakAudit() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabelFilter, setTabelFilter] = useState('');
  const [aksiFilter, setAksiFilter] = useState('');
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [totalBaris, setTotalBaris] = useState(0);
  const [detailRow, setDetailRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    let q = supabase.from('v_audit_log').select('*', { count: 'exact' });
    if (tabelFilter) q = q.eq('table_name', tabelFilter);
    if (aksiFilter) q = q.eq('action', aksiFilter);
    if (dari) q = q.gte('changed_at', `${dari}T00:00:00`);
    if (sampai) q = q.lte('changed_at', `${sampai}T23:59:59`);
    const awal = (halaman - 1) * PER_HALAMAN;
    const { data, error: err, count } = await q
      .order('changed_at', { ascending: false })
      .range(awal, awal + PER_HALAMAN - 1);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRows(data || []);
    setTotalBaris(count ?? 0);
    setLoading(false);
  }, [tabelFilter, aksiFilter, dari, sampai, halaman]);

  useEffect(() => { load(); }, [load]);

  const totalHalaman = Math.max(1, Math.ceil(totalBaris / PER_HALAMAN));
  const halamanAman = Math.min(halaman, totalHalaman);
  const awal = (halamanAman - 1) * PER_HALAMAN;

  function gantiHalaman(n) {
    setHalaman(Math.min(Math.max(1, n), totalHalaman));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function terapkanFilter(fn) {
    return (...args) => { fn(...args); setHalaman(1); };
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Jejak Audit</h1>
        <p className="text-ink-soft text-sm mt-1">Riwayat perubahan pada seluruh data keuangan — siapa, kapan, apa yang berubah.</p>
      </div>

      <div className="card rounded-xl2 p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-ink-soft block mb-1">Tabel</label>
          <select value={tabelFilter} onChange={(e) => terapkanFilter(setTabelFilter)(e.target.value)} className="field w-full rounded-md2 px-3 py-2 text-sm">
            <option value="">Semua tabel</option>
            {Object.entries(TABLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-ink-soft block mb-1">Aksi</label>
          <select value={aksiFilter} onChange={(e) => terapkanFilter(setAksiFilter)(e.target.value)} className="field w-full rounded-md2 px-3 py-2 text-sm">
            <option value="">Semua aksi</option>
            <option value="INSERT">Dibuat</option>
            <option value="UPDATE">Diubah</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-ink-soft block mb-1">Dari Tanggal</label>
          <input type="date" value={dari} onChange={(e) => terapkanFilter(setDari)(e.target.value)} className="field w-full rounded-md2 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-ink-soft block mb-1">Sampai Tanggal</label>
          <input type="date" value={sampai} onChange={(e) => terapkanFilter(setSampai)(e.target.value)} className="field w-full rounded-md2 px-3 py-2 text-sm" />
        </div>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4 whitespace-nowrap">Waktu</th>
                <th className="p-4 whitespace-nowrap">Pengguna</th>
                <th className="p-4 whitespace-nowrap">Tabel</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
                <th className="p-4">Ringkasan Perubahan</th>
                <th className="p-4 whitespace-nowrap text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-ink-soft">Tidak ada riwayat yang cocok.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-4 whitespace-nowrap text-ink-soft tabular">{new Date(r.changed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-4 whitespace-nowrap font-medium">{r.changed_by_nama || 'Sistem'}</td>
                  <td className="p-4 whitespace-nowrap">{TABLE_LABEL[r.table_name] || r.table_name}</td>
                  <td className="p-4 text-center"><Pil nada={r.action === 'INSERT' ? 'ok' : 'warn'}>{AKSI_LABEL[r.action]}</Pil></td>
                  <td className="p-4 text-ink-soft max-w-md truncate">{ringkasPerubahan(r)}</td>
                  <td className="p-4 text-center"><Aksi onClick={() => setDetailRow(r)}>Lihat</Aksi></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalHalaman > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-rule">
            <p className="text-xs text-ink-soft tabular">
              Menampilkan {awal + 1}–{Math.min(awal + rows.length, totalBaris)} dari {totalBaris} riwayat
            </p>
            <div className="flex items-center gap-1">
              <Aksi onClick={() => gantiHalaman(halamanAman - 1)} disabled={halamanAman === 1 || loading}>← Sebelumnya</Aksi>
              <span className="text-xs text-ink-soft tabular px-2">{halamanAman} / {totalHalaman}</span>
              <Aksi onClick={() => gantiHalaman(halamanAman + 1)} disabled={halamanAman === totalHalaman || loading}>Berikutnya →</Aksi>
            </div>
          </div>
        )}
      </div>

      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailRow(null); }}
        >
          <div className="card rounded-xl2 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg font-semibold">{TABLE_LABEL[detailRow.table_name] || detailRow.table_name}</h2>
              <button type="button" onClick={() => setDetailRow(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <p className="text-xs text-ink-soft mb-4">
              {AKSI_LABEL[detailRow.action]} oleh <b>{detailRow.changed_by_nama || 'Sistem'}</b> ·{' '}
              {new Date(detailRow.changed_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
            <div className="space-y-1.5">
              {detailRow.action === 'INSERT'
                ? Object.entries(detailRow.new_data || {})
                    .filter(([k]) => !KOLOM_DIABAIKAN.has(k))
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 text-sm border-b border-rule py-1.5">
                        <span className="text-ink-soft">{formatNamaField(k)}</span>
                        <span className="tabular text-right">{formatNilai(v)}</span>
                      </div>
                    ))
                : Object.keys(detailRow.new_data || {})
                    .filter((k) => !KOLOM_DIABAIKAN.has(k))
                    .filter((k) => JSON.stringify((detailRow.old_data || {})[k]) !== JSON.stringify((detailRow.new_data || {})[k]))
                    .map((k) => (
                      <div key={k} className="text-sm border-b border-rule py-1.5">
                        <span className="text-ink-soft block mb-0.5">{formatNamaField(k)}</span>
                        <span className="tabular text-brick-600 line-through mr-2">{formatNilai((detailRow.old_data || {})[k])}</span>
                        <span className="tabular text-teal-700 font-semibold">{formatNilai((detailRow.new_data || {})[k])}</span>
                      </div>
                    ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
