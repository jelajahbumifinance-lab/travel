-- ============================================================
-- JBI Finance — Profil lengkap agen/mitra + rekening pencairan komisi
-- Jalankan SETELAH sql/0001–0013.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolom profil tambahan — dipakai peran agen (dan bisa saja
-- berguna untuk staf lain nanti), sengaja nullable karena tidak
-- semua peran butuh mengisinya.
-- ------------------------------------------------------------
alter table profiles add column if not exists alamat text;
alter table profiles add column if not exists nik text;
alter table profiles add column if not exists jenis_mitra text check (jenis_mitra in ('INDIVIDU', 'PERUSAHAAN'));
alter table profiles add column if not exists nama_perusahaan text;
alter table profiles add column if not exists npwp text;
alter table profiles add column if not exists nama_bank text;
alter table profiles add column if not exists nomor_rekening text;
alter table profiles add column if not exists nama_pemilik_rekening text;

-- ------------------------------------------------------------
-- 2. Setiap pengguna boleh mengubah profilnya SENDIRI (sebelum ini
-- cuma admin yang punya kebijakan update profiles sama sekali —
-- agen tidak bisa mengisi profilnya walau ingin).
--
-- Kebijakan RLS ini sengaja LONGGAR (semua kolom, bukan cuma kolom
-- baru) — batasan sebenarnya ("tidak boleh mengubah role/is_active
-- sendiri") ditegakkan lewat trigger di bawah, bukan di sini, karena
-- RLS Postgres tidak punya cara alami membatasi PER KOLOM saat
-- update baris yang sama.
-- ------------------------------------------------------------
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- 3. Kunci kolom sensitif — role, is_active, dan jamaah_id TIDAK
-- BOLEH diubah lewat self-update, berapa pun kali dicoba. Kalau
-- pemanggilnya bukan admin/direktur, tiga kolom itu dipaksa kembali
-- ke nilai lama sebelum baris disimpan — mencegah agen menaikkan
-- perannya sendiri jadi direktur lewat form edit profil.
-- ------------------------------------------------------------
create or replace function fn_jaga_kolom_sensitif_profiles()
returns trigger
language plpgsql
security definer
as $$
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    new.role := old.role;
    new.is_active := old.is_active;
    new.jamaah_id := old.jamaah_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jaga_kolom_sensitif_profiles on profiles;
create trigger trg_jaga_kolom_sensitif_profiles
  before update on profiles
  for each row execute function fn_jaga_kolom_sensitif_profiles();
