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
    <div className="hidden print:block text-black lembar-cetak" style={{ position: 'relative' }}>
      {/* Watermark logo transparan di tengah — supaya tidak gampang dipalsukan
          dengan cara diedit ulang di editor gambar/dokumen biasa. */}
      <img
        src="/logo-icon.png"
        alt=""
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '65%',
          opacity: 0.07,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '2px solid #000' }}>
          <img src="/logo-icon.png" alt="" className="w-16 h-16 shrink-0" style={{ objectFit: 'contain' }} />
          <div>
            <p className="text-lg font-bold leading-tight">JELAJAH BUMI INTERNASIONAL</p>
            <p className="text-xs text-gray-600 leading-tight">Ruko Manhattan Forum Blok B7 No. 16, The Green BSD, Serpong - Tangerang Selatan</p>
            <p className="text-xs text-gray-600 leading-tight">jelajahbumigroup.com</p>
          </div>
        </div>
        <h2 className="text-center text-xl font-bold mb-6 tracking-wide">KUITANSI PEMBAYARAN</h2>

        <table className="w-full text-sm mb-6">
          <tbody>
            <tr><td className="py-1 w-40">No. Kuitansi</td><td className="py-1">: {noKuitansi}</td></tr>
            <tr><td className="py-1">Nama Jamaah</td><td className="py-1">: {jamaahNama}</td></tr>
            <tr><td className="py-1">Paket</td><td className="py-1">: {paketNama}</td></tr>
            <tr><td className="py-1">Tanggal Bayar</td><td className="py-1">: {tanggalID(tanggal)}</td></tr>
          </tbody>
        </table>

        <table className="w-full text-base border-collapse mb-2">
          <tbody>
            <tr className="font-bold">
              <td className="border border-gray-400 p-3">JUMLAH DITERIMA</td>
              <td className="border border-gray-400 p-3 text-right">{rupiah(nominal)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm italic mb-6">Terbilang: {terbilangRupiah(nominal)}</p>

        <table className="w-full text-sm border-collapse mb-8">
          <tbody>
            <tr>
              <td className="border border-gray-400 p-2">Total Tagihan Paket</td>
              <td className="border border-gray-400 p-2 text-right">{rupiah(totalTagihan)}</td>
            </tr>
            <tr className="font-bold">
              <td className="border border-gray-400 p-2">{Number(sisaSetelah) <= 0 ? 'LUNAS' : 'SISA TAGIHAN'}</td>
              <td className="border border-gray-400 p-2 text-right">{rupiah(Math.max(0, sisaSetelah))}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs mb-10">
          Kuitansi ini dicetak dari sistem dan sah tanpa tanda tangan basah. Bila ada selisih dengan
          catatan Anda, hubungi admin keuangan JBI.
        </p>

        <div className="flex justify-end text-sm mt-10">
          <div className="text-center">
            <p>Direktur</p>
            <img
              src="/ttd-direktur.png"
              alt="Tanda tangan Direktur"
              style={{ height: '80px', margin: '4px auto', display: 'block', objectFit: 'contain' }}
            />
            <p className="font-semibold">Fauziah Salim Barabud</p>
          </div>
        </div>
      </div>
    </div>
  );
}
