import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID } from '../lib/format';
import { StatusPil, STATUS_TRANSAKSI } from '../components/ui';
import { StatTile, WARNA_STAT, IconWallet, IconTrendUp, IconTrendDown, IconReceipt } from '../components/StatTile';

const PERIOD_OPTIONS = [
  { value: 'THIS_MONTH', label: 'Bulan Ini' },
  { value: 'LAST_MONTH', label: 'Bulan Lalu' },
  { value: 'CUSTOM', label: 'Kustom' },
];

function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function periodRange(periodFilter, customFrom, customTo) {
  const now = new Date();
  if (periodFilter === 'THIS_MONTH') {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
  }
  if (periodFilter === 'LAST_MONTH') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  return { from: customFrom, to: customTo };
}

// Pemasukan memakai teal (aksen kedua JBI, statis di kedua mode).
// Pengeluaran sengaja tetap merah — konvensi "uang keluar = merah" terbaca
// sekilas tanpa legenda, jauh lebih penting dipertahankan di grafik
// keuangan daripada ikut selaras dengan tema.
const CHART_IN_COLOR = '#0D8088';
const CHART_OUT_COLOR = '#DC2626';

function CashFlowChart({ data }) {
  const width = 640;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return <p className="text-xs text-ink-soft h-40 flex items-center">Belum ada data transaksi.</p>;
  }

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.in, d.out)));
  const groupW = chartW / data.length;
  const barW = Math.min(22, groupW * 0.32);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" role="img" aria-label="Grafik arus kas 6 bulan terakhir">
      {data.map((d, i) => {
        const cx = padding.left + groupW * i + groupW / 2;
        const inH = (d.in / maxVal) * chartH;
        const outH = (d.out / maxVal) * chartH;
        return (
          <g key={d.label}>
            <rect x={cx - barW - 2} y={padding.top + chartH - inH} width={barW} height={inH} rx={3} fill={CHART_IN_COLOR} />
            <rect x={cx + 2} y={padding.top + chartH - outH} width={barW} height={outH} rx={3} fill={CHART_OUT_COLOR} />
            <text x={cx} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--ink-soft))">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [periodTotals, setPeriodTotals] = useState({ in: 0, out: 0 });
  const [periodCount, setPeriodCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [periodFilter, setPeriodFilter] = useState('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date(new Date().setDate(1))));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));

  const range = useMemo(() => periodRange(periodFilter, customFrom, customTo), [periodFilter, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const [accRes, trxRecentRes, trxChartRes, trxPeriodRes] = await Promise.all([
      supabase.from('v_account_balances').select('*').order('name'),
      supabase
        .from('transactions')
        .select('id, date, type, amount, description, status, transaction_categories(name)')
        .neq('status', 'VOID')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('transactions')
        .select('date, type, amount')
        .eq('status', 'APPROVED')
        .gte('date', isoDate(sixMonthsAgo)),
      supabase
        .from('transactions')
        .select('type, amount')
        .eq('status', 'APPROVED')
        .gte('date', range.from)
        .lte('date', range.to),
    ]);

    if (accRes.error || trxRecentRes.error || trxChartRes.error || trxPeriodRes.error) {
      setError(accRes.error?.message || trxRecentRes.error?.message || trxChartRes.error?.message || trxPeriodRes.error?.message);
      setLoading(false);
      return;
    }

    setAccounts(accRes.data || []);
    setRecent(trxRecentRes.data || []);

    const buckets = {};
    const monthLabels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets[key] = { label: d.toLocaleDateString('id-ID', { month: 'short' }), in: 0, out: 0 };
      monthLabels.push(key);
    }
    (trxChartRes.data || []).forEach((t) => {
      const key = String(t.date).substring(0, 7);
      if (!buckets[key]) return;
      buckets[key][t.type === 'IN' ? 'in' : 'out'] += Number(t.amount) || 0;
    });
    setChartData(monthLabels.map((k) => buckets[k]));

    const pt = { in: 0, out: 0 };
    (trxPeriodRes.data || []).forEach((t) => { pt[t.type === 'IN' ? 'in' : 'out'] += Number(t.amount) || 0; });
    setPeriodTotals(pt);
    setPeriodCount((trxPeriodRes.data || []).length);

    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const totalSaldo = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  if (loading) {
    return <div className="text-sm text-ink-soft">Memuat data...</div>;
  }

  if (error) {
    return (
      <div className="card rounded-xl2 p-5 border-l-4 border-l-brick-500">
        <p className="font-semibold text-brick-600">Gagal memuat dashboard</p>
        <p className="text-xs text-ink-soft mt-1">{error}</p>
      </div>
    );
  }

  const labelPeriode = PERIOD_OPTIONS.find((o) => o.value === periodFilter)?.label;
  const namaDepan = (profile?.full_name || '').split(' ')[0];

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">
            {namaDepan ? `Halo, ${namaDepan}` : 'Dashboard Keuangan'} 👋
          </h1>
          <p className="text-ink-soft text-sm mt-0.5">Ringkasan arus kas Jelajah Bumi Internasional.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="field rounded-md2 px-3 py-2 text-sm"
          >
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {periodFilter === 'CUSTOM' && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="field rounded-md2 px-2 py-2 text-sm" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="field rounded-md2 px-2 py-2 text-sm" />
            </>
          )}
          <button
            type="button"
            onClick={() => navigate('/buku-kas')}
            className="text-xs font-semibold bg-accent hover:bg-accent-hover text-white px-3 py-2 rounded-md2"
          >
            + Transaksi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatTile warna={WARNA_STAT.teal} Icon={IconWallet} label="Total Saldo (semua akun)" value={rupiah(totalSaldo)} />
        <StatTile warna={WARNA_STAT.moss} Icon={IconTrendUp} label={`Pemasukan (${labelPeriode})`} value={rupiah(periodTotals.in)} />
        <StatTile warna={WARNA_STAT.brick} Icon={IconTrendDown} label={`Pengeluaran (${labelPeriode})`} value={rupiah(periodTotals.out)} />
        <StatTile warna={WARNA_STAT.orange} Icon={IconReceipt} label={`Transaksi (${labelPeriode})`} value={periodCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card rounded-xl2 p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-semibold">Saldo per Akun</p>
            <button type="button" onClick={() => navigate('/rekening')} className="text-xs font-semibold text-accent-text hover:underline">
              Lihat Semua →
            </button>
          </div>
          <div className="space-y-3">
            {accounts.length === 0 && <p className="text-xs text-ink-soft">Belum ada akun kas/rekening.</p>}
            {accounts.slice(0, 5).map((a) => (
              <div key={a.account_id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-[11px] text-ink-soft">{a.type === 'CASH' ? 'Kas Tunai' : 'Rekening Bank'}</p>
                </div>
                <p className="tabular text-sm font-semibold shrink-0">{rupiah(a.current_balance)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card rounded-xl2 p-4 lg:col-span-2">
          <p className="font-display font-semibold mb-2">Tren Arus Kas (6 Bulan Terakhir)</p>
          <div className="flex items-center gap-4 mb-2 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" /> Pemasukan</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brick-500 inline-block" /> Pengeluaran</span>
          </div>
          <CashFlowChart data={chartData} />
        </div>
      </div>

      <div className="card rounded-xl2 p-4 mt-3">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-semibold">Aktivitas Terbaru</p>
          <button type="button" onClick={() => navigate('/buku-kas')} className="text-xs font-semibold text-accent-text hover:underline">
            Lihat Semua →
          </button>
        </div>
        <div className="space-y-3">
          {recent.length === 0 && <p className="text-xs text-ink-soft">Belum ada transaksi. Mulai dari menu Buku Kas.</p>}
          {recent.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.type === 'IN' ? 'bg-teal-100 dark:bg-teal-800/40 text-teal-700 dark:text-teal-300' : 'bg-brick-100 dark:bg-red-900/30 text-brick-600 dark:text-red-400'}`}>
                {t.type === 'IN' ? '+' : '−'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <p className="text-[11px] text-ink-soft">{tanggalID(t.date)} · {t.transaction_categories?.name || '-'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`tabular text-sm font-semibold ${t.type === 'IN' ? 'text-teal-700' : 'text-brick-600'}`}>
                  {t.type === 'IN' ? '+' : '−'}{rupiah(t.amount)}
                </p>
                <StatusPil peta={STATUS_TRANSAKSI} nilai={t.status} bawaan="APPROVED" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
