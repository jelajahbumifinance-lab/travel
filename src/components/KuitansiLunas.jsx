import { rupiah, tanggalID } from '../lib/format';
import { terbilangRupiah } from '../lib/terbilang';

const TEAL = '#0A6670';
const TEAL_SOFT = '#D6F3F1';
const INK = '#16232A';

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Kuitansi rekap — dicetak setelah pendaftaran LUNAS, merangkum SEMUA
 * cicilan yang sudah dibayar dalam satu lembar (beda dari Kuitansi.jsx
 * yang per-setoran). Gaya visual & teknik watermark (backgroundImage
 * pada kontainer utama, BUKAN elemen <img> position:absolute/fixed
 * terpisah — lihat catatan panjang di Kuitansi.jsx soal kenapa) sengaja
 * disamakan persis dengan Kuitansi.jsx.
 */
export default function KuitansiLunas({ data }) {
  if (!data) return null;
  const { jamaahNama, paketNama, totalTagihan, rows } = data;
  const totalDibayar = rows.reduce((s, r) => s + Number(r.nominal), 0);

  return (
    <div
      className="hidden print:block text-black lembar-cetak"
      style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.94), rgba(255,255,255,0.94)), url(/logo-icon.png)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: '55% auto',
      }}
    >
      <div style={{ background: TEAL, color: '#fff', borderRadius: '0 0 28px 28px', padding: '20px 26px 30px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div style={{ background: '#fff', borderRadius: '9999px', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/logo-icon.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            </div>
            <span className="text-sm font-bold">JELAJAH BUMI INTERNASIONAL</span>
          </div>
          <div className="text-right text-xs">
            <p>{tanggalID(todayISO())}</p>
          </div>
        </div>
        <h1 className="text-4xl font-bold mt-4 leading-none">Kuitansi Lunas.</h1>
        <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Ruko Manhattan Forum Blok B7 No. 16, The Green BSD, Serpong - Tangerang Selatan · jelajahbumigroup.com
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e5e5e5' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>Diterima Dari</p>
          <p className="text-sm font-bold mt-1">{jamaahNama}</p>
          <p className="text-xs text-gray-600">Paket: {paketNama}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e5e5e5' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>Total Dibayar</p>
          <p className="text-xl font-bold mt-1" style={{ color: TEAL }}>{rupiah(totalDibayar)}</p>
        </div>
      </div>

      <p className="text-sm italic mt-5 mb-4">Terbilang: {terbilangRupiah(totalDibayar)}</p>

      <table className="w-full text-sm border-collapse" style={{ borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: INK, color: '#fff' }}>
            <td className="p-2.5 rounded-l-md2 w-8">No.</td>
            <td className="p-2.5">Tanggal</td>
            <td className="p-2.5">No. Kuitansi</td>
            <td className="p-2.5 text-right rounded-r-md2">Nominal</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.noKuitansi} style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td className="p-2.5">{i + 1}</td>
              <td className="p-2.5">{tanggalID(r.tanggal)}</td>
              <td className="p-2.5">{r.noKuitansi}</td>
              <td className="p-2.5 text-right">{rupiah(r.nominal)}</td>
            </tr>
          ))}
          <tr>
            <td className="p-2.5" colSpan={3}>Total Tagihan Paket</td>
            <td className="p-2.5 text-right">{rupiah(totalTagihan)}</td>
          </tr>
          <tr style={{ background: TEAL_SOFT }}>
            <td className="p-2.5 font-bold rounded-l-md2" style={{ color: TEAL }} colSpan={3}>STATUS</td>
            <td className="p-2.5 text-right font-bold rounded-r-md2" style={{ color: TEAL }}>LUNAS</td>
          </tr>
        </tbody>
      </table>

      <div className="flex items-end justify-between mt-12">
        <div className="rounded-2xl p-3" style={{ background: TEAL_SOFT, maxWidth: '58%' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: TEAL }}>Catatan</p>
          <p className="text-[10px]" style={{ color: TEAL }}>
            Kuitansi ini dicetak dari sistem dan sah tanpa tanda tangan basah — merangkum seluruh
            pembayaran yang tercatat untuk pendaftaran ini. Bila ada selisih dengan catatan Anda,
            hubungi admin keuangan JBI.
          </p>
        </div>
        <div className="text-center text-sm shrink-0">
          <p>Direktur</p>
          <img
            src="/ttd-direktur.png"
            alt="Tanda tangan Direktur"
            style={{ height: '70px', margin: '4px auto', display: 'block', objectFit: 'contain' }}
          />
          <p className="font-semibold">Fauziah Salim Barabud</p>
        </div>
      </div>
    </div>
  );
}
