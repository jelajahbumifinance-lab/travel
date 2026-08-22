import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { tanggalID } from '../lib/format';
import { unduhCSV } from '../lib/csv';
import { Aksi } from '../components/ui';
import { StatTile, WARNA_STAT, IconUsers, IconCheckCircle } from '../components/StatTile';

// Nomor HP Indonesia ditulis dengan berbagai gaya (08xx, +62, 62, dengan
// spasi/strip) — dirapikan ke format 62xxx yang dipakai wa.me supaya
// link-nya selalu valid apa pun cara nomornya diketik. Sama seperti
// Leads.jsx/CrmAgen.jsx.
function waLink(noHp) {
  const digits = String(noHp || '').replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits.startsWith('62') ? digits : `62${digits}`;
  return `https://wa.me/${normalized}`;
}

/**
 * Jamaah Alumni — daftar jamaah yang paketnya sudah SELESAI (sudah
 * berangkat & pulang) dan tagihannya LUNAS. Beda tujuan dari Leads
 * (corong pra-jualan) dan Manifest (operasional sebelum berangkat):
 * ini untuk treatment pasca-perjalanan — minta testimoni, referral,
 * remarketing paket berikutnya. Versi pertama read-only (lihat +
 * WhatsApp saja), fitur follow-up menyusul kalau sudah pas.
 */
export default function AlumniJamaah() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [paketFilter, setPaketFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('v_pendaftaran_status')
      .select('id, jamaah_id, jamaah_nama, jamaah_no_hp, jamaah_jenis_kelamin, paket_id, paket_nama, tanggal_berangkat, total_tagihan')
      .eq('paket_status', 'SELESAI')
      .eq('computed_status', 'LUNAS')
      .order('tanggal_berangkat', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const daftarPaket = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => { if (r.paket_id) map.set(r.paket_id, r.paket_nama); });
    return Array.from(map, ([id, nama]) => ({ id, nama }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (paketFilter && r.paket_id !== paketFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.jamaah_nama?.toLowerCase().includes(q) && !r.jamaah_no_hp?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, paketFilter]);

  function ekspor() {
    unduhCSV(
      'jamaah-alumni.csv',
      ['Nama', 'Jenis Kelamin', 'No. HP', 'Paket', 'Tanggal Berangkat'],
      filteredRows.map((r) => [
        r.jamaah_nama,
        r.jamaah_jenis_kelamin === 'L' ? 'Laki-laki' : r.jamaah_jenis_kelamin === 'P' ? 'Perempuan' : '',
        r.jamaah_no_hp || '',
        r.paket_nama || '',
        r.tanggal_berangkat ? tanggalID(r.tanggal_berangkat) : '',
      ])
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Jamaah Alumni</h1>
          <p className="text-ink-soft text-sm mt-1">
            Jamaah yang paketnya sudah selesai &amp; lunas — untuk follow-up testimoni, referral, dan remarketing paket berikutnya.
          </p>
        </div>
        <button
          type="button"
          onClick={ekspor}
          disabled={filteredRows.length === 0}
          className="text-xs font-semibold bg-accent-soft hover:bg-accent-soft-hover disabled:opacity-50 text-accent-text px-3 py-2 rounded-md2 whitespace-nowrap"
        >
          ↓ Ekspor CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <StatTile warna={WARNA_STAT.teal} Icon={IconUsers} label="Total Alumni" value={rows.length} />
        <StatTile warna={WARNA_STAT.sky} Icon={IconCheckCircle} label="Paket Selesai" value={daftarPaket.length} />
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="card rounded-xl2 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1.5">Cari</label>
            <input
              type="text"
              placeholder="Nama / No. HP"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field w-full rounded-md2 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1.5">Paket</label>
            <select
              value={paketFilter}
              onChange={(e) => setPaketFilter(e.target.value)}
              className="field w-full rounded-md2 px-4 py-2.5 text-sm"
            >
              <option value="">Semua paket</option>
              {daftarPaket.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Nama</th>
                <th className="p-4 whitespace-nowrap">Jenis Kelamin</th>
                <th className="p-4 whitespace-nowrap">No. HP</th>
                <th className="p-4">Paket</th>
                <th className="p-4 whitespace-nowrap">Tanggal Berangkat</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-ink-soft">
                    {rows.length === 0 ? 'Belum ada jamaah yang paketnya selesai & lunas.' : 'Tidak ada yang cocok dengan pencarian.'}
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => {
                const wa = waLink(r.jamaah_no_hp);
                return (
                  <tr key={r.id}>
                    <td className="p-4 font-medium">{r.jamaah_nama}</td>
                    <td className="p-4 whitespace-nowrap">
                      {r.jamaah_jenis_kelamin === 'L' && <span className="text-xs font-semibold text-blue-600">Laki-laki</span>}
                      {r.jamaah_jenis_kelamin === 'P' && <span className="text-xs font-semibold text-pink-600">Perempuan</span>}
                      {!r.jamaah_jenis_kelamin && <span className="text-xs text-ink-soft">-</span>}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {r.jamaah_no_hp || '-'}
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Buka WhatsApp" className="text-teal-600 hover:text-teal-700">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1s-.6.8-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4a.5.5 0 0 0 0-.5c-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4a15.6 15.6 0 0 0 1.5.6 3.6 3.6 0 0 0 1.7.1 2.8 2.8 0 0 0 1.8-1.3c.2-.4.2-.7.1-.8s-.2-.2-.4-.3Z" />
                            </svg>
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="p-4">{r.paket_nama}</td>
                    <td className="p-4 whitespace-nowrap text-ink-soft">{r.tanggal_berangkat ? tanggalID(r.tanggal_berangkat) : '-'}</td>
                    <td className="p-4 whitespace-nowrap text-center">
                      {wa ? <Aksi jenis="utama" href={wa}>WhatsApp</Aksi> : <span className="text-xs text-ink-soft">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
