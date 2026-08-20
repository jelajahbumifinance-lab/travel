-- ============================================================
-- JBI Finance — Pendaftaran mandiri agen langsung aktif
-- Jalankan SETELAH sql/0001–0011.
--
-- Sebelumnya agen yang daftar sendiri butuh persetujuan admin
-- (is_active=false) karena tidak ada data pembanding untuk verifikasi
-- otomatis. Setelah ditinjau ulang: peran agen di RLS hanya BISA
-- MEMBACA data yang staf sendiri kaitkan ke mereka (jamaah.agen_id
-- diisi staf saat pendaftaran, bukan oleh agen) — akun agen yang asal
-- daftar sendiri cuma mendapat portal kosong sampai staf benar-benar
-- mengaitkan jamaah ke mereka. Risikonya rendah, jadi persetujuan
-- manual dihapus supaya konsisten dengan alur jamaah yang juga
-- langsung aktif.
-- ============================================================
drop policy if exists "profiles_insert_self_agen" on profiles;
create policy "profiles_insert_self_agen" on profiles
  for insert with check (
    id = auth.uid()
    and role = 'agen'
    and is_active = true
  );
