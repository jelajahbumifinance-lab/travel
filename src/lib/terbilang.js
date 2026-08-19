/**
 * Ubah angka jadi kata dalam bahasa Indonesia — "3000000" -> "Tiga Juta Rupiah".
 *
 * Dipakai di kuitansi pembayaran. Terbilang bukan hiasan: ia yang membuat
 * nominal tidak bisa diubah diam-diam setelah dicetak. Menambah satu angka
 * nol pada "3.000.000" mudah; mengubah "Tiga Juta Rupiah" ikut cocok, tidak.
 *
 * Kaidah yang gampang keliru dan sengaja ditangani di sini:
 *   - 1.000  -> "Seribu", bukan "Satu Ribu"
 *   - 100    -> "Seratus", bukan "Satu Ratus"
 *   - 11-19  -> "Sebelas".."Sembilan Belas", bukan "Satu Puluh Satu"
 *   - 1.000.000 tetap "Satu Juta" (awalan "se-" hanya sampai ribuan)
 */

const SATUAN = [
  '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
  'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas',
];

function dibawahSeribu(n) {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${SATUAN[Math.floor(n / 10)]} Puluh${sisa ? ' ' + SATUAN[sisa] : ''}`;
  }
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  const depan = ratus === 1 ? 'Seratus' : `${SATUAN[ratus]} Ratus`;
  return `${depan}${sisa ? ' ' + dibawahSeribu(sisa) : ''}`;
}

/** Angka -> kata, tanpa embel-embel. 0 mengembalikan "Nol". */
export function terbilang(angka) {
  const n = Math.floor(Math.abs(Number(angka) || 0));
  if (n === 0) return 'Nol';

  const KELOMPOK = ['', 'Ribu', 'Juta', 'Miliar', 'Triliun'];
  const bagian = [];
  let sisa = n;
  let tingkat = 0;

  while (sisa > 0) {
    const tiga = sisa % 1000;
    if (tiga > 0) {
      const kata =
        tiga === 1 && tingkat === 1 ? 'Seribu' : `${dibawahSeribu(tiga)} ${KELOMPOK[tingkat]}`;
      bagian.unshift(kata.trim());
    }
    sisa = Math.floor(sisa / 1000);
    tingkat += 1;
  }

  return bagian.join(' ');
}

/** Bentuk siap cetak di kuitansi: "Tiga Juta Rupiah". */
export function terbilangRupiah(angka) {
  const n = Number(angka) || 0;
  const kata = `${terbilang(n)} Rupiah`;
  return n < 0 ? `Minus ${kata}` : kata;
}
