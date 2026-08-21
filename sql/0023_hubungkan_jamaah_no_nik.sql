-- ============================================================
-- JBI Finance — Hubungkan akun jamaah tanpa NIK
-- Jalankan SETELAH sql/0001–0022.
--
-- Banyak orang tidak hafal nomor KTP mereka sendiri — langkah "Hubungkan
-- data Anda" di pendaftaran mandiri jamaah (sql/0009) sebelumnya
-- mewajibkan NIK + No. HP sekaligus. Diganti jadi Nama Lengkap + No. HP.
--
-- Kenapa tidak No. HP saja: satu nomor HP sering dipakai bersama oleh
-- satu keluarga yang daftar Umrah bareng — kalau cuma No. HP, akun bisa
-- salah tersambung ke data anggota keluarga lain yang nomornya sama.
-- Nama sebagai pembanding kedua tetap menjaga itu tanpa perlu KTP.
--
-- Dicocokkan case-insensitive & rapikan spasi ganda (trim + lower +
-- collapse spasi) supaya beda kapitalisasi/spasi ekstra saat mengetik
-- tidak menggagalkan pencocokan yang sebenarnya sama.
-- ============================================================

-- Postgres tidak mengizinkan CREATE OR REPLACE mengganti NAMA parameter
-- (p_nik -> p_nama) walau tipenya sama persis (text, text) — harus
-- di-drop dulu baru dibuat ulang dengan nama parameter yang baru.
drop function if exists link_jamaah_account(text, text);

create function link_jamaah_account(p_nama text, p_no_hp text)
returns table(jamaah_id uuid, jamaah_nama text)
language plpgsql
security definer
as $$
declare
  v_jamaah record;
  v_sudah_terhubung boolean;
begin
  if auth.uid() is null then
    raise exception 'Anda harus login terlebih dahulu.';
  end if;

  select j.id, j.nama into v_jamaah from jamaah j
    where regexp_replace(trim(lower(j.nama)), '\s+', ' ', 'g') = regexp_replace(trim(lower(p_nama)), '\s+', ' ', 'g')
      and j.no_hp = p_no_hp
    limit 1;

  if v_jamaah.id is null then
    raise exception 'Data tidak ditemukan. Pastikan Nama Lengkap dan No. HP sesuai data yang terdaftar di JBI, atau hubungi admin.';
  end if;

  select exists(select 1 from profiles pr where pr.jamaah_id = v_jamaah.id) into v_sudah_terhubung;
  if v_sudah_terhubung then
    raise exception 'Data jamaah ini sudah terhubung ke akun lain. Hubungi admin JBI kalau menurut Anda ini keliru.';
  end if;

  insert into profiles (id, role, full_name, jamaah_id, is_active)
  values (auth.uid(), 'jamaah', v_jamaah.nama, v_jamaah.id, true);

  return query select v_jamaah.id, v_jamaah.nama;
end;
$$;

revoke all on function link_jamaah_account(text, text) from public;
grant execute on function link_jamaah_account(text, text) to authenticated;
