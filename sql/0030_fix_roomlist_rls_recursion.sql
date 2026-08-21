-- ============================================================
-- JBI Finance — Perbaikan: RLS roomlist_anggota rekursi tak terhingga
-- Jalankan SETELAH sql/0001–0029, SEGERA (Portal Jamaah error total).
--
-- sql/0029 menulis kebijakan roomlist_anggota_select_jamaah yang
-- men-subquery TABEL YANG SAMA (roomlist_anggota) di dalam USING-nya
-- sendiri — Postgres mengevaluasi ulang kebijakan RLS itu untuk
-- subquery-nya, yang mengevaluasi ulang lagi, dst — "infinite
-- recursion detected in policy for relation roomlist_anggota".
--
-- Perbaikan: fungsi security definer my_roomlist_ids() — dipanggil,
-- ISI FUNGSINYA berjalan dengan hak akses PEMILIK (bisa melewati RLS),
-- jadi subquery di dalamnya tidak memicu evaluasi kebijakan lagi.
-- Kebijakan roomlist & roomlist_anggota untuk jamaah ditulis ulang
-- memakainya, tidak lagi men-subquery langsung ke roomlist_anggota.
-- ============================================================

create or replace function my_roomlist_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select roomlist_id from roomlist_anggota where jamaah_id = my_jamaah_id();
$$;

drop policy if exists "roomlist_select_jamaah" on roomlist;
create policy "roomlist_select_jamaah" on roomlist
  for select using (
    my_role() = 'jamaah'
    and id in (select my_roomlist_ids())
  );

drop policy if exists "roomlist_anggota_select_jamaah" on roomlist_anggota;
create policy "roomlist_anggota_select_jamaah" on roomlist_anggota
  for select using (
    my_role() = 'jamaah'
    and roomlist_id in (select my_roomlist_ids())
  );
