-- ============================================================
-- JBI Finance — Jenis Kelamin Jamaah (untuk Roomlist)
-- Jalankan SETELAH sql/0001–0025.
--
-- Ditambahkan supaya staf bisa langsung melihat/membedakan laki-laki
-- dan perempuan saat mengatur anggota kamar (roomlist) — mencegah
-- salah menempatkan jamaah yang bukan mahram sekamar. Ini sekadar
-- info yang ditampilkan, bukan aturan yang dipaksakan sistem: pasangan
-- suami-istri atau keluarga memang wajar sekamar campuran, sistem
-- tidak tahu siapa mahram siapa — keputusan tetap di tangan staf.
--
-- Nullable & tidak wajib diisi — jamaah lama belum punya datanya, dan
-- itu tidak masalah (staf isi belakangan lewat Tagihan atau langsung
-- di menu Roomlist).
-- ============================================================

alter table jamaah add column if not exists jenis_kelamin text check (jenis_kelamin is null or jenis_kelamin in ('L', 'P'));
