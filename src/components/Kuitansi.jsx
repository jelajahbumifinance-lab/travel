import { rupiah, tanggalID } from '../lib/format';
import { terbilangRupiah } from '../lib/terbilang';

const TEAL = '#0A6670';
const TEAL_SOFT = '#D6F3F1';
const INK = '#16232A';

/**
 * Lembar kuitansi satu pembayaran (bukan rekap seluruh riwayat) — jamaah
 * biasanya minta bukti per setoran, bukan ringkasan sampai tanggal cetak.
 * Hanya muncul saat mencetak (hidden print:block), sama seperti slip lain
 * di aplikasi ini, supaya tidak mengganggu tampilan layar.
 *
 * Gaya kepala surat & tabel berwarna sengaja pakai warna solid inline
 * (bukan cuma class Tailwind) + `.lembar-cetak *` di index.css yang
 * memaksa `print-color-adjust: exact` — tanpa itu banyak browser diam-
 * diam mencetak warna latar sebagai putih polos kecuali pengguna sendiri
 * menyalakan "Print background graphics" di dialog cetaknya.
 */
export default function Kuitansi({ data }) {
  if (!data) return null;
  const { noKuitansi, jamaahNama, paketNama, nominal, tanggal, totalTagihan, sisaSetelah } = data;
  const lunas = Number(sisaSetelah) <= 0;

  return (
    <div className="hidden print:block text-black lembar-cetak" style={{ position: 'relative' }}>
      {/* Watermark logo transparan di tengah — supaya tidak gampang dipalsukan
          dengan cara diedit ulang di editor gambar/dokumen biasa. */}
      <img
        src="/logo-icon.png"
        alt=""
        style={{
          position: 'absolute',
          top: '60%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '58%',
          opacity: 0.06,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Kepala surat */}
      <div style={{ background: TEAL, color: '#fff', borderRadius: '0 0 28px 28px', padding: '20px 26px 30px', position: 'relative', zIndex: 1 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div style={{ background: '#fff', borderRadius: '9999px', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/logo-icon.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            </div>
            <span className="text-sm font-bold">JELAJAH BUMI INTERNASIONAL</span>
          </div>
          <div className="text-right text-xs">
            <p>No. {noKuitansi}</p>
            <p>{tanggalID(tanggal)}</p>
          </div>
        </div>
        <h1 className="text-4xl font-bold mt-4 leading-none">Kuitansi.</h1>
        <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Ruko Manhattan Forum Blok B7 No. 16, The Green BSD, Serpong - Tangerang Selatan · jelajahbumigroup.com
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Kartu info mengapung, menutup sedikit ujung bawah kepala surat */}
        <div className="grid grid-cols-2 gap-4" style={{ marginTop: '-20px', padding: '0 2px' }}>
          <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e5e5e5', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>Diterima Dari</p>
            <p className="text-sm font-bold mt-1">{jamaahNama}</p>
            <p className="text-xs text-gray-600">Paket: {paketNama}</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e5e5e5', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>Jumlah Diterima</p>
            <p className="text-xl font-bold mt-1" style={{ color: TEAL }}>{rupiah(nominal)}</p>
          </div>
        </div>

        <p className="text-sm italic mt-5 mb-4">Terbilang: {terbilangRupiah(nominal)}</p>

        <table className="w-full text-sm border-collapse" style={{ borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: INK, color: '#fff' }}>
              <td className="p-3 rounded-l-md2">Keterangan</td>
              <td className="p-3 text-right rounded-r-md2">Nominal</td>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td className="p-3">Cicilan pembayaran — {paketNama}</td>
              <td className="p-3 text-right">{rupiah(nominal)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td className="p-3">Total Tagihan Paket</td>
              <td className="p-3 text-right">{rupiah(totalTagihan)}</td>
            </tr>
            <tr style={{ background: TEAL_SOFT }}>
              <td className="p-3 font-bold rounded-l-md2" style={{ color: TEAL }}>{lunas ? 'LUNAS' : 'SISA TAGIHAN'}</td>
              <td className="p-3 text-right font-bold rounded-r-md2" style={{ color: TEAL }}>{rupiah(Math.max(0, sisaSetelah))}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex items-end justify-between mt-12">
          <div className="rounded-2xl p-3" style={{ background: TEAL_SOFT, maxWidth: '58%' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: TEAL }}>Catatan</p>
            <p className="text-[10px]" style={{ color: TEAL }}>
              Kuitansi ini dicetak dari sistem dan sah tanpa tanda tangan basah. Bila ada selisih dengan
              catatan Anda, hubungi admin keuangan JBI.
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
    </div>
  );
}
