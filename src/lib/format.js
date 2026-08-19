export function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

/** Format angka jadi "2.000.000" saat diketik — dipakai di semua input nominal.
 * Nilai yang disimpan tetap boleh diparse ulang dengan .replace(/\D/g,'') seperti biasa. */
export function formatRibuan(v) {
  const digits = String(v || '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
}

export function tanggalID(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
