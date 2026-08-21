import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { rupiah, tanggalID } from '../lib/format';
import { StatusPil, STATUS_KOMISI } from '../components/ui';

const JENIS_MITRA_LABEL = { INDIVIDU: 'Individu', PERUSAHAAN: 'Perusahaan' };

// Sama persis polanya dengan grafik arus kas di Dashboard.jsx staf —
// portal ini seharusnya terasa seperti "dashboard", bukan sekadar
// kumpulan tabel, walau datanya beda (komisi milik agen, bukan buku
// kas seluruh JBI).
const CHART_AKRUAL_COLOR = '#F0791A';
const CHART_CAIR_COLOR = '#0D8088';

function KomisiChart({ data }) {
  const width = 640;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (data.every((d) => d.akrual === 0 && d.cair === 0)) {
    return <p className="text-xs text-ink-soft h-40 flex items-center">Belum ada komisi tercatat.</p>;
  }

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.akrual, d.cair)));
  const groupW = chartW / data.length;
  const barW = Math.min(22, groupW * 0.32);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" role="img" aria-label="Grafik komisi 6 bulan terakhir">
      {data.map((d, i) => {
        const cx = padding.left + groupW * i + groupW / 2;
        const akrualH = (d.akrual / maxVal) * chartH;
        const cairH = (d.cair / maxVal) * chartH;
        return (
          <g key={d.label}>
            <rect x={cx - barW - 2} y={padding.top + chartH - akrualH} width={barW} height={akrualH} rx={3} fill={CHART_AKRUAL_COLOR} />
            <rect x={cx + 2} y={padding.top + chartH - cairH} width={barW} height={cairH} rx={3} fill={CHART_CAIR_COLOR} />
            <text x={cx} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--ink-soft))">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function PortalAgenRingkasan() {
  const { user } = useAuth();
  const [jamaahCount, setJamaahCount] = useState(0);
  const [komisiRows, setKomisiRows] = useState([]);
  const [profilLengkap, setProfilLengkap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [pendaftaranRes, komisiRes, profilRes] = await Promise.all([
      supabase.from('v_pendaftaran_status').select('id', { count: 'exact', head: true }),
      supabase.from('v_komisi_agen').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    ]);
    if (pendaftaranRes.error || komisiRes.error || profilRes.error) {
      setError(pendaftaranRes.error?.message || komisiRes.error?.message || profilRes.error?.message);
      setLoading(false);
      return;
    }
    setJamaahCount(pendaftaranRes.count || 0);
    setKomisiRows(komisiRes.data || []);
    setProfilLengkap(profilRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const totalAkrual = komisiRows.filter((k) => k.status === 'AKRUAL').reduce((s, k) => s + Number(k.nominal), 0);
  const totalCair = komisiRows.filter((k) => k.status === 'CAIR').reduce((s, k) => s + Number(k.nominal), 0);

  const chartData = useMemo(() => {
    const buckets = {};
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets[key] = { label: d.toLocaleDateString('id-ID', { month: 'short' }), akrual: 0, cair: 0 };
      labels.push(key);
    }
    komisiRows.forEach((k) => {
      if (k.status === 'BATAL') return;
      const key = String(k.created_at).slice(0, 7);
      if (!buckets[key]) return;
      buckets[key].akrual += Number(k.nominal) || 0;
      if (k.status === 'CAIR') buckets[key].cair += Number(k.nominal) || 0;
    });
    return labels.map((k) => buckets[k]);
  }, [komisiRows]);

  if (loading) return <div className="text-sm text-ink-soft">Memuat...</div>;
  if (error) {
    return (
      <div className="card rounded-xl2 p-5 border-l-4 border-l-brick-500">
        <p className="font-semibold text-brick-600">Gagal memuat data</p>
        <p className="text-xs text-ink-soft mt-1">{error}</p>
      </div>
    );
  }

  const rekeningBelumDiisi = !profilLengkap?.nomor_rekening;

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Ringkasan</h1>
        <p className="text-ink-soft text-sm mt-1">Ikhtisar jamaah dan komisi Anda.</p>
      </div>

      {rekeningBelumDiisi && (
        <div className="card rounded-xl2 p-4 mb-6 border-l-4 border-l-accent text-sm">
          <b>Nomor rekening belum diisi.</b> Lengkapi{' '}
          <Link to="/portal-agen/profil" className="text-accent-text font-semibold hover:underline">profil Anda</Link>{' '}
          supaya admin JBI tahu ke mana komisi harus dicairkan.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Jamaah Terdaftar</p>
          <p className="tabular text-xl font-semibold mt-0.5">{jamaahCount}</p>
        </div>
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Komisi Belum Cair</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-orange-600">{rupiah(totalAkrual)}</p>
        </div>
        <div className="card rounded-xl2 p-4">
          <p className="text-xs text-ink-soft font-medium">Komisi Sudah Cair</p>
          <p className="tabular text-xl font-semibold mt-0.5 text-teal-700">{rupiah(totalCair)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div className="card rounded-xl2 p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-semibold">Profil Saya</p>
            <Link to="/portal-agen/profil" className="text-xs font-semibold text-accent-text hover:underline">
              Lengkapi →
            </Link>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium truncate">{profilLengkap?.full_name || '-'}</p>
              <p className="text-[11px] text-ink-soft">
                {JENIS_MITRA_LABEL[profilLengkap?.jenis_mitra] || 'Jenis mitra belum diisi'}
                {profilLengkap?.nama_perusahaan ? ` · ${profilLengkap.nama_perusahaan}` : ''}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-ink-soft">No. HP</p>
              <p className="text-sm">{profilLengkap?.phone || '-'}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-ink-soft shrink-0">Rekening</p>
              <p className="text-sm text-right truncate">
                {profilLengkap?.nomor_rekening ? `${profilLengkap.nama_bank || ''} · ${profilLengkap.nomor_rekening}` : 'Belum diisi'}
              </p>
            </div>
          </div>
        </div>

        <div className="card rounded-xl2 p-4 lg:col-span-2">
          <p className="font-display font-semibold mb-2">Komisi per Bulan (6 Bulan Terakhir)</p>
          <div className="flex items-center gap-4 mb-2 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" /> Akrual</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" /> Cair</span>
          </div>
          <KomisiChart data={chartData} />
        </div>
      </div>

      <div className="card rounded-xl2 p-4">
        <p className="font-display font-semibold mb-3">Aktivitas Terbaru</p>
        <div className="space-y-3">
          {komisiRows.length === 0 && <p className="text-xs text-ink-soft">Belum ada komisi tercatat.</p>}
          {komisiRows.slice(0, 8).map((k) => (
            <div key={k.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-md2 flex items-center justify-center text-xs font-bold shrink-0 ${k.status === 'CAIR' ? 'bg-teal-100 text-teal-700' : k.status === 'BATAL' ? 'bg-rule text-ink-soft' : 'bg-orange-100 text-orange-600'}`}>
                {k.status === 'CAIR' ? '✓' : k.status === 'BATAL' ? '✕' : '+'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{k.jamaah_nama} — {k.paket_nama}</p>
                <p className="text-[11px] text-ink-soft">{tanggalID(k.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="tabular text-sm font-semibold">{rupiah(k.nominal)}</p>
                <StatusPil peta={STATUS_KOMISI} nilai={k.status} bawaan="AKRUAL" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
