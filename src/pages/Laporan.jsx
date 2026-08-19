import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rupiah, tanggalID } from '../lib/format';
import { unduhCSV } from '../lib/csv';
import { Pil } from '../components/ui';

function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const TAB_OPTIONS = [
  { value: 'ARUS_KAS', label: 'Arus Kas' },
  { value: 'LABA_RUGI', label: 'Laba Rugi per Paket' },
  { value: 'PIUTANG', label: 'Piutang Jamaah' },
  { value: 'KOMISI', label: 'Komisi Agen' },
];

const AGING_LABEL = {
  BELUM_TEMPO: { label: 'Belum Jatuh Tempo', nada: 'mute' },
  TANPA_TEMPO: { label: 'Tanpa Jatuh Tempo', nada: 'mute' },
  TERLAMBAT_RINGAN: { label: 'Terlambat 1–30 Hari', nada: 'warn' },
  TERLAMBAT_SEDANG: { label: 'Terlambat 31–60 Hari', nada: 'bad' },
  TERLAMBAT_BERAT: { label: '> 60 Hari', nada: 'bad' },
};

function hitungAging(jatuhTempo) {
  if (!jatuhTempo) return 'TANPA_TEMPO';
  const hariTerlambat = Math.floor((Date.now() - new Date(jatuhTempo).getTime()) / 86400000);
  if (hariTerlambat <= 0) return 'BELUM_TEMPO';
  if (hariTerlambat <= 30) return 'TERLAMBAT_RINGAN';
  if (hariTerlambat <= 60) return 'TERLAMBAT_SEDANG';
  return 'TERLAMBAT_BERAT';
}

