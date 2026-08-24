import { rupiah, tanggalID } from '../lib/format';
import { terbilangRupiah } from '../lib/terbilang';

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Kuitansi rekap — dicetak setelah pendaftaran LUNAS, merangkum SEMUA
 * cicilan yang sudah dibayar dalam satu lembar (beda dari Kuitansi.jsx
 * yang per-setoran). Jamaah yang mencicil bertahap sering minta bukti
 * lunas yang menunjukkan seluruh riwayatnya sekaligus, bukan cuma
 * kuitansi cicilan terakhir.
 */
export default function KuitansiLunas({ data }) {
  if (!data) return null;
  const { jamaahNama, paketNama, totalTagihan, rows } = data;
  const totalDibayar = rows.reduce((s, r) => s + Number(r.nominal), 0);

  return (
    <div className="hidden print:block text-black lembar-cetak">
      <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '2px solid #000' }}>
        <img src="/logo-icon.png" alt="" className="w-12 h-12 shrink-0" style={{ objectFit: 'contain' }} />
        <div>
          <p className="text-sm font-bold leading-tight">JELAJAH BUMI INTERNASIONAL</p>
          <p className="text-[10px] text-gray-600 leading-tight">jelajahbumigroup.com</p>
        </div>
      </div>
      <h2 className="text-center text-base font-bold mb-1 tracking-wide">KUITANSI LUNAS</h2>
      <p className="text-center text-[11px] mb-5">Rekap seluruh riwayat pembayaran</p>

      <table className="w-full text-xs mb-5">
        <tbody>
          <tr><td className="py-0.5 w-36">Nama Jamaah</td><td className="py-0.5">: {jamaahNama}</td></tr>
          <tr><td className="py-0.5">Paket</td><td className="py-0.5">: {paketNama}</td></tr>
          <tr><td className="py-0.5">Tanggal Cetak</td><td className="py-0.5">: {tanggalID(todayISO())}</td></tr>
        </tbody>
      </table>

      <table className="w-full text-xs border-collapse mb-2">
        <thead>
          <tr className="font-bold">
            <td className="border border-gray-400 p-1.5 w-8">No.</td>
            <td className="border border-gray-400 p-1.5">Tanggal</td>
            <td className="border border-gray-400 p-1.5">No. Kuitansi</td>
            <td className="border border-gray-400 p-1.5 text-right">Nominal</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.noKuitansi}>
              <td className="border border-gray-400 p-1.5">{i + 1}</td>
              <td className="border border-gray-400 p-1.5">{tanggalID(r.tanggal)}</td>
              <td className="border border-gray-400 p-1.5">{r.noKuitansi}</td>
              <td className="border border-gray-400 p-1.5 text-right">{rupiah(r.nominal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full text-xs border-collapse mb-2">
        <tbody>
          <tr className="font-bold">
            <td className="border border-gray-400 p-2">TOTAL DIBAYAR</td>
            <td className="border border-gray-400 p-2 text-right">{rupiah(totalDibayar)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs italic mb-5">Terbilang: {terbilangRupiah(totalDibayar)}</p>

      <table className="w-full text-xs border-collapse mb-8">
        <tbody>
          <tr>
            <td className="border border-gray-400 p-1.5">Total Tagihan Paket</td>
            <td className="border border-gray-400 p-1.5 text-right">{rupiah(totalTagihan)}</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-gray-400 p-1.5">STATUS</td>
            <td className="border border-gray-400 p-1.5 text-right">LUNAS</td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10px] mb-10">
        Kuitansi ini dicetak dari sistem dan sah tanpa tanda tangan basah — merangkum seluruh
        pembayaran yang tercatat untuk pendaftaran ini. Bila ada selisih dengan catatan Anda,
        hubungi admin keuangan JBI.
      </p>

      <div className="flex justify-end text-xs mt-10">
        <div className="text-center">
          <p>Admin Keuangan</p>
          <br /><br /><br />
          <p>(________________________)</p>
        </div>
      </div>
    </div>
  );
}
