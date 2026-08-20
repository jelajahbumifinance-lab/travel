-- ============================================================
-- JBI Finance — Portal Jamaah Self-Service (Fase 2, awal)
-- Jalankan SETELAH sql/0001–0008.
--
-- Jamaah bisa mendaftar akun sendiri dan menghubungkannya ke data
-- jamaah yang SUDAH ADA (dibuat staf/agen saat pendaftaran ke paket)
-- lewat verifikasi NIK + No. HP — bukan membuat data jamaah baru.
-- Kalau keduanya cocok dan belum pernah dihubungkan ke akun lain,
-- akun langsung aktif (verifikasi data ITU SENDIRI adalah gerbang
-- keamanannya — beda dari agen yang tidak punya data pembanding sama
-- sekali, sehingga perlu persetujuan admin manual).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Peran baru "jamaah" + tautan ke baris jamaah miliknya
-- ------------------------------------------------------------
alter table profiles add column if not exists jamaah_id uuid references jamaah(id);

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('direktur', 'admin_keuangan', 'kasir', 'agen', 'jamaah'));

create or replace function my_jamaah_id()
returns uuid
language sql
security definer
stable
as $$
  select jamaah_id from profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 2. Akses portal jamaah — hanya baris miliknya sendiri
-- ------------------------------------------------------------
drop policy if exists "jamaah_select_self_portal" on jamaah;
create policy "jamaah_select_self_portal" on jamaah
  for select using (my_role() = 'jamaah' and id = my_jamaah_id());

drop policy if exists "pendaftaran_select_jamaah" on pendaftaran;
create policy "pendaftaran_select_jamaah" on pendaftaran
  for select using (my_role() = 'jamaah' and jamaah_id = my_jamaah_id());

-- Nama & tanggal paket tidak sensitif, sama seperti kebijakan agen.
drop policy if exists "paket_select_jamaah" on paket;
create policy "paket_select_jamaah" on paket
  for select using (my_role() = 'jamaah');

drop policy if exists "cicilan_select_jamaah" on cicilan;
create policy "cicilan_select_jamaah" on cicilan
  for select using (
    my_role() = 'jamaah'
    and exists (
      select 1 from pendaftaran p
      where p.id = cicilan.pendaftaran_id and p.jamaah_id = my_jamaah_id()
    )
  );

-- ------------------------------------------------------------
-- 3. RPC — hubungkan akun baru ke data jamaah lewat NIK + No. HP
--
-- Pencocokan dan penulisan profiles dikerjakan di sini (security
-- definer), bukan lewat kebijakan RLS insert biasa — supaya logikanya
-- ("cocok DUA-duanya" dan "belum pernah dihubungkan ke akun lain")
-- tidak bisa diakali dari klien.
-- ------------------------------------------------------------
create or replace function link_jamaah_account(p_nik text, p_no_hp text)
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
    where j.nik = p_nik and j.no_hp = p_no_hp
    limit 1;

  if v_jamaah.id is null then
    raise exception 'Data tidak ditemukan. Pastikan NIK dan No. HP sesuai data yang terdaftar di JBI, atau hubungi admin.';
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
