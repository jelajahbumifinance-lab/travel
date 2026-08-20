-- ============================================================
-- JBI Finance — Manifest & Data Paspor (Fase 2)
-- Jalankan SETELAH sql/0001–0009.
--
-- Menambah kolom data paspor/kelahiran ke tabel jamaah yang sudah ada.
-- Tidak perlu kebijakan RLS baru — jamaah_write_staf (dari 0002) sudah
-- mengizinkan direktur/admin_keuangan/kasir menulis ke SEMUA kolom
-- tabel jamaah, termasuk yang baru ini.
-- ============================================================

alter table jamaah add column if not exists nama_paspor text;
alter table jamaah add column if not exists no_paspor text;
alter table jamaah add column if not exists tempat_lahir text;
alter table jamaah add column if not exists tanggal_lahir date;
alter table jamaah add column if not exists jenis_kelamin text check (jenis_kelamin in ('L', 'P'));
alter table jamaah add column if not exists tanggal_terbit_paspor date;
alter table jamaah add column if not exists tanggal_berlaku_paspor date;
alter table jamaah add column if not exists status_dokumen text not null default 'BELUM_LENGKAP'
  check (status_dokumen in ('BELUM_LENGKAP', 'LENGKAP', 'PROSES_VISA', 'VISA_TERBIT'));

comment on column jamaah.tanggal_berlaku_paspor is 'Tanggal habis berlaku paspor — dipakai halaman Manifest untuk memperingatkan kalau kurang dari 6 bulan dari tanggal berangkat, syarat umum visa Umrah/Haji.';
