-- ============================================================
-- JBI Finance — Info Penerbangan + Hotel/Roommate untuk Jamaah
-- Jalankan SETELAH sql/0001–0028.
--
-- Dua hal:
--  1. Tabel baru `penerbangan` — detail maskapai/nomor penerbangan per
--     paket, dikelola staf lewat tab baru di menu Roomlist & Itinerary.
--  2. Roomlist/roomlist_anggota SEBELUM INI cuma bisa dibaca staf sama
--     sekali — jamaah tidak pernah bisa melihat kamar & teman sekamarnya
--     sendiri di Portal Jamaah. Ditambah kebijakan baca terbatas: jamaah
--     hanya boleh melihat kamar yang dia sendiri jadi anggotanya, dan
--     nama jamaah lain HANYA kalau sekamar dengannya (bukan seluruh
--     data jamaah lain) — supaya tetap tidak membocorkan data di luar
--     yang memang perlu dia tahu.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PENERBANGAN
-- ------------------------------------------------------------
create table if not exists penerbangan (
  id uuid primary key default gen_random_uuid(),
  paket_id uuid not null references paket(id),
  jenis text not null check (jenis in ('BERANGKAT', 'PULANG')),
  maskapai text,
  nomor_penerbangan text,
  bandara_asal text,
  bandara_tujuan text,
  tanggal date,
  jam time,
  catatan text,
  created_at timestamptz not null default now()
);

create index if not exists idx_penerbangan_paket on penerbangan(paket_id);

alter table penerbangan enable row level security;

drop policy if exists "penerbangan_select_staf" on penerbangan;
create policy "penerbangan_select_staf" on penerbangan
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "penerbangan_write_admin" on penerbangan;
create policy "penerbangan_write_admin" on penerbangan
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "penerbangan_select_jamaah" on penerbangan;
create policy "penerbangan_select_jamaah" on penerbangan
  for select using (
    my_role() = 'jamaah'
    and exists (
      select 1 from pendaftaran p
      where p.paket_id = penerbangan.paket_id and p.jamaah_id = my_jamaah_id()
    )
  );

create trigger trg_audit_penerbangan
  after insert or update on penerbangan
  for each row execute function fn_audit_log();

-- ------------------------------------------------------------
-- 2. ROOMLIST — jamaah lihat kamar & teman sekamarnya sendiri
-- ------------------------------------------------------------
drop policy if exists "roomlist_select_jamaah" on roomlist;
create policy "roomlist_select_jamaah" on roomlist
  for select using (
    my_role() = 'jamaah'
    and exists (
      select 1 from roomlist_anggota ra
      where ra.roomlist_id = roomlist.id and ra.jamaah_id = my_jamaah_id()
    )
  );

-- Bukan cuma baris miliknya sendiri — seluruh anggota kamar yang SAMA
-- dengan kamarnya, supaya dia bisa lihat siapa saja teman sekamarnya.
drop policy if exists "roomlist_anggota_select_jamaah" on roomlist_anggota;
create policy "roomlist_anggota_select_jamaah" on roomlist_anggota
  for select using (
    my_role() = 'jamaah'
    and exists (
      select 1 from roomlist_anggota mine
      where mine.roomlist_id = roomlist_anggota.roomlist_id
        and mine.jamaah_id = my_jamaah_id()
    )
  );

-- Supaya nama teman sekamar bisa ditampilkan (join ke jamaah) — dibatasi
-- KETAT hanya ke jamaah yang benar-benar sekamar dengannya, bukan
-- seluruh tabel jamaah (kebijakan jamaah_select_self_portal yang sudah
-- ada di 0009 tetap cuma untuk baris miliknya sendiri).
drop policy if exists "jamaah_select_teman_sekamar" on jamaah;
create policy "jamaah_select_teman_sekamar" on jamaah
  for select using (
    my_role() = 'jamaah'
    and exists (
      select 1 from roomlist_anggota ra_saya
      join roomlist_anggota ra_lain on ra_lain.roomlist_id = ra_saya.roomlist_id
      where ra_saya.jamaah_id = my_jamaah_id() and ra_lain.jamaah_id = jamaah.id
    )
  );
