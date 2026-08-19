/** Unduh data tabel sebagai CSV — dibuka langsung di Excel/Sheets tanpa
 * perlu library tambahan. BOM di depan supaya karakter non-ASCII (mis. "—")
 * terbaca benar di Excel Windows, bukan cuma di editor teks biasa. */
export function unduhCSV(namaFile, header, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [header.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
