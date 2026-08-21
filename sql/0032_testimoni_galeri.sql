-- ============================================================
-- JBI Finance — Testimoni Jamaah & Galeri Foto Dokumentasi
-- Jalankan SETELAH sql/0001–0031.
--
-- Untuk section testimoni + galeri foto di landing page (/minat).
-- Staf (direktur/admin_keuangan) mengelola isinya lewat halaman
-- khusus; pengunjung publik cuma bisa membaca baris yang aktif.
-- Foto disimpan di bucket Storage publik `landing-media` (dibuat
-- lewat SQL, sama seperti pola bucket paket-flyer di sql/0031).
-- ============================================================

-- ------------------------------------------------------------
-- 1. TESTIMONI
-- ------------------------------------------------------------
create table if not exists testimoni (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  keterangan text,              -- mis. "Umrah Maret 2025"
  isi text not null,             -- kutipan testimoni
  foto_url text,                 -- foto jamaah, opsional
  urutan int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table testimoni enable row level security;

drop policy if exists "testimoni_select_publik" on testimoni;
create policy "testimoni_select_publik" on testimoni
  for select using (is_active = true);

drop policy if exists "testimoni_select_staf" on testimoni;
create policy "testimoni_select_staf" on testimoni
  for select using (my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "testimoni_write_admin" on testimoni;
create policy "testimoni_write_admin" on testimoni
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 2. GALERI FOTO
-- ------------------------------------------------------------
create table if not exists galeri_foto (
  id uuid primary key default gen_random_uuid(),
  foto_url text not null,
  keterangan text,               -- caption, opsional
  urutan int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table galeri_foto enable row level security;

drop policy if exists "galeri_foto_select_publik" on galeri_foto;
create policy "galeri_foto_select_publik" on galeri_foto
  for select using (is_active = true);

drop policy if exists "galeri_foto_select_staf" on galeri_foto;
create policy "galeri_foto_select_staf" on galeri_foto
  for select using (my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "galeri_foto_write_admin" on galeri_foto;
create policy "galeri_foto_write_admin" on galeri_foto
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 3. STORAGE — bucket publik untuk foto testimoni & galeri
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('landing-media', 'landing-media', true)
on conflict (id) do nothing;

drop policy if exists "landing_media_select_public" on storage.objects;
create policy "landing_media_select_public" on storage.objects
  for select using (bucket_id = 'landing-media');

drop policy if exists "landing_media_insert_admin" on storage.objects;
create policy "landing_media_insert_admin" on storage.objects
  for insert with check (bucket_id = 'landing-media' and my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "landing_media_update_admin" on storage.objects;
create policy "landing_media_update_admin" on storage.objects
  for update using (bucket_id = 'landing-media' and my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "landing_media_delete_admin" on storage.objects;
create policy "landing_media_delete_admin" on storage.objects
  for delete using (bucket_id = 'landing-media' and my_role() in ('direktur', 'admin_keuangan'));
