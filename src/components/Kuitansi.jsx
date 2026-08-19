import { rupiah, tanggalID } from '../lib/format';
import { terbilangRupiah } from '../lib/terbilang';

/**
 * Lembar kuitansi satu pembayaran (bukan rekap seluruh riwayat) — jamaah
 * biasanya minta bukti per setoran, bukan ringkasan sampai tanggal cetak.
 * Hanya muncul saat mencetak (hidden print:block), sama seperti slip lain
 * di aplikasi ini, supaya tidak mengganggu tampilan layar.
 */
export default function Kuitansi({ data }) {
  if (!data) return null;
  const { noKuitansi, jamaahNama, paketNama, nominal, tanggal, totalTagihan, sisaSetelah } = data;

  return (
    <div className="hidden print:block text-black lembar-cetak">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold">KUITANSI PEMBAYARAN</h2>
        <p className="text-sm">Jelajah Bumi Internasional</p>
      </div>

      <table className="w-full text-xs mb-5">
        <tbody>
          <tr><td className="py-0.5 w-36">No. Kuitansi</td><td className="py-0.5">: {noKuitansi}</td></tr>
          <tr><td className="py-0.5">Nama Jamaah</td><td className="py-0.5">: {jamaahNama}</td></tr>
          <tr><td className="py-0.5">Paket</td><td className="py-0.5">: {paketNama}</td></tr>
          <tr><td className="py-0.5">Tanggal Bayar</td><td className="py-0.5">: {tanggalID(tanggal)}</td></tr>
        </tbody>
      </table>

      <table className="w-full text-xs border-collapse mb-2">
        <tbody>
          <tr className="font-bold">
            <td className="border border-gray-400 p-2">JUMLAH DITERIMA</td>
            <td className="border border-gray-400 p-2 text-right">{rupiah(nominal)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs italic mb-5">Terbilang: {terbilangRupiah(nominal)}</p>

      <table className="w-full text-xs border-collapse mb-8">
        <tbody>
          <tr>
            <td className="border border-gray-400 p-1.5">Total Tagihan Paket</td>
            <td className="border border-gray-400 p-1.5 text-right">{rupiah(totalTagihan)}</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-gray-400 p-1.5">{Number(sisaSetelah) <= 0 ? 'LUNAS' : 'SISA TAGIHAN'}</td>
            <td className="border border-gray-400 p-1.5 text-right">{rupiah(Math.max(0, sisaSetelah))}</td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10px] mb-10">
        Kuitansi ini dicetak dari sistem dan sah tanpa tanda tangan basah. Bila ada selisih dengan
        catatan Anda, hubungi admin keuangan JBI.
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
