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
 * kuitansi cicilan terakhir. Letterhead/watermark/tanda tangan sengaja
 * disamakan persis dengan Kuitansi.jsx supaya dua dokumen ini terasa
 * satu keluarga, bukan dua desain berbeda.
 */
export default function KuitansiLunas({ data }) {
  if (!data) return null;
  const { jamaahNama, paketNama, totalTagihan, rows } = data;
  const totalDibayar = rows.reduce((s, r) => s + Number(r.nominal), 0);

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
        <h2 className="text-center text-xl font-bold mb-1 tracking-wide">KUITANSI LUNAS</h2>
        <p className="text-center text-sm mb-6">Rekap seluruh riwayat pembayaran</p>

        <table className="w-full text-sm mb-6">
          <tbody>
            <tr><td className="py-1 w-40">Nama Jamaah</td><td className="py-1">: {jamaahNama}</td></tr>
            <tr><td className="py-1">Paket</td><td className="py-1">: {paketNama}</td></tr>
            <tr><td className="py-1">Tanggal Cetak</td><td className="py-1">: {tanggalID(todayISO())}</td></tr>
          </tbody>
        </table>

        <table className="w-full text-sm border-collapse mb-2">
          <thead>
            <tr className="font-bold">
              <td className="border border-gray-400 p-2 w-10">No.</td>
              <td className="border border-gray-400 p-2">Tanggal</td>
              <td className="border border-gray-400 p-2">No. Kuitansi</td>
              <td className="border border-gray-400 p-2 text-right">Nominal</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.noKuitansi}>
                <td className="border border-gray-400 p-2">{i + 1}</td>
                <td className="border border-gray-400 p-2">{tanggalID(r.tanggal)}</td>
                <td className="border border-gray-400 p-2">{r.noKuitansi}</td>
                <td className="border border-gray-400 p-2 text-right">{rupiah(r.nominal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="w-full text-base border-collapse mb-2">
          <tbody>
            <tr className="font-bold">
              <td className="border border-gray-400 p-3">TOTAL DIBAYAR</td>
              <td className="border border-gray-400 p-3 text-right">{rupiah(totalDibayar)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm italic mb-6">Terbilang: {terbilangRupiah(totalDibayar)}</p>

        <table className="w-full text-sm border-collapse mb-8">
          <tbody>
            <tr>
              <td className="border border-gray-400 p-2">Total Tagihan Paket</td>
              <td className="border border-gray-400 p-2 text-right">{rupiah(totalTagihan)}</td>
            </tr>
            <tr className="font-bold">
              <td className="border border-gray-400 p-2">STATUS</td>
              <td className="border border-gray-400 p-2 text-right">LUNAS</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs mb-10">
          Kuitansi ini dicetak dari sistem dan sah tanpa tanda tangan basah — merangkum seluruh
          pembayaran yang tercatat untuk pendaftaran ini. Bila ada selisih dengan catatan Anda,
          hubungi admin keuangan JBI.
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
