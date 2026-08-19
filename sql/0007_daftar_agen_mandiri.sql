-- ============================================================
-- JBI Finance — Pendaftaran mandiri agen/mitra
-- Jalankan SETELAH sql/0001–0006.
--
-- Sebelumnya SATU-SATUNYA cara membuat akun agen adalah admin
-- mengundang lewat menu Undang Staf (atau manual lewat SQL). Ini
-- merepotkan kalau agen bisa mencapai ratusan — mereka sekarang bisa
-- daftar sendiri, TAPI akunnya tidak langsung aktif: harus disetujui
-- admin_keuangan/direktur dulu (lihat kolom is_active). Prinsip yang
-- sama seperti pendaftaran mandiri wali murid di OSB Finance.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolom email di profiles — sekadar supaya admin bisa mengenali
-- siapa yang mendaftar saat menyetujui (nama saja bisa ambigu kalau
-- ada dua "Ahmad"). Tabel auth.users tidak bisa di-query langsung
-- dari klien, jadi emailnya disalin ke sini saat akun dibuat.
-- ------------------------------------------------------------
alter table profiles add column if not exists email text;

-- ------------------------------------------------------------
-- 2. Pengguna baru boleh menulis SATU baris profiles untuk dirinya
-- sendiri — TAPI hanya dengan role='agen' dan is_active=false.
-- Dua syarat ini tidak bisa diakali dari luar aplikasi: mencoba
-- insert dengan role lain atau is_active=true akan ditolak Postgres,
-- bukan cuma disembunyikan di form.
-- ------------------------------------------------------------
drop policy if exists "profiles_insert_self_agen" on profiles;
create policy "profiles_insert_self_agen" on profiles
  for insert with check (
    id = auth.uid()
    and role = 'agen'
    and is_active = false
  );

-- ------------------------------------------------------------
-- 3. Admin keuangan/direktur perlu bisa MENGUBAH profiles — sebelum
-- ini tidak ada kebijakan update sama sekali di tabel ini, jadi
-- menyetujui (mengaktifkan) pendaftaran agen baru akan gagal diam-diam.
-- ------------------------------------------------------------
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles
  for update using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));
