-- ============================================================
-- JBI Finance — Flyer/Poster Promosi per Paket
-- Jalankan SETELAH sql/0001–0030.
--
-- Supaya kartu paket di landing page (/minat) bisa menampilkan flyer
-- promosi yang staf desain sendiri (Canva dll.), bukan cuma teks polos.
-- Dua bagian: kolom flyer_url di tabel paket, dan bucket Storage publik
-- untuk gambar flyernya (dibuat lewat SQL supaya tidak perlu klak-klik
-- manual di Supabase Dashboard).
-- ============================================================

alter table paket add column if not exists flyer_url text;

-- Bucket publik — gambar flyer memang untuk ditampilkan ke pengunjung
-- umum di landing page, bukan data sensitif.
insert into storage.buckets (id, name, public)
values ('paket-flyer', 'paket-flyer', true)
on conflict (id) do nothing;

drop policy if exists "paket_flyer_select_public" on storage.objects;
create policy "paket_flyer_select_public" on storage.objects
  for select using (bucket_id = 'paket-flyer');

drop policy if exists "paket_flyer_insert_admin" on storage.objects;
create policy "paket_flyer_insert_admin" on storage.objects
  for insert with check (bucket_id = 'paket-flyer' and my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "paket_flyer_update_admin" on storage.objects;
create policy "paket_flyer_update_admin" on storage.objects
  for update using (bucket_id = 'paket-flyer' and my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "paket_flyer_delete_admin" on storage.objects;
create policy "paket_flyer_delete_admin" on storage.objects
  for delete using (bucket_id = 'paket-flyer' and my_role() in ('direktur', 'admin_keuangan'));