export default function Laporan() {
  const [tab, setTab] = useState('ARUS_KAS');

  const [customFrom, setCustomFrom] = useState(isoDate(new Date(new Date().setDate(1))));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [arusKas, setArusKas] = useState([]);
  const [labaRugi, setLabaRugi] = useState([]);
  const [piutang, setPiutang] = useState([]);
  const [komisi, setKomisi] = useState([]);

  const loadArusKas = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('transactions')
      .select('date, type, amount, transaction_categories(name)')
      .eq('status', 'APPROVED')
      .gte('date', customFrom)
      .lte('date', customTo);
    if (err) throw err;
    const peta = {};
    (data || []).forEach((t) => {
      const nama = t.transaction_categories?.name || 'Tanpa Kategori';
      if (!peta[nama]) peta[nama] = { kategori: nama, in: 0, out: 0 };
      peta[nama][t.type === 'IN' ? 'in' : 'out'] += Number(t.amount) || 0;
    });
    setArusKas(Object.values(peta).sort((a, b) => a.kategori.localeCompare(b.kategori)));
  }, [customFrom, customTo]);

  const loadLabaRugi = useCallback(async () => {
    const [paketRes, ringkasanRes] = await Promise.all([
      supabase.from('paket').select('id, nama, jenis, tanggal_berangkat, status').order('tanggal_berangkat', { ascending: false, nullsFirst: true }),
      supabase.from('v_paket_ringkasan').select('*'),
    ]);
    if (paketRes.error) throw paketRes.error;
    if (ringkasanRes.error) throw ringkasanRes.error;
    const ringkasanMap = Object.fromEntries((ringkasanRes.data || []).map((r) => [r.paket_id, r]));
    setLabaRugi((paketRes.data || []).map((p) => {
      const r = ringkasanMap[p.id] || {};
      const diterima = Number(r.total_diterima || 0);
      const realisasi = Number(r.total_realisasi_biaya || 0);
      return {
        ...p,
        total_tagihan_terkumpul: Number(r.total_tagihan_terkumpul || 0),
        total_diterima: diterima,
        total_anggaran: Number(r.total_anggaran || 0),
        total_realisasi_biaya: realisasi,
        margin_kas: diterima - realisasi,
      };
    }));
  }, []);

  const loadPiutang = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('v_pendaftaran_status')
      .select('*')
      .neq('status_pendaftaran', 'BATAL');
    if (err) throw err;
    setPiutang((data || []).filter((r) => Number(r.sisa) > 0));
  }, []);

  const loadKomisi = useCallback(async () => {
    const { data, error: err } = await supabase.from('v_komisi_agen').select('*');
    if (err) throw err;
    const peta = {};
    (data || []).forEach((k) => {
      if (!peta[k.agen_id]) peta[k.agen_id] = { agen_nama: k.agen_nama, akrual: 0, cair: 0 };
      if (k.status === 'AKRUAL') peta[k.agen_id].akrual += Number(k.nominal);
      if (k.status === 'CAIR') peta[k.agen_id].cair += Number(k.nominal);
    });
    setKomisi(Object.values(peta).sort((a, b) => a.agen_nama.localeCompare(b.agen_nama)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadArusKas(), loadLabaRugi(), loadPiutang(), loadKomisi()]);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [loadArusKas, loadLabaRugi, loadPiutang, loadKomisi]);

  useEffect(() => { load(); }, [load]);

  const totalArusKas = useMemo(
    () => arusKas.reduce((s, r) => ({ in: s.in + r.in, out: s.out + r.out }), { in: 0, out: 0 }),
    [arusKas]
  );

  const totalLabaRugi = useMemo(
    () => labaRugi.reduce((s, r) => ({
      diterima: s.diterima + r.total_diterima,
      realisasi: s.realisasi + r.total_realisasi_biaya,
      margin: s.margin + r.margin_kas,
    }), { diterima: 0, realisasi: 0, margin: 0 }),
    [labaRugi]
  );

  const totalPiutang = useMemo(() => piutang.reduce((s, r) => s + Number(r.sisa), 0), [piutang]);
  const totalKomisi = useMemo(
    () => komisi.reduce((s, r) => ({ akrual: s.akrual + r.akrual, cair: s.cair + r.cair }), { akrual: 0, cair: 0 }),
    [komisi]
  );

  function ekspor() {
    if (tab === 'ARUS_KAS') {
      unduhCSV(
        `arus-kas_${customFrom}_${customTo}.csv`,
        ['Kategori', 'Pemasukan', 'Pengeluaran'],
        arusKas.map((r) => [r.kategori, r.in, r.out])
      );
    } else if (tab === 'LABA_RUGI') {
      unduhCSV(
        'laba-rugi-per-paket.csv',
        ['Paket', 'Jenis', 'Tanggal Berangkat', 'Tagihan Terkumpul', 'Diterima', 'Anggaran', 'Realisasi Biaya', 'Margin Kas'],
        labaRugi.map((r) => [r.nama, r.jenis, r.tanggal_berangkat || '', r.total_tagihan_terkumpul, r.total_diterima, r.total_anggaran, r.total_realisasi_biaya, r.margin_kas])
      );
    } else if (tab === 'PIUTANG') {
      unduhCSV(
        'piutang-jamaah.csv',
        ['Jamaah', 'No HP', 'Paket', 'Total Tagihan', 'Terbayar', 'Sisa', 'Jatuh Tempo', 'Status Umur'],
        piutang.map((r) => [r.jamaah_nama, r.jamaah_no_hp || '', r.paket_nama, r.total_tagihan, r.terbayar, r.sisa, r.jatuh_tempo_berikutnya || '', AGING_LABEL[hitungAging(r.jatuh_tempo_berikutnya)].label])
      );
    } else {
      unduhCSV(
        'komisi-agen.csv',
        ['Agen', 'Akrual (Belum Cair)', 'Sudah Cair'],
        komisi.map((r) => [r.agen_nama, r.akrual, r.cair])
      );
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold">Laporan Keuangan</h1>
          <p className="text-ink-soft text-sm mt-1">Arus kas, laba rugi per paket, piutang jamaah, dan komisi agen.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={ekspor} className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-2 px-4 rounded-md2 text-sm">
            ⭳ Ekspor CSV
          </button>
          <button type="button" onClick={() => window.print()} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
            🖨 Cetak
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        {TAB_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`text-xs font-semibold px-4 py-2 rounded-md2 ${tab === t.value ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ARUS_KAS' && (
        <div className="card rounded-xl2 p-4 mb-4 flex flex-wrap items-end gap-3 print:hidden">
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Dari Tanggal</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="field rounded-md2 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1">Sampai Tanggal</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="field rounded-md2 px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600 print:hidden">{error}</div>
      )}
      {loading && <p className="text-sm text-ink-soft">Memuat...</p>}

      {!loading && tab === 'ARUS_KAS' && (
        <div className="card rounded-xl2 overflow-hidden">
          <div className="p-4 border-b border-rule">
            <h2 className="font-display font-semibold">Arus Kas — {tanggalID(customFrom)} s/d {tanggalID(customTo)}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                  <th className="p-4">Kategori</th>
                  <th className="p-4 whitespace-nowrap text-right">Pemasukan</th>
                  <th className="p-4 whitespace-nowrap text-right">Pengeluaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {arusKas.length === 0 && (
                  <tr><td colSpan={3} className="p-10 text-center text-ink-soft">Tidak ada transaksi pada periode ini.</td></tr>
                )}
                {arusKas.map((r) => (
                  <tr key={r.kategori}>
                    <td className="p-4 font-medium">{r.kategori}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{r.in > 0 ? rupiah(r.in) : '-'}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-brick-600">{r.out > 0 ? rupiah(r.out) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2 border-rule">
                  <td className="p-4">Total</td>
                  <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(totalArusKas.in)}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap text-brick-600">{rupiah(totalArusKas.out)}</td>
                </tr>
                <tr className="font-bold">
                  <td className="p-4">Selisih (Bersih)</td>
                  <td colSpan={2} className={`tabular p-4 text-right whitespace-nowrap ${totalArusKas.in - totalArusKas.out >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>
                    {rupiah(totalArusKas.in - totalArusKas.out)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'LABA_RUGI' && (
        <div className="card rounded-xl2 overflow-hidden">
          <div className="p-4 border-b border-rule">
            <h2 className="font-display font-semibold">Laba Rugi per Paket Keberangkatan</h2>
            <p className="text-xs text-ink-soft mt-0.5">Margin Kas = Diterima dari jamaah − Realisasi biaya ke vendor (bukan anggaran).</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                  <th className="p-4">Paket</th>
                  <th className="p-4 whitespace-nowrap text-right">Diterima</th>
                  <th className="p-4 whitespace-nowrap text-right">Realisasi Biaya</th>
                  <th className="p-4 whitespace-nowrap text-right">Margin Kas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {labaRugi.length === 0 && (
                  <tr><td colSpan={4} className="p-10 text-center text-ink-soft">Belum ada paket.</td></tr>
                )}
                {labaRugi.map((r) => (
                  <tr key={r.id}>
                    <td className="p-4">
                      <p className="font-medium">{r.nama}</p>
                      <p className="text-[11px] text-ink-soft">{r.tanggal_berangkat ? tanggalID(r.tanggal_berangkat) : 'Belum dijadwalkan'}</p>
                    </td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(r.total_diterima)}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-brick-600">{rupiah(r.total_realisasi_biaya)}</td>
                    <td className={`tabular p-4 text-right whitespace-nowrap font-semibold ${r.margin_kas >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>{rupiah(r.margin_kas)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2 border-rule">
                  <td className="p-4">Total</td>
                  <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(totalLabaRugi.diterima)}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap text-brick-600">{rupiah(totalLabaRugi.realisasi)}</td>
                  <td className={`tabular p-4 text-right whitespace-nowrap ${totalLabaRugi.margin >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>{rupiah(totalLabaRugi.margin)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'PIUTANG' && (
        <div className="card rounded-xl2 overflow-hidden">
          <div className="p-4 border-b border-rule flex items-center justify-between">
            <h2 className="font-display font-semibold">Piutang Jamaah</h2>
            <p className="text-sm tabular font-semibold">{rupiah(totalPiutang)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                  <th className="p-4">Jamaah</th>
                  <th className="p-4 whitespace-nowrap">Paket</th>
                  <th className="p-4 whitespace-nowrap text-right">Sisa</th>
                  <th className="p-4 whitespace-nowrap text-center">Jatuh Tempo</th>
                  <th className="p-4 whitespace-nowrap text-center">Umur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {piutang.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-ink-soft">Tidak ada piutang tersisa — semua jamaah lunas.</td></tr>
                )}
                {piutang.map((r) => {
                  const aging = hitungAging(r.jatuh_tempo_berikutnya);
                  return (
                    <tr key={r.id}>
                      <td className="p-4">
                        <p className="font-medium">{r.jamaah_nama}</p>
                        <p className="text-[11px] text-ink-soft">{r.jamaah_no_hp || '-'}</p>
                      </td>
                      <td className="p-4 whitespace-nowrap text-ink-soft">{r.paket_nama}</td>
                      <td className="tabular p-4 text-right whitespace-nowrap font-semibold">{rupiah(r.sisa)}</td>
                      <td className="p-4 text-center whitespace-nowrap text-ink-soft">{r.jatuh_tempo_berikutnya ? tanggalID(r.jatuh_tempo_berikutnya) : '-'}</td>
                      <td className="p-4 text-center"><Pil nada={AGING_LABEL[aging].nada}>{AGING_LABEL[aging].label}</Pil></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'KOMISI' && (
        <div className="card rounded-xl2 overflow-hidden">
          <div className="p-4 border-b border-rule">
            <h2 className="font-display font-semibold">Komisi Agen — Akrual vs Terbayar</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                  <th className="p-4">Agen</th>
                  <th className="p-4 whitespace-nowrap text-right">Akrual (Belum Cair)</th>
                  <th className="p-4 whitespace-nowrap text-right">Sudah Cair</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {komisi.length === 0 && (
                  <tr><td colSpan={3} className="p-10 text-center text-ink-soft">Belum ada komisi tercatat.</td></tr>
                )}
                {komisi.map((r) => (
                  <tr key={r.agen_nama}>
                    <td className="p-4 font-medium">{r.agen_nama}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-orange-600">{rupiah(r.akrual)}</td>
                    <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(r.cair)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2 border-rule">
                  <td className="p-4">Total</td>
                  <td className="tabular p-4 text-right whitespace-nowrap text-orange-600">{rupiah(totalKomisi.akrual)}</td>
                  <td className="tabular p-4 text-right whitespace-nowrap text-teal-700">{rupiah(totalKomisi.cair)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
